const { prisma } = require("../../prisma/client");
const { logger } = require("../../utils/logger");
const mockLidarService = require("../mock-lidar/mockLidar.service");
const { adaptLidarSnapshotPayload } = require("./adapters/lidarHttp.adapter");
const {
  INCIDENT_STATUS,
  WRONGWAY_EVENT_STATUS,
  WRONGWAY_EVENT_TYPE,
  WRONGWAY_RECEIVE_REASON,
} = require("./wrongway.constants");
const {
  createEventHistoryResponse,
  createEventStatusUpdateResponse,
  createWrongwayBatchResponse,
  createWrongwayTestSendResponse,
} = require("./wrongway.dto");

const NORMAL_STREAM_INTERVAL_MS = 1000;
const TRACK_INACTIVE_TIMEOUT_MS = 3000;
const VEHICLE_OBJECT_CLASSES = new Set([1, 2, 3, 4, 5, 6]);
const SUPPORTED_TYPES = new Set(Object.values(WRONGWAY_EVENT_TYPE));
const EVENT_HISTORY_DEFAULT_LIMIT = 20;
const EVENT_HISTORY_MAX_LIMIT = 100;
const EVENT_HISTORY_STATUSES = new Set(Object.values(WRONGWAY_EVENT_STATUS));
const EVENT_HISTORY_SORT_FIELDS = new Set([
  "occurredAt",
  "eventType",
  "zone",
  "trackId",
  "speedKmh",
  "status",
]);
const EVENT_HISTORY_SORT_ORDERS = new Set(["asc", "desc"]);

// 같은 라이다 PC가 보낸 snapshot 두 건이 동시에 상태를 덮어쓰지 않도록 source별 처리 순서를 보장한다.
const sourceQueues = new Map();

// Swagger와 로컬 테스트에서 사용하는 1초 주기 정주행 스트림의 실행 상태를 메모리에 보관한다.
let normalStreamTimer = null;
let normalStreamState = {
  running: false,
  startedAt: null,
  stoppedAt: null,
  sentCount: 0,
  lastResult: null,
  lastError: null,
  trackId: null,
  zoneId: null,
};

function createHttpError(statusCode, message, details) {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.details = details;
  return error;
}

// 외부 timestamp가 실제 날짜로 해석될 때만 Date로 바꾸고, 잘못된 값은 null로 반환한다.
function toDateOrNull(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function parsePositiveInteger(value, fallback, fieldName) {
  if (value === undefined || value === null || value === "") return fallback;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) {
    throw createHttpError(400, `${fieldName}는 1 이상의 정수여야 합니다.`, { field: fieldName });
  }
  return parsed;
}

function parseHistoryDate(value, fieldName) {
  if (!value) return null;
  const date = toDateOrNull(value);
  if (!date) {
    throw createHttpError(400, `${fieldName}는 유효한 ISO 날짜여야 합니다.`, { field: fieldName });
  }
  return date;
}

// 화면 필터를 Prisma where 조건으로 변환한다. 보행자는 진입·이탈 두 유형을 함께 조회한다.
function createEventHistoryWhere(filters) {
  const where = {};

  if (filters.eventType === "pedestrian") {
    where.eventType = { in: [WRONGWAY_EVENT_TYPE.PEDESTRIAN_ENTERED, WRONGWAY_EVENT_TYPE.PEDESTRIAN_EXITED] };
  } else if (filters.eventType === WRONGWAY_EVENT_TYPE.WRONG_WAY) {
    // 현재 규격과 기존 1·2차 규격으로 저장된 역주행 이력을 한 필터에서 함께 조회한다.
    where.eventType = { in: [WRONGWAY_EVENT_TYPE.WRONG_WAY, "wrong-way-level-1", "wrong-way-level-2"] };
  } else if (filters.eventType) {
    if (!SUPPORTED_TYPES.has(filters.eventType)) {
      throw createHttpError(400, "지원하지 않는 eventType입니다.", { field: "eventType" });
    }
    where.eventType = filters.eventType;
  }

  if (filters.status) {
    if (!EVENT_HISTORY_STATUSES.has(filters.status)) {
      throw createHttpError(400, "지원하지 않는 status입니다.", { field: "status" });
    }
    where.status = filters.status;
  }

  if (filters.externalZoneId) where.externalZoneId = filters.externalZoneId;
  if (filters.zoneId) where.zoneId = filters.zoneId;
  if (filters.from || filters.to) {
    where.occurredAt = {
      ...(filters.from ? { gte: filters.from } : {}),
      ...(filters.to ? { lte: filters.to } : {}),
    };
  }

  if (filters.search) {
    where.OR = [
      { id: { contains: filters.search, mode: "insensitive" } },
      { trackId: { contains: filters.search, mode: "insensitive" } },
      { externalZoneId: { contains: filters.search, mode: "insensitive" } },
      { message: { contains: filters.search, mode: "insensitive" } },
      // 화면에 표시하는 내부 구역명과 구역 코드도 같은 검색창에서 찾을 수 있게 한다.
      { zone: { is: { name: { contains: filters.search, mode: "insensitive" } } } },
      { zone: { is: { zoneCode: { contains: filters.search, mode: "insensitive" } } } },
    ];
  }

  return where;
}

