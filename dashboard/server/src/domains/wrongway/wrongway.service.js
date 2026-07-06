const { prisma } = require("../../prisma/client");
const { logger } = require("../../utils/logger");
const mockLidarService = require("../mock-lidar/mockLidar.service");
const { adaptLidarHttpPayload } = require("./adapters/lidarHttp.adapter");
const {
  WRONGWAY_EVENT_STATUS,
  WRONGWAY_EVENT_TYPE,
  WRONGWAY_RECEIVE_REASON,
  WRONGWAY_WARNING_LEVEL,
} = require("./wrongway.constants");
const {
  createWrongwayReceiveResponse,
  createWrongwayTestSendResponse,
} = require("./wrongway.dto");

const NORMAL_STREAM_INTERVAL_MS = 1000;

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

function toDateOrNull(value) {
  if (!value) return null;

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function toKstIsoString(date = new Date()) {
  // 라이다 PC 예시가 +09:00 KST ISO 문자열이라 테스트 payload도 같은 형태로 맞춘다.
  const kstDate = new Date(date.getTime() + 9 * 60 * 60 * 1000);
  return kstDate.toISOString().replace("Z", "+09:00");
}

function createNormalDrivingPayload(options = {}) {
  // 정주행 테스트 payload는 같은 track_id로 반복 전송해 VehicleTrack upsert를 확인하는 용도다.
  const sequence = Number(options.sequence || 0);
  return {
    type: WRONGWAY_EVENT_TYPE.NORMAL_DRIVING,
    warning_level: 0,
    timestamp: toKstIsoString(),
    confidence: 1.0,
    zone_id: options.zoneId || options.zone_id || "Z261",
    track_id: options.trackId || options.track_id || "test-normal-track-001",
    message: "정주행",
    speed_ms: 0.5 + sequence * 0.05,
    speed_kmh: (0.5 + sequence * 0.05) * 3.6,
    object_class: 1,
    description: "Normal",
    consecutive_count: 0,
    is_confirmed: false,
  };
}

function createWrongWayLevel1Payload(options = {}) {
  // 역주행 1차 테스트 payload는 TrafficEvent 저장과 중복 방지 로직을 확인하는 용도다.
  return {
    type: WRONGWAY_EVENT_TYPE.WRONGWAY_LEVEL_1,
    warning_level: 1,
    timestamp: toKstIsoString(),
    confidence: 0.95,
    zone_id: options.zoneId || options.zone_id || "Z327",
    track_id: options.trackId || options.track_id || "test-wrongway-track-001",
    message: "역주행 1차 감지",
    speed_ms: 2.835765050970876,
    speed_kmh: 10.208754183495154,
    object_class: 6,
    description: "Wrong-way driving detected (Heading and Path Confirmed)",
    consecutive_count: 3,
    is_confirmed: true,
  };
}

async function findZoneByExternalCode(externalZoneId) {
  if (!externalZoneId) return null;

  return prisma.zone.findFirst({
    where: { zoneCode: externalZoneId },
  });
}

function toDashboardEvent(event, trafficEvent) {
  return {
    id: trafficEvent?.id || event.id,
    type: "wrong-way",
    stage: event.warningLevel || event.stage || 1,
    message: event.message || "역주행 1차 감지",
    subMessage: `Zone: ${event.externalZoneId || event.zoneId || "UNKNOWN"}`,
    timestamp: event.occurredAt
      ? new Date(event.occurredAt).toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        })
      : new Date(event.receivedAt).toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        }),
    zone_id: event.externalZoneId || event.zoneId,
    track_id: event.trackId,
    confidence: event.confidence,
    source: event.source,
  };
}

async function countNormalDrivingTracks() {
  return prisma.vehicleTrack.count({
    where: { lastEventType: WRONGWAY_EVENT_TYPE.NORMAL_DRIVING },
  });
}

async function upsertVehicleTrack(event, zone) {
  // 정주행 payload는 1초마다 반복될 수 있으므로, track_id 기준으로 새 행을 계속 만들지 않고 최신 상태만 갱신한다.
  return prisma.vehicleTrack.upsert({
    where: { trackId: event.trackId },
    update: {
      zoneId: zone?.id || null,
      externalZoneId: event.externalZoneId,
      lastEventType: event.originalType || event.eventType,
      lastWarningLevel: event.warningLevel,
      objectClass: event.objectClass,
      lastSeenAt: toDateOrNull(event.occurredAt) || new Date(event.receivedAt),
      rawPayload: event.rawPayload,
    },
    create: {
      trackId: event.trackId,
      zoneId: zone?.id || null,
      externalZoneId: event.externalZoneId,
      lastEventType: event.originalType || event.eventType,
      lastWarningLevel: event.warningLevel,
      objectClass: event.objectClass,
      firstSeenAt: toDateOrNull(event.occurredAt) || new Date(event.receivedAt),
      lastSeenAt: toDateOrNull(event.occurredAt) || new Date(event.receivedAt),
      rawPayload: event.rawPayload,
    },
  });
}

