const {
  EXTERNAL_EVENT_SOURCE,
  EXTERNAL_EVENT_TYPE,
  createExternalEvent,
  createRawSummary,
} = require("../externalEvent.model");

// 라이다 HTTP payload를 내부 표준 이벤트로 바꾸는 adapter 함수다.
function adaptLidarHttpPayload(payload = {}) {
  // 라이다 PC에서 HTTP/JSON으로 들어온 데이터를 내부 표준 이벤트로 변환한다.
  // 아직 조선대 측 실제 데이터 규격이 없으므로 id, zone_id, track_id처럼 자주 쓰일 후보 필드를 우선 흡수한다.
  // 나중에 실제 예시 데이터가 오면 이 adapter만 수정하고, service/controller 흐름은 유지하는 것이 목표다.
  return createExternalEvent({
    id: payload.id || payload.event_id || payload.eventCode,
    source: EXTERNAL_EVENT_SOURCE.LIDAR_PC,
    eventType: EXTERNAL_EVENT_TYPE.WRONG_WAY,
    stage: payload.stage,
    siteId: payload.site_id || payload.siteId,
    zoneId: payload.zone_id || payload.zoneId,
    deviceId: payload.device_id || payload.deviceId || payload.serial_no,
    trackId: payload.track_id || payload.trackId || payload.object_id,
    message: payload.message || "라이다 역주행 감지 이벤트 수신",
    occurredAt: payload.timestamp || payload.occurred_at || payload.occurredAt,
    confidence: payload.confidence,
    rawPayload: payload,
    rawSummary: createRawSummary(payload),
  });
}

module.exports = {
  adaptLidarHttpPayload,
};