// 화면에서 허용한 열 이름만 Prisma 정렬 조건으로 변환해 임의 DB 필드 접근을 막는다.
function createEventHistoryOrderBy(sortBy, sortOrder) {
  const primaryOrder = sortBy === "zone"
    ? { zone: { name: sortOrder } }
    : { [sortBy]: sortOrder };

  // 같은 값을 가진 행의 순서가 페이지 이동마다 바뀌지 않도록 ID를 보조 정렬 기준으로 둔다.
  return [primaryOrder, { id: sortOrder }];
}

async function getEventHistory(query = {}) {
  const page = parsePositiveInteger(query.page, 1, "page");
  const limit = parsePositiveInteger(query.limit, EVENT_HISTORY_DEFAULT_LIMIT, "limit");
  if (limit > EVENT_HISTORY_MAX_LIMIT) {
    throw createHttpError(400, `limit은 ${EVENT_HISTORY_MAX_LIMIT} 이하여야 합니다.`, { field: "limit" });
  }

  const filters = {
    eventType: String(query.eventType || "").trim() || null,
    status: String(query.status || "").trim().toUpperCase() || null,
    externalZoneId: String(query.externalZoneId || "").trim() || null,
    zoneId: String(query.zoneId || "").trim() || null,
    search: String(query.search || "").trim() || null,
    from: parseHistoryDate(query.from, "from"),
    to: parseHistoryDate(query.to, "to"),
  };
  const sortBy = String(query.sortBy || "occurredAt").trim();
  const sortOrder = String(query.sortOrder || "desc").trim().toLowerCase();

  if (!EVENT_HISTORY_SORT_FIELDS.has(sortBy)) {
    throw createHttpError(400, "지원하지 않는 정렬 필드입니다.", { field: "sortBy" });
  }
  if (!EVENT_HISTORY_SORT_ORDERS.has(sortOrder)) {
    throw createHttpError(400, "정렬 방향은 asc 또는 desc여야 합니다.", { field: "sortOrder" });
  }
  if (filters.from && filters.to && filters.from > filters.to) {
    throw createHttpError(400, "from은 to보다 늦을 수 없습니다.", { fields: ["from", "to"] });
  }

  const where = createEventHistoryWhere(filters);
  const [total, events] = await prisma.$transaction([
    prisma.trafficEvent.count({ where }),
    prisma.trafficEvent.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
      orderBy: createEventHistoryOrderBy(sortBy, sortOrder),
      include: { zone: { select: { id: true, zoneCode: true, name: true } } },
    }),
  ]);

  return createEventHistoryResponse({
    events,
    page,
    limit,
    total,
    filters: {
      ...filters,
      from: filters.from?.toISOString() || null,
      to: filters.to?.toISOString() || null,
      sortBy,
      sortOrder,
    },
  });
}

async function updateEventStatus({ eventId, status, memo, userId }) {
  const nextStatus = String(status || "").trim().toUpperCase();
  const normalizedMemo = typeof memo === "string" ? memo.trim() : "";

  if (!EVENT_HISTORY_STATUSES.has(nextStatus)) {
    throw createHttpError(400, "지원하지 않는 status입니다.", { field: "status" });
  }

  // 관리자 상태 변경은 관제 업무 기록만 갱신하며 통합제어보드 제어 흐름을 호출하지 않는다.
  const result = await prisma.$transaction(async (tx) => {
    const existingEvent = await tx.trafficEvent.findUnique({
      where: { id: eventId },
      include: { zone: { select: { id: true, zoneCode: true, name: true } } },
    });

    if (!existingEvent) {
      throw createHttpError(404, "이벤트를 찾을 수 없습니다.", { eventId });
    }

    if (existingEvent.status === nextStatus) {
      return {
        event: existingEvent,
        previousStatus: existingEvent.status,
        changed: false,
      };
    }

    const event = await tx.trafficEvent.update({
      where: { id: eventId },
      data: { status: nextStatus },
      include: { zone: { select: { id: true, zoneCode: true, name: true } } },
    });

    await tx.eventLog.create({
      data: {
        eventId,
        userId,
        action: "EVENT_STATUS_CHANGED",
        message: normalizedMemo || null,
        metadata: {
          source: "MANUAL",
          previousStatus: existingEvent.status,
          nextStatus,
        },
      },
    });

    return {
      event,
      previousStatus: existingEvent.status,
      changed: true,
    };
  });

  if (result.changed) {
    logger.info("event status changed manually", {
      eventId,
      userId,
      previousStatus: result.previousStatus,
      nextStatus,
    });
  }

  return createEventStatusUpdateResponse({
    event: result.event,
    previousStatus: result.previousStatus,
    changed: result.changed,
  });
}