async function updateTrackNormalCount(vehicleTrackId, normalMovingVehicleCount) {
  return prisma.vehicleTrack.update({
    where: { id: vehicleTrackId },
    data: { lastNormalMovingVehicleCount: normalMovingVehicleCount },
  });
}

async function findDuplicatedLevel1Event(event) {
  // 역주행 1차는 같은 차량/같은 단계가 반복 저장되지 않도록 먼저 기존 이벤트를 조회한다.
  return prisma.trafficEvent.findFirst({
    where: {
      trackId: event.trackId,
      eventType: WRONGWAY_EVENT_TYPE.WRONGWAY_LEVEL_1,
      warningLevel: WRONGWAY_WARNING_LEVEL.LEVEL_1,
    },
    orderBy: { receivedAt: "desc" },
  });
}

async function createLevel1TrafficEvent(event, zone, vehicleTrack, normalMovingVehicleCount) {
  const trafficEvent = await prisma.trafficEvent.create({
    data: {
      eventType: WRONGWAY_EVENT_TYPE.WRONGWAY_LEVEL_1,
      status: WRONGWAY_EVENT_STATUS.NEW,
      occurredAt: toDateOrNull(event.occurredAt),
      receivedAt: new Date(event.receivedAt),
      zoneId: zone?.id || null,
      vehicleTrackId: vehicleTrack.id,
      externalZoneId: event.externalZoneId,
      trackId: event.trackId,
      warningLevel: WRONGWAY_WARNING_LEVEL.LEVEL_1,
      confidence: event.confidence,
      message: event.message,
      speedMs: event.speedMs,
      speedKmh: event.speedKmh,
      objectClass: event.objectClass,
      description: event.description,
      consecutiveCount: event.consecutiveCount,
      isConfirmed: event.isConfirmed,
      normalMovingVehicleCount,
      rawPayload: event.rawPayload,
    },
  });

  await prisma.eventLog.create({
    data: {
      eventId: trafficEvent.id,
      action: "EVENT_RECEIVED",
      message: "역주행 1차 감지 이벤트를 수신했습니다.",
      metadata: {
        source: event.source,
        externalZoneId: event.externalZoneId,
        trackId: event.trackId,
        originalType: event.originalType,
      },
    },
  });

  return trafficEvent;
}

function applyLevel1DashboardEffects(event, trafficEvent) {
  const dashboardEvent = toDashboardEvent(event, trafficEvent);

  mockLidarService.applyDashboardEventEffects(dashboardEvent);
  mockLidarService.addWrongWayHistory(dashboardEvent);
  mockLidarService.broadcastDashboardEvent(dashboardEvent);
  mockLidarService.pushLog(`[WRONGWAY] ${dashboardEvent.message} / ${dashboardEvent.subMessage}`);
}

async function receiveWrongWayPayload(payload = {}) {
  const event = adaptLidarHttpPayload(payload);

  if (!event.originalType) {
    throw createHttpError(400, "type 값이 필요합니다.", { field: "type" });
  }

  if (!event.trackId) {
    throw createHttpError(400, "track_id 값이 필요합니다.", { field: "track_id" });
  }

  const zone = await findZoneByExternalCode(event.externalZoneId);
  const vehicleTrack = await upsertVehicleTrack(event, zone);
  const normalMovingVehicleCount = await countNormalDrivingTracks();

  await updateTrackNormalCount(vehicleTrack.id, normalMovingVehicleCount);

  logger.info("wrongway payload adapted", {
    type: event.originalType,
    trackId: event.trackId,
    externalZoneId: event.externalZoneId,
    warningLevel: event.warningLevel,
  });

  if (event.originalType === WRONGWAY_EVENT_TYPE.NORMAL_DRIVING) {
    return createWrongwayReceiveResponse({
      stored: false,
      duplicated: false,
      reason: WRONGWAY_RECEIVE_REASON.TRACK_UPDATED,
      eventId: null,
      trackId: event.trackId,
      type: event.originalType,
      warningLevel: event.warningLevel,
      normalMovingVehicleCount,
      receivedAt: event.receivedAt,
    });
  }

  if (
    event.originalType !== WRONGWAY_EVENT_TYPE.WRONGWAY_LEVEL_1 ||
    event.warningLevel !== WRONGWAY_WARNING_LEVEL.LEVEL_1
  ) {
    return createWrongwayReceiveResponse({
      stored: false,
      duplicated: false,
      reason: WRONGWAY_RECEIVE_REASON.NOT_IMPLEMENTED_YET,
      eventId: null,
      trackId: event.trackId,
      type: event.originalType,
      warningLevel: event.warningLevel,
      normalMovingVehicleCount,
      receivedAt: event.receivedAt,
    });
  }

  const duplicatedEvent = await findDuplicatedLevel1Event(event);
  if (duplicatedEvent) {
    return createWrongwayReceiveResponse({
      stored: false,
      duplicated: true,
      reason: WRONGWAY_RECEIVE_REASON.DUPLICATED_WRONGWAY_LEVEL_1,
      eventId: duplicatedEvent.id,
      trackId: event.trackId,
      type: event.originalType,
      warningLevel: event.warningLevel,
      normalMovingVehicleCount,
      receivedAt: event.receivedAt,
    });
  }

  const trafficEvent = await createLevel1TrafficEvent(
    event,
    zone,
    vehicleTrack,
    normalMovingVehicleCount,
  );

  applyLevel1DashboardEffects(event, trafficEvent);

  return createWrongwayReceiveResponse({
    stored: true,
    duplicated: false,
    reason: WRONGWAY_RECEIVE_REASON.WRONGWAY_LEVEL_1_STORED,
    eventId: trafficEvent.id,
    trackId: event.trackId,
    type: event.originalType,
    warningLevel: event.warningLevel,
    normalMovingVehicleCount,
    receivedAt: event.receivedAt,
  });
}

