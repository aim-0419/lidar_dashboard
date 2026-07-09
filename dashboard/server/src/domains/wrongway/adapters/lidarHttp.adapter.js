const {
  EXTERNAL_EVENT_SOURCE,
  EXTERNAL_EVENT_TYPE,
  createExternalEvent,
  createRawSummary,
} = require("../../external-ingest/externalEvent.model");

// 라이다 PC가 보내는 상황 type을 대시보드 내부 이벤트 타입으로 변환한다.
// 외부 type 원문은 originalType으로 따로 보존하고, 내부 처리는 아래 표준 타입을 기준으로 한다.
function mapLidarEventType(type) {
  switch (type) {
    case "normal-driving":
      return EXTERNAL_EVENT_TYPE.NORMAL_DRIVING;
    case "wrong-way-level-1":
    case "wrong-way-level-2":
    case "wrong-way":
      return EXTERNAL_EVENT_TYPE.WRONG_WAY;
    case "situation-ended":
      return EXTERNAL_EVENT_TYPE.SITUATION_CLEARED;
    default:
      return EXTERNAL_EVENT_TYPE.UNKNOWN;
  }
}

// warning_level이 없을 때 기존 stage나 type으로 화면 표시용 단계를 보정한다.
// 정주행/상황종료는 0, 역주행 1차는 1, 역주행 2차는 2로 본다.
function resolveWarningLevel(payload) {
  if (payload.warning_level !== undefined && payload.warning_level !== null) {
    return Number(payload.warning_level);
  }

  if (payload.warningLevel !== undefined && payload.warningLevel !== null) {
    return Number(payload.warningLevel);
  }

  if (payload.stage !== undefined && payload.stage !== null) {
    return Number(payload.stage);
  }

  if (payload.type === "wrong-way-level-1") return 1;
  if (payload.type === "wrong-way-level-2") return 2;

  return 0;
}

// 숫자형 payload는 문자열로 들어올 수 있어서 Number 변환 후 유효한 값만 넘긴다.
function toNumberOrUndefined(value) {
  if (value === undefined || value === null || value === "") return undefined;

  const number = Number(value);
  return Number.isNaN(number) ? undefined : number;
}

// boolean payload는 문자열 "true"/"false"로 들어와도 내부 boolean으로 맞춘다.
function toBooleanOrUndefined(value) {
  if (value === undefined || value === null || value === "") return undefined;
  if (typeof value === "boolean") return value;
  if (value === "true") return true;
  if (value === "false") return false;

  return undefined;
}

// 0도 의미 있는 값이므로 || 대신 null/undefined일 때만 대체값을 사용한다.
function firstDefined(...values) {
  return values.find((value) => value !== undefined && value !== null);
}

// 라이다 HTTP payload를 내부 표준 이벤트로 바꾸는 adapter 함수다.
function adaptLidarHttpPayload(payload = {}) {
  const originalType = firstDefined(payload.type, payload.event_type, payload.eventType);
  const warningLevel = resolveWarningLevel(payload);
  const externalZoneId = firstDefined(payload.zone_id, payload.zoneId, payload.external_zone_id);

  // 라이다 PC 최신 JSON 규격을 내부 표준 이벤트로 변환한다.
  // 여기서는 DB에 직접 저장하지 않고, service가 저장 정책을 결정할 수 있도록 원본/정규화 필드를 모두 보존한다.
  return createExternalEvent({
    id: payload.id || payload.event_id || payload.eventCode,
    source: EXTERNAL_EVENT_SOURCE.LIDAR_PC,
    eventType: mapLidarEventType(originalType),
    originalType,
    warningLevel,
    stage: warningLevel,
    siteId: payload.site_id || payload.siteId,
    zoneId: externalZoneId,
    externalZoneId,
    deviceId: payload.device_id || payload.deviceId || payload.serial_no,
    trackId: payload.track_id || payload.trackId || payload.object_id,
    message: payload.message || "라이다 역주행 감지 이벤트 수신",
    occurredAt: payload.timestamp || payload.occurred_at || payload.occurredAt,
    confidence: toNumberOrUndefined(payload.confidence),
    speedMs: toNumberOrUndefined(firstDefined(payload.speed_ms, payload.speedMs)),
    speedKmh: toNumberOrUndefined(firstDefined(payload.speed_kmh, payload.speedKmh)),
    objectClass: toNumberOrUndefined(firstDefined(payload.object_class, payload.objectClass)),
    description: payload.description,
    consecutiveCount: toNumberOrUndefined(
      firstDefined(payload.consecutive_count, payload.consecutiveCount),
    ),
    isConfirmed: toBooleanOrUndefined(payload.is_confirmed ?? payload.isConfirmed),
    normalMovingVehicleCount: toNumberOrUndefined(
      firstDefined(payload.normal_moving_vehicle_count, payload.normalMovingVehicleCount),
    ),
    rawPayload: payload,
    rawSummary: createRawSummary(payload),
  });
}

module.exports = {
  adaptLidarHttpPayload,
  mapLidarEventType,
};