// 테스트 payload의 시간을 현장 기준인 KST ISO 문자열로 생성한다.
function toKstIsoString(date = new Date()) {
  const kstDate = new Date(date.getTime() + 9 * 60 * 60 * 1000);
  return kstDate.toISOString().replace("Z", "+09:00");
}

// 일별 통계의 날짜 경계를 UTC가 아닌 한국 날짜 기준으로 맞춘다.
function toKstStatDate(value) {
  const date = toDateOrNull(value) || new Date();
  const kst = new Date(date.getTime() + 9 * 60 * 60 * 1000);
  return new Date(Date.UTC(kst.getUTCFullYear(), kst.getUTCMonth(), kst.getUTCDate()));
}

// Prisma Json 컬럼에 저장할 수 있도록 객체에서 undefined와 특수 객체 표현을 제거한다.
function toJsonValue(value) {
  return JSON.parse(JSON.stringify(value ?? null));
}

// 같은 source의 이전 작업이 끝난 뒤 다음 snapshot을 처리한다.
// 서로 다른 라이다 PC의 요청은 각자 다른 큐를 사용하므로 병렬 처리가 가능하다.
function enqueueBySource(source, task) {
  const previous = sourceQueues.get(source) || Promise.resolve();
  const current = previous.catch(() => undefined).then(task);
  sourceQueues.set(source, current);

  const cleanup = () => {
    if (sourceQueues.get(source) === current) sourceQueues.delete(source);
  };
  current.then(cleanup, cleanup);

  return current;
}

// timestamp, source, objects처럼 snapshot 전체를 처리하는 데 필요한 상위 필드를 검사한다.
function validateSnapshot(snapshot) {
  if (!snapshot.timestamp || !toDateOrNull(snapshot.timestamp)) {
    throw createHttpError(400, "timestamp는 유효한 ISO 날짜 문자열이어야 합니다.", {
      field: "timestamp",
    });
  }
  if (!snapshot.sourceDeviceCode) {
    throw createHttpError(400, "source 값이 필요합니다.", { field: "source" });
  }
  if (!snapshot.hasObjectsArray && !snapshot.isLegacySingleObject) {
    throw createHttpError(400, "objects 배열이 필요합니다.", {
      field: "objects",
    });
  }
}

// objects 배열은 객체별로 검증한다. 일부 객체가 잘못되어도 정상 객체는 계속 처리한다.
// 단, 객체가 존재하는데 처리 가능한 객체가 하나도 없으면 요청 전체를 400으로 종료한다.
function validateObjects(snapshot) {
  const accepted = [];
  const rejected = [];

  for (const entry of snapshot.objects) {
    const errors = [];
    if (!entry.event.trackId) errors.push("track_id 값이 필요합니다.");
    if (!entry.event.externalZoneId) errors.push("zone_id 값이 필요합니다.");
    if (!SUPPORTED_TYPES.has(entry.event.originalType)) {
      errors.push(`지원하지 않는 type입니다: ${entry.event.externalType || "EMPTY"}`);
    }

    if (errors.length) {
      rejected.push({
        index: entry.index,
        trackId: entry.event.trackId || null,
        type: entry.event.externalType || null,
        action: "REJECTED",
        errors,
      });
    } else {
      accepted.push(entry);
    }
  }

  if (snapshot.objects.length > 0 && !accepted.length) {
    throw createHttpError(400, "처리할 수 있는 객체가 없습니다.", { rejected });
  }

  return { accepted, rejected };
}

// payload의 source를 내부 devices.device_code와 연결해 담당 구역까지 조회한다.
async function findSourceDevice(sourceDeviceCode) {
  return prisma.device.findUnique({
    where: { deviceCode: sourceDeviceCode },
    include: { zone: true },
  });
}