function getTestPayloads(baseUrl = "http://localhost:5000") {
  const endpoint = `${baseUrl.replace(/\/+$/, "")}/api/wrongway`;

  const normalDriving = createNormalDrivingPayload();
  const wrongWayLevel1 = createWrongWayLevel1Payload();

  return {
    ok: true,
    endpoint,
    note: "다른 PC에서는 localhost 대신 대시보드 서버 PC의 내부망 IP를 사용합니다.",
    testApis: {
      startNormalStream: `${baseUrl.replace(/\/+$/, "")}/api/wrongway/test/normal-stream/start`,
      stopNormalStream: `${baseUrl.replace(/\/+$/, "")}/api/wrongway/test/normal-stream/stop`,
      normalStreamStatus: `${baseUrl.replace(/\/+$/, "")}/api/wrongway/test/normal-stream/status`,
      sendWrongWayLevel1: `${baseUrl.replace(/\/+$/, "")}/api/wrongway/test/wrong-way-level-1`,
    },
    payloads: {
      normalDriving,
      wrongWayLevel1,
    },
  };
}

async function sendNormalDrivingTestPayload(options = {}) {
  const payload = createNormalDrivingPayload(options);
  const result = await receiveWrongWayPayload(payload);
  return createWrongwayTestSendResponse({ payload, result });
}

async function sendWrongWayLevel1TestPayload(options = {}) {
  const payload = createWrongWayLevel1Payload(options);
  const result = await receiveWrongWayPayload(payload);
  return createWrongwayTestSendResponse({ payload, result });
}

function getNormalStreamStatus() {
  return {
    ok: true,
    ...normalStreamState,
    intervalMs: NORMAL_STREAM_INTERVAL_MS,
  };
}

function stopNormalDrivingStream() {
  if (normalStreamTimer) {
    clearInterval(normalStreamTimer);
    normalStreamTimer = null;
  }

  normalStreamState = {
    ...normalStreamState,
    running: false,
    stoppedAt: new Date().toISOString(),
  };

  return getNormalStreamStatus();
}

async function tickNormalDrivingStream(options = {}) {
  const sequence = normalStreamState.sentCount + 1;
  const payload = createNormalDrivingPayload({
    ...options,
    sequence,
    trackId: normalStreamState.trackId,
    zoneId: normalStreamState.zoneId,
  });

  try {
    const result = await receiveWrongWayPayload(payload);
    normalStreamState = {
      ...normalStreamState,
      sentCount: sequence,
      lastResult: result,
      lastError: null,
    };
  } catch (error) {
    normalStreamState = {
      ...normalStreamState,
      lastError: {
        message: error.message,
        details: error.details,
      },
    };
    logger.error("normal driving stream tick failed", { error });
  }
}

function startNormalDrivingStream(options = {}) {
  if (normalStreamTimer) {
    return {
      ...getNormalStreamStatus(),
      message: "정주행 테스트 스트림이 이미 실행 중입니다.",
    };
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

  // 시작 버튼을 누른 직후 한 번 전송하고, 이후 1초 간격으로 같은 track_id를 반복 전송한다.
  tickNormalDrivingStream(options);
  normalStreamTimer = setInterval(() => {
    tickNormalDrivingStream(options);
  }, NORMAL_STREAM_INTERVAL_MS);

  return getNormalStreamStatus();
}

module.exports = {
  getTestPayloads,
  getNormalStreamStatus,
  receiveWrongWayPayload,
  sendNormalDrivingTestPayload,
  sendWrongWayLevel1TestPayload,
  startNormalDrivingStream,
  stopNormalDrivingStream,
};
