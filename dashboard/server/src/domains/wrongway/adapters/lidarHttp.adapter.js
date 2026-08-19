const {
  EXTERNAL_EVENT_SOURCE,
  EXTERNAL_EVENT_TYPE,
  createExternalEvent,
  createRawSummary,
} = require("../../external-ingest/externalEvent.model");
const { WRONGWAY_EVENT_TYPE } = require("../wrongway.constants");

function firstDefined(...values) {
  return values.find((value) => value !== undefined && value !== null);
}

function toNumberOrUndefined(value) {
  if (value === undefined || value === null || value === "") return undefined;
  const number = Number(value);
  return Number.isNaN(number) ? undefined : number;
}

function normalizeLidarType(type) {
  const normalized = String(type || "").trim().toLowerCase();
  return normalized;
}

function mapLidarEventType(type) {
  switch (normalizeLidarType(type)) {
    case WRONGWAY_EVENT_TYPE.NORMAL_DRIVING:
      return EXTERNAL_EVENT_TYPE.NORMAL_DRIVING;
    case WRONGWAY_EVENT_TYPE.WRONG_WAY:
      return EXTERNAL_EVENT_TYPE.WRONG_WAY;
    case WRONGWAY_EVENT_TYPE.SITUATION_ENDED:
      return EXTERNAL_EVENT_TYPE.SITUATION_CLEARED;
    case WRONGWAY_EVENT_TYPE.PEDESTRIAN_ENTERED:
      return EXTERNAL_EVENT_TYPE.PEDESTRIAN_ENTERED;
    case WRONGWAY_EVENT_TYPE.PEDESTRIAN_EXITED:
      return EXTERNAL_EVENT_TYPE.PEDESTRIAN_EXITED;
    default:
      return EXTERNAL_EVENT_TYPE.UNKNOWN;
  }
}

function resolveWarningLevel(payload, normalizedType) {
  const value = firstDefined(payload.warning_level, payload.warningLevel, payload.stage);
  if (value !== undefined) return toNumberOrUndefined(value) ?? 0;
  return normalizedType === WRONGWAY_EVENT_TYPE.WRONG_WAY ? 1 : 0;
}

// source는 DB device_code와 비교할 수 있도록 대문자 케밥케이스로 통일한다.
function normalizeSourceDeviceCode(source) {
  return String(source || "")
    .trim()
    .replace(/[\s_]+/g, "-")
    .toUpperCase();
}

function createEventRawPayload(snapshot, object) {
  // 전체 objects 배열을 이벤트마다 복제하지 않고 공통 스냅샷 요약과 해당 객체만 보관한다.
  return {
    snapshot: {
      timestamp: snapshot.timestamp,
      source: snapshot.source,
      status: snapshot.status,
      total_objects: snapshot.totalObjects,
      moving_vehicle_count: snapshot.movingVehicleCount,
      normal_moving_vehicle_count: snapshot.normalMovingVehicleCount,
      wrong_way_count: snapshot.wrongWayCount,
      processing_time_ms: snapshot.processingTimeMs,
    },
    object,
  };
}

function adaptLidarObjectPayload(object = {}, snapshot) {
  const externalType = firstDefined(object.type, object.event_type, object.eventType);
  const normalizedType = normalizeLidarType(externalType);
  const warningLevel = resolveWarningLevel(object, normalizedType);
  const externalZoneId = firstDefined(object.zone_id, object.zoneId, object.external_zone_id);
  const rawPayload = createEventRawPayload(snapshot, object);

  return {
    ...createExternalEvent({
      source: EXTERNAL_EVENT_SOURCE.LIDAR_PC,
      eventType: mapLidarEventType(normalizedType),
      originalType: normalizedType,
      warningLevel,
      stage: warningLevel,
      zoneId: externalZoneId,
      externalZoneId,
      deviceId: snapshot.sourceDeviceCode,
      trackId: firstDefined(object.track_id, object.trackId, object.object_id),
      message: object.message || "라이다 객체 상태 수신",
      occurredAt: snapshot.timestamp,
      confidence: toNumberOrUndefined(object.confidence),
      speedMs: toNumberOrUndefined(firstDefined(object.speed_ms, object.speedMs)),
      speedKmh: toNumberOrUndefined(firstDefined(object.speed_kmh, object.speedKmh)),
      objectClass: toNumberOrUndefined(firstDefined(object.object_class, object.objectClass)),
      description: object.description,
      normalMovingVehicleCount: snapshot.normalMovingVehicleCount,
      rawPayload,
      rawSummary: createRawSummary(rawPayload),
    }),
    externalType,
  };
}

function adaptLidarSnapshotPayload(payload = {}) {
  // 구형 단일 객체 테스트 payload는 objects 한 건으로 감싸 새 처리 흐름을 함께 검증한다.
  const isLegacySingleObject = !Array.isArray(payload.objects) && Boolean(payload.type);
  const rawObjects = Array.isArray(payload.objects)
    ? payload.objects
    : isLegacySingleObject
      ? [payload]
      : [];

  const source = payload.source || payload.device_id || payload.deviceId || (isLegacySingleObject ? "lidar-pc-01" : "");
  const snapshot = {
    timestamp: payload.timestamp,
    source,
    sourceDeviceCode: normalizeSourceDeviceCode(source),
    status: normalizeLidarType(payload.status || payload.type),
    totalObjects: toNumberOrUndefined(payload.total_objects) ?? rawObjects.length,
    movingVehicleCount: toNumberOrUndefined(payload.moving_vehicle_count),
    normalMovingVehicleCount: toNumberOrUndefined(payload.normal_moving_vehicle_count),
    wrongWayCount: toNumberOrUndefined(payload.wrong_way_count),
    processingTimeMs: toNumberOrUndefined(payload.processing_time_ms),
    receivedAt: new Date().toISOString(),
    isLegacySingleObject,
    rawPayloadSummary: createRawSummary(payload),
    hasObjectsArray: Array.isArray(payload.objects),
  };

  return {
    ...snapshot,
    countMismatch: snapshot.totalObjects !== rawObjects.length,
    objects: rawObjects.map((object, index) => ({
      index,
      raw: object,
      event: adaptLidarObjectPayload(object, snapshot),
    })),
  };
}

// 기존 단일 객체 호출부가 남아 있는 동안 첫 객체를 반환하는 호환 함수다.
function adaptLidarHttpPayload(payload = {}) {
  return adaptLidarSnapshotPayload(payload).objects[0]?.event;
}

module.exports = {
  adaptLidarHttpPayload,
  adaptLidarObjectPayload,
  adaptLidarSnapshotPayload,
  mapLidarEventType,
  normalizeLidarType,
  normalizeSourceDeviceCode,
};