// 같은 날짜·구역·라이다 PC의 통계 행을 생성하거나 기존 숫자에 증분을 더한다.
// 매 요청마다 전체 vehicle_tracks를 다시 세지 않기 위한 누적 통계 처리다.
async function incrementDailyStat(tx, snapshot, device, increments) {
  const statDate = toKstStatDate(snapshot.timestamp);
  const key = {
    statDate_zoneId_deviceId: {
      statDate,
      zoneId: device.zoneId,
      deviceId: device.id,
    },
  };

  return tx.dailyTrafficStat.upsert({
    where: key,
    update: {
      totalVehicleCount: { increment: increments.totalVehicleCount || 0 },
      normalVehicleCount: { increment: increments.normalVehicleCount || 0 },
      wrongWayCount: { increment: increments.wrongWayCount || 0 },
      pedestrianEnteredCount: { increment: increments.pedestrianEnteredCount || 0 },
      pedestrianExitedCount: { increment: increments.pedestrianExitedCount || 0 },
    },
    create: {
      statDate,
      zoneId: device.zoneId,
      deviceId: device.id,
      totalVehicleCount: increments.totalVehicleCount || 0,
      normalVehicleCount: increments.normalVehicleCount || 0,
      wrongWayCount: increments.wrongWayCount || 0,
      pedestrianEnteredCount: increments.pedestrianEnteredCount || 0,
      pedestrianExitedCount: increments.pedestrianExitedCount || 0,
    },
  });
}

// 역주행이 처음 발생하면 사건을 만들고, 이미 활성 사건이 있으면 같은 사건을 재사용한다.
// 종료된 사건에서 다시 역주행이 감지된 경우에는 해당 사건을 다시 활성 상태로 전환한다.
async function ensureActiveIncident(tx, device, existingIncident) {
  if (existingIncident?.status === INCIDENT_STATUS.ACTIVE) {
    return existingIncident;
  }

  if (existingIncident) {
    return tx.safetyIncident.update({
      where: { id: existingIncident.id },
      data: { status: INCIDENT_STATUS.ACTIVE, resolvedAt: null },
    });
  }

  return tx.safetyIncident.create({
    data: {
      zoneId: device.zoneId,
      sourceDeviceId: device.id,
      incidentType: "WRONG_WAY",
      status: INCIDENT_STATUS.ACTIVE,
    },
  });
}

// 정주행 반복 상태는 제외하고, 의미 있는 상태 변화만 traffic_events와 event_logs에 기록한다.
async function createTrafficEvent(tx, { entry, device, vehicleTrack, incident }) {
  const event = entry.event;
  const trafficEvent = await tx.trafficEvent.create({
    data: {
      eventType: event.originalType,
      status: WRONGWAY_EVENT_STATUS.NEW,
      occurredAt: toDateOrNull(event.occurredAt),
      receivedAt: new Date(event.receivedAt),
      zoneId: device.zoneId,
      deviceId: device.id,
      incidentId: incident?.id || null,
      vehicleTrackId: vehicleTrack.id,
      externalZoneId: event.externalZoneId,
      trackId: event.trackId,
      warningLevel: event.originalType === WRONGWAY_EVENT_TYPE.WRONG_WAY ? 1 : 0,
      confidence: event.confidence,
      message: event.message,
      speedMs: event.speedMs,
      speedKmh: event.speedKmh,
      objectClass: event.objectClass,
      description: event.description,
      normalMovingVehicleCount: event.normalMovingVehicleCount,
      rawPayload: toJsonValue(event.rawPayload),
    },
  });

  await tx.eventLog.create({
    data: {
      eventId: trafficEvent.id,
      action: "EVENT_RECEIVED",
      message: `${event.originalType} 이벤트를 수신했습니다.`,
      metadata: {
        sourceDeviceCode: device.deviceCode,
        externalZoneId: event.externalZoneId,
        trackId: event.trackId,
      },
    },
  });

  return trafficEvent;
}

