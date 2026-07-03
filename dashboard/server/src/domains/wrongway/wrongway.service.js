const { prisma } = require("../../prisma/client");
const { logger } = require("../../utils/logger");
const mockLidarService = require("../mock-lidar/mockLidar.service");
const { adaptLidarHttpPayload } = require("../external-ingest/adapters/lidarHttp.adapter");

const WRONGWAY_LEVEL_1 = "wrong-way-level-1";
const NORMAL_DRIVING = "normal-driving";

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
    where: { lastEventType: NORMAL_DRIVING },
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
      eventType: WRONGWAY_LEVEL_1,
      warningLevel: 1,
    },
    orderBy: { receivedAt: "desc" },
  });
}

async function createLevel1TrafficEvent(event, zone, vehicleTrack, normalMovingVehicleCount) {
  const trafficEvent = await prisma.trafficEvent.create({
    data: {
      eventType: WRONGWAY_LEVEL_1,
      status: "NEW",
      occurredAt: toDateOrNull(event.occurredAt),
      receivedAt: new Date(event.receivedAt),
      zoneId: zone?.id || null,
      vehicleTrackId: vehicleTrack.id,
      externalZoneId: event.externalZoneId,
      trackId: event.trackId,
      warningLevel: 1,
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

  if (event.originalType === NORMAL_DRIVING) {
    return {
      ok: true,
      stored: false,
      duplicated: false,
      reason: "TRACK_UPDATED",
      eventId: null,
      trackId: event.trackId,
      type: event.originalType,
      warningLevel: event.warningLevel,
      normalMovingVehicleCount,
      receivedAt: event.receivedAt,
    };
  }

  if (event.originalType !== WRONGWAY_LEVEL_1 || event.warningLevel !== 1) {
    return {
      ok: true,
      stored: false,
      duplicated: false,
      reason: "NOT_IMPLEMENTED_YET",
      eventId: null,
      trackId: event.trackId,
      type: event.originalType,
      warningLevel: event.warningLevel,
      normalMovingVehicleCount,
      receivedAt: event.receivedAt,
    };
  }

  const duplicatedEvent = await findDuplicatedLevel1Event(event);
  if (duplicatedEvent) {
    return {
      ok: true,
      stored: false,
      duplicated: true,
      reason: "DUPLICATED_WRONGWAY_LEVEL_1",
      eventId: duplicatedEvent.id,
      trackId: event.trackId,
      type: event.originalType,
      warningLevel: event.warningLevel,
      normalMovingVehicleCount,
      receivedAt: event.receivedAt,
    };
  }

  const trafficEvent = await createLevel1TrafficEvent(
    event,
    zone,
    vehicleTrack,
    normalMovingVehicleCount,
  );

  applyLevel1DashboardEffects(event, trafficEvent);

  return {
    ok: true,
    stored: true,
    duplicated: false,
    reason: "WRONGWAY_LEVEL_1_STORED",
    eventId: trafficEvent.id,
    trackId: event.trackId,
    type: event.originalType,
    warningLevel: event.warningLevel,
    normalMovingVehicleCount,
    receivedAt: event.receivedAt,
  };
}

function getTestPayloads(baseUrl = "http://localhost:5000") {
  const endpoint = `${baseUrl.replace(/\/+$/, "")}/api/wrongway`;

  const normalDriving = {
    type: "normal-driving",
    warning_level: 0,
    timestamp: "2026-01-13T14:43:53.860089+09:00",
    confidence: 1.0,
    zone_id: "Z261",
    track_id: "54750000-0000-0000-0000-000000000000",
    message: "정주행",
    speed_ms: 0.5792374909226594,
    speed_kmh: 2.085254967321574,
    object_class: 1,
    description: "Normal",
    consecutive_count: 0,
    is_confirmed: false,
  };

  const wrongWayLevel1 = {
    type: "wrong-way-level-1",
    warning_level: 1,
    timestamp: "2026-01-13T14:43:54.360258+09:00",
    confidence: 0.95,
    zone_id: "Z327",
    track_id: "81760000-0000-0000-0000-000000000000",
    message: "역주행 1차 감지",
    speed_ms: 2.835765050970876,
    speed_kmh: 10.208754183495154,
    object_class: 6,
    description: "Wrong-way driving detected (Heading and Path Confirmed)",
    consecutive_count: 3,
    is_confirmed: true,
  };

  return {
    ok: true,
    endpoint,
    note: "다른 PC에서는 localhost 대신 대시보드 서버 PC의 내부망 IP를 사용합니다.",
    payloads: {
      normalDriving,
      wrongWayLevel1,
    },
  };
}

module.exports = {
  receiveWrongWayPayload,
  getTestPayloads,
};