// snapshot 안의 객체 한 건을 현재 트랙 상태, 통계, 이벤트 이력에 반영한다.
async function processObject(tx, { entry, snapshot, device, incident }) {
  const event = entry.event;
  const trackKey = {
    deviceId_trackId: { deviceId: device.id, trackId: event.trackId },
  };
  const existing = await tx.vehicleTrack.findUnique({ where: trackKey });
  const occurredAt = toDateOrNull(event.occurredAt) || new Date(snapshot.receivedAt);

  // 네트워크 지연으로 과거 snapshot이 늦게 도착하면 최신 상태를 과거 값으로 되돌리지 않는다.
  if (existing && existing.lastSeenAt > occurredAt) {
    return {
      result: {
        index: entry.index,
        trackId: event.trackId,
        type: event.originalType,
        action: WRONGWAY_RECEIVE_REASON.STALE_OBJECT_SKIPPED,
        trackAction: null,
        eventId: null,
      },
      incident,
      isWrongWay: false,
    };
  }

  const isEnded = event.originalType === WRONGWAY_EVENT_TYPE.SITUATION_ENDED;

  // 동일 라이다 PC에서 같은 track_id를 다시 보내면 새 행을 만들지 않고 최신 상태만 갱신한다.
  // 서로 다른 라이다 PC가 우연히 같은 track_id를 사용해도 deviceId가 다르므로 별도 객체로 저장된다.
  const vehicleTrack = await tx.vehicleTrack.upsert({
    where: trackKey,
    update: {
      zoneId: device.zoneId,
      externalZoneId: event.externalZoneId,
      lastEventType: event.originalType,
      lastWarningLevel: event.originalType === WRONGWAY_EVENT_TYPE.WRONG_WAY ? 1 : 0,
      objectClass: event.objectClass,
      lastConfidence: event.confidence,
      lastSpeedMs: event.speedMs,
      lastSpeedKmh: event.speedKmh,
      lastSeenAt: occurredAt,
      isActive: !isEnded,
      endedAt: isEnded ? occurredAt : null,
    },
    create: {
      deviceId: device.id,
      trackId: event.trackId,
      zoneId: device.zoneId,
      externalZoneId: event.externalZoneId,
      lastEventType: event.originalType,
      lastWarningLevel: event.originalType === WRONGWAY_EVENT_TYPE.WRONG_WAY ? 1 : 0,
      objectClass: event.objectClass,
      lastConfidence: event.confidence,
      lastSpeedMs: event.speedMs,
      lastSpeedKmh: event.speedKmh,
      firstSeenAt: occurredAt,
      lastSeenAt: occurredAt,
      isActive: !isEnded,
      endedAt: isEnded ? occurredAt : null,
      // 최초 관측 객체만 남기고 이후 1초 snapshot 원본은 반복 저장하지 않는다.
      rawPayload: toJsonValue(entry.raw),
    },
  });

  // 처음 관측한 차량만 전체 차량 수에 포함한다. 1초마다 반복되는 같은 차량은 다시 세지 않는다.
  if (!existing && VEHICLE_OBJECT_CLASSES.has(event.objectClass)) {
    await incrementDailyStat(tx, snapshot, device, {
      totalVehicleCount: 1,
      normalVehicleCount: event.originalType === WRONGWAY_EVENT_TYPE.NORMAL_DRIVING ? 1 : 0,
    });
  }

  // 사라졌던 객체가 다시 나타났거나 type이 바뀌면 상태 변화로 판단한다.
  const reactivated = Boolean(existing && !existing.isActive && !isEnded);
  const stateChanged = !existing || reactivated || existing.lastEventType !== event.originalType;

  // normal-driving은 최신 위치 상태만 필요하므로 traffic_events 이력을 매초 만들지 않는다.
  const eventTypeRequiresHistory = event.originalType !== WRONGWAY_EVENT_TYPE.NORMAL_DRIVING;
  let activeIncident = incident;

  // 역주행 객체가 하나라도 확인되면 해당 구역의 활성 사건을 확보한다.
  if (event.originalType === WRONGWAY_EVENT_TYPE.WRONG_WAY) {
    activeIncident = await ensureActiveIncident(tx, device, activeIncident);
  }

  let trafficEvent = null;
  // 같은 객체의 같은 이벤트가 1초마다 반복되면 이력을 중복 저장하지 않는다.
  // 최초 감지, 재활성화, type 변경처럼 실제 상태가 달라진 경우에만 이벤트와 통계를 남긴다.
  if (stateChanged && eventTypeRequiresHistory) {
    trafficEvent = await createTrafficEvent(tx, {
      entry,
      device,
      vehicleTrack,
      incident: activeIncident,
    });

    await incrementDailyStat(tx, snapshot, device, {
      wrongWayCount: event.originalType === WRONGWAY_EVENT_TYPE.WRONG_WAY ? 1 : 0,
      pedestrianEnteredCount: event.originalType === WRONGWAY_EVENT_TYPE.PEDESTRIAN_ENTERED ? 1 : 0,
      pedestrianExitedCount: event.originalType === WRONGWAY_EVENT_TYPE.PEDESTRIAN_EXITED ? 1 : 0,
    });
  }

  return {
    result: {
      index: entry.index,
      trackId: event.trackId,
      type: event.originalType,
      action: trafficEvent
        ? WRONGWAY_RECEIVE_REASON.EVENT_STORED
        : stateChanged
          ? existing
            ? WRONGWAY_RECEIVE_REASON.TRACK_UPDATED
            : WRONGWAY_RECEIVE_REASON.TRACK_CREATED
          : WRONGWAY_RECEIVE_REASON.DUPLICATED_STATE,
      trackAction: existing
        ? WRONGWAY_RECEIVE_REASON.TRACK_UPDATED
        : WRONGWAY_RECEIVE_REASON.TRACK_CREATED,
      eventId: trafficEvent?.id || null,
      incidentId: event.originalType === WRONGWAY_EVENT_TYPE.NORMAL_DRIVING ? null : activeIncident?.id || null,
    },
    incident: activeIncident,
    isWrongWay: event.originalType === WRONGWAY_EVENT_TYPE.WRONG_WAY,
    dashboardEvent: trafficEvent && event.originalType === WRONGWAY_EVENT_TYPE.WRONG_WAY
      ? { event, trafficEvent }
      : null,
  };
}

// snapshot에 상황 종료 객체가 있고 현재 역주행 객체가 없을 때 시스템 사건만 종료한다.
// traffic_events.status는 관제자의 업무 처리 상태이므로 라이다 신호로 자동 변경하지 않는다.
async function resolveIncidentIfNeeded(tx, { snapshot, incident, hasWrongWay }) {
  const hasSituationEnded = snapshot.objects.some(
    (entry) => entry.event.originalType === WRONGWAY_EVENT_TYPE.SITUATION_ENDED,
  );
  if (!incident || hasWrongWay || !hasSituationEnded) return incident;

  return tx.safetyIncident.update({
    where: { id: incident.id },
    data: { status: INCIDENT_STATUS.RESOLVED, resolvedAt: new Date(snapshot.receivedAt) },
  });
}

// 라이다 PC의 snapshot은 해당 시점에 보이는 전체 객체 목록이라는 전제로 처리한다.
// 최근 3초 동안 목록에 나타나지 않은 트랙은 삭제하지 않고 비활성 상태로 전환한다.
async function deactivateMissingTracks(tx, { snapshot, device, accepted }) {
  // 매초 payload가 해당 시점의 전체 객체 목록이므로, 일정 시간 보이지 않은 객체는 현재 화면 대상에서 제외한다.
  // 한 번의 전송 누락만으로 즉시 종료하지 않도록 3초 유예시간을 둔다.
  const snapshotAt = toDateOrNull(snapshot.timestamp) || new Date(snapshot.receivedAt);
  const inactiveBefore = new Date(snapshotAt.getTime() - TRACK_INACTIVE_TIMEOUT_MS);
  const activeTrackIds = accepted.map((entry) => entry.event.trackId);

  return tx.vehicleTrack.updateMany({
    where: {
      deviceId: device.id,
      isActive: true,
      lastSeenAt: { lt: inactiveBefore },
      ...(activeTrackIds.length ? { trackId: { notIn: activeTrackIds } } : {}),
    },
    data: { isActive: false, endedAt: snapshotAt },
  });
}

// DB 트랜잭션이 성공한 뒤 역주행 이벤트만 기존 대시보드 상태와 WebSocket에 반영한다.
// DB가 롤백됐는데 프론트에만 이벤트가 보이는 불일치를 막기 위해 트랜잭션 밖에서 실행한다.
function applyDashboardEffects(items) {
  for (const item of items) {
    if (!item.dashboardEvent) continue;
    const { event, trafficEvent } = item.dashboardEvent;
    const dashboardEvent = {
      id: trafficEvent.id,
      type: "wrong-way",
      stage: 1,
      message: event.message || "역주행 발생",
      subMessage: `Zone: ${event.externalZoneId}`,
      timestamp: new Date(event.occurredAt).toLocaleTimeString(),
      zone_id: event.externalZoneId,
      track_id: event.trackId,
      confidence: event.confidence,
      source: event.deviceId,
    };
    mockLidarService.applyDashboardEventEffects(dashboardEvent);
    mockLidarService.addWrongWayHistory(dashboardEvent);
    mockLidarService.broadcastDashboardEvent(dashboardEvent);
    mockLidarService.pushLog(`[WRONGWAY] ${dashboardEvent.message} / ${dashboardEvent.subMessage}`);
  }
}

// 다중 객체 snapshot 한 건을 처리하는 서비스의 중심 흐름이다.
async function processSnapshot(snapshot) {
  // 1. 상위 payload와 개별 객체를 검증하고, 처리 가능한 객체와 거절 객체를 나눈다.
  validateSnapshot(snapshot);
  const { accepted, rejected } = validateObjects(snapshot);

  // 2. 외부 source를 내부 라이다 PC 및 담당 zone과 연결한다.
  const device = await findSourceDevice(snapshot.sourceDeviceCode);
  if (!device || device.deviceType !== "LIDAR_PC") {
    throw createHttpError(404, "등록된 라이다 PC source를 찾을 수 없습니다.", {
      source: snapshot.source,
      normalizedSource: snapshot.sourceDeviceCode,
    });
  }
  // 3. 트랙·사건·이벤트·통계를 하나의 트랜잭션으로 처리해 일부 데이터만 저장되는 상황을 막는다.
  const transactionResult = await prisma.$transaction(async (tx) => {
    let incident = await tx.safetyIncident.findFirst({
      where: {
        zoneId: device.zoneId,
        status: { in: [INCIDENT_STATUS.ACTIVE, INCIDENT_STATUS.RESET_REQUESTED, INCIDENT_STATUS.CONTROL_FAILED] },
      },
      orderBy: { startedAt: "desc" },
    });
    const processed = [];

    // 같은 snapshot 안의 객체들을 순서대로 처리하며 활성 사건 정보를 공유한다.
    for (const entry of accepted) {
      const item = await processObject(tx, {
        entry,
        snapshot,
        device,
        incident,
      });
      incident = item.incident;
      processed.push(item);
    }

    // 4. 전체 객체 처리 후 역주행 존재 여부를 기준으로 사건 종료와 누락 트랙 비활성화를 판단한다.
    const hasWrongWay = processed.some((item) => item.isWrongWay);
    const resolvedIncident = await resolveIncidentIfNeeded(tx, {
      snapshot,
      incident,
      hasWrongWay,
    });
    const deactivated = await deactivateMissingTracks(tx, { snapshot, device, accepted });

    return { processed, resolvedIncident, deactivatedCount: deactivated.count };
  });

  // 5. DB 저장이 확정된 뒤 프론트 실시간 이벤트를 발행한다.
  applyDashboardEffects(transactionResult.processed);

  const results = [...transactionResult.processed.map((item) => item.result), ...rejected]
    .sort((left, right) => left.index - right.index);
  const warnings = [];
  if (snapshot.countMismatch) {
    warnings.push(`total_objects(${snapshot.totalObjects})와 objects 길이(${snapshot.objects.length})가 다릅니다.`);
  }

  // 6. 호출 측에서 부분 성공과 중복·오래된 데이터 처리 결과를 확인할 수 있도록 요약한다.
  const summary = {
    received: snapshot.objects.length,
    accepted: accepted.length,
    rejected: rejected.length,
    tracksCreated: results.filter((item) => item.trackAction === WRONGWAY_RECEIVE_REASON.TRACK_CREATED).length,
    tracksUpdated: results.filter((item) => item.trackAction === WRONGWAY_RECEIVE_REASON.TRACK_UPDATED).length,
    eventsStored: results.filter((item) => item.action === WRONGWAY_RECEIVE_REASON.EVENT_STORED).length,
    duplicates: results.filter((item) => item.action === WRONGWAY_RECEIVE_REASON.DUPLICATED_STATE).length,
    staleObjects: results.filter((item) => item.action === WRONGWAY_RECEIVE_REASON.STALE_OBJECT_SKIPPED).length,
    tracksDeactivated: transactionResult.deactivatedCount,
  };

  logger.info("lidar multi-object snapshot processed", {
    source: snapshot.source,
    status: snapshot.status,
    ...summary,
  });

  return createWrongwayBatchResponse({ snapshot, summary, results, warnings });
}

// controller가 넘긴 외부 payload를 adapter로 내부 snapshot으로 바꾼 뒤 source 큐에 등록한다.
async function receiveWrongWayPayload(payload = {}) {
  const snapshot = adaptLidarSnapshotPayload(payload);
  return enqueueBySource(snapshot.sourceDeviceCode || "UNKNOWN", () => processSnapshot(snapshot));
}

// 아래 함수들은 실제 라이다 수신 로직이 아니라 Swagger와 로컬 검증용 payload 생성기다.
function createNormalDrivingObject(options = {}) {
  const sequence = Number(options.sequence || 0);
  return {
    type: WRONGWAY_EVENT_TYPE.NORMAL_DRIVING,
    warning_level: 0,
    confidence: 1,
    zone_id: options.zoneId || options.zone_id || "Z261",
    track_id: options.trackId || options.track_id || "test-normal-track-001",
    message: "정주행",
    speed_ms: 0.5 + sequence * 0.05,
    speed_kmh: (0.5 + sequence * 0.05) * 3.6,
    object_class: 1,
    description: "Normal",
  };
}

function createWrongWayObject(options = {}) {
  return {
    type: WRONGWAY_EVENT_TYPE.WRONG_WAY,
    warning_level: 1,
    confidence: 0.95,
    zone_id: options.zoneId || options.zone_id || "Z327",
    track_id: options.trackId || options.track_id || "test-wrongway-track-001",
    message: "역주행 발생",
    speed_ms: 2.835765050970876,
    speed_kmh: 10.208754183495154,
    object_class: 1,
    description: "Wrong-way driving detected",
  };
}

function createSnapshot(objects, options = {}) {
  const wrongWayCount = objects.filter((object) => object.type === WRONGWAY_EVENT_TYPE.WRONG_WAY).length;
  return {
    timestamp: toKstIsoString(),
    source: options.source || "lidar-pc-01",
    status: wrongWayCount ? WRONGWAY_EVENT_TYPE.WRONG_WAY : WRONGWAY_EVENT_TYPE.NORMAL_DRIVING,
    total_objects: objects.length,
    moving_vehicle_count: objects.filter((object) => VEHICLE_OBJECT_CLASSES.has(object.object_class)).length,
    normal_moving_vehicle_count: objects.filter((object) => object.type === WRONGWAY_EVENT_TYPE.NORMAL_DRIVING).length,
    wrong_way_count: wrongWayCount,
    processing_time_ms: 8.5,
    objects,
  };
}

// 테스트 도구에서 바로 복사해 사용할 수 있는 정상/역주행 다중 객체 예시를 반환한다.
function getTestPayloads(baseUrl = "http://localhost:5000") {
  const endpoint = `${baseUrl.replace(/\/+$/, "")}/api/wrongway`;
  return {
    ok: true,
    endpoint,
    note: "objects 배열은 객체가 한 건이어도 항상 배열로 전송합니다.",
    payloads: {
      normalDriving: createSnapshot([createNormalDrivingObject()]),
      wrongWay: createSnapshot([createNormalDrivingObject(), createWrongWayObject()]),
    },
  };
}

async function sendNormalDrivingTestPayload(options = {}) {
  const payload = createSnapshot([createNormalDrivingObject(options)], options);
  const result = await receiveWrongWayPayload(payload);
  return createWrongwayTestSendResponse({ payload, result });
}

async function sendWrongWayTestPayload(options = {}) {
  const payload = createSnapshot([createNormalDrivingObject(options), createWrongWayObject(options)], options);
  const result = await receiveWrongWayPayload(payload);
  return createWrongwayTestSendResponse({ payload, result });
}

function getNormalStreamStatus() {
  return { ok: true, ...normalStreamState, intervalMs: NORMAL_STREAM_INTERVAL_MS };
}

function stopNormalDrivingStream() {
  if (normalStreamTimer) clearInterval(normalStreamTimer);
  normalStreamTimer = null;
  normalStreamState = { ...normalStreamState, running: false, stoppedAt: new Date().toISOString() };
  return getNormalStreamStatus();
}

// setInterval이 실행할 한 회차의 정주행 snapshot을 실제 수신 서비스로 전달한다.
async function tickNormalDrivingStream(options = {}) {
  const sequence = normalStreamState.sentCount + 1;
  const payload = createSnapshot([
    createNormalDrivingObject({
      ...options,
      sequence,
      trackId: normalStreamState.trackId,
      zoneId: normalStreamState.zoneId,
    }),
  ], options);

  try {
    const result = await receiveWrongWayPayload(payload);
    normalStreamState = { ...normalStreamState, sentCount: sequence, lastResult: result, lastError: null };
  } catch (error) {
    normalStreamState = { ...normalStreamState, lastError: { message: error.message, details: error.details } };
    logger.error("normal driving stream tick failed", { error });
  }
}

// 테스트 스트림은 고정 track_id를 1초마다 보내 vehicle_tracks upsert 동작을 검증한다.
function startNormalDrivingStream(options = {}) {
  if (normalStreamTimer) {
    return { ...getNormalStreamStatus(), message: "정주행 테스트 스트림이 이미 실행 중입니다." };
  }
  normalStreamState = {
    running: true,
    startedAt: new Date().toISOString(),
    stoppedAt: null,
    sentCount: 0,
    lastResult: null,
    lastError: null,
    trackId: options.trackId || options.track_id || "test-normal-track-001",
    zoneId: options.zoneId || options.zone_id || "Z261",
  };
  tickNormalDrivingStream(options);
  normalStreamTimer = setInterval(() => tickNormalDrivingStream(options), NORMAL_STREAM_INTERVAL_MS);
  return getNormalStreamStatus();
}

module.exports = {
  getEventHistory,
  updateEventStatus,
  getTestPayloads,
  getNormalStreamStatus,
  receiveWrongWayPayload,
  sendNormalDrivingTestPayload,
  sendWrongWayTestPayload,
  startNormalDrivingStream,
  stopNormalDrivingStream,
};
