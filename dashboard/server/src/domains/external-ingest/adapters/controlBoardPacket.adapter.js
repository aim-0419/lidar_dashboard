const {
  EXTERNAL_EVENT_SOURCE,
  EXTERNAL_EVENT_TYPE,
  createExternalEvent,
  createRawSummary,
} = require("../externalEvent.model");

// command 값은 제어보드 신호 의미를 내부 이벤트 종류와 경고 단계로 매핑한다.
const COMMAND_EVENT_MAP = {
  STAGE_1: { eventType: EXTERNAL_EVENT_TYPE.CONTROL_STAGE, stage: 1, message: "통합 제어보드 1차 경고 수신" },
  STAGE_2: { eventType: EXTERNAL_EVENT_TYPE.CONTROL_STAGE, stage: 2, message: "통합 제어보드 2차 경고 수신" },
  CLEAR: { eventType: EXTERNAL_EVENT_TYPE.SITUATION_CLEARED, stage: 0, message: "통합 제어보드 상황 해제 수신" },
};

// packet이 문자열이든 바이트 배열이든 현장 확인용 크기를 계산한다.
function getPacketSize(packet) {
  if (Array.isArray(packet)) return packet.length;
  if (typeof packet === "string") return packet.length;
  return 0;
}

// 통합 제어보드 packet/mock payload를 내부 표준 이벤트로 바꾸는 adapter 함수다.
function adaptControlBoardPacket(payload = {}, options = {}) {
  // 통합 제어보드는 실제 현장에서 RS-485 패킷으로 신호를 줄 가능성이 높다.
  // 지금 단계에서는 HTTP mock API로 packet/command/crcValid 값을 받아 adapter 흐름만 먼저 검증한다.
  // 실제 CRC-8 계산과 바이트 위치 해석은 protocol adapter 단계에서 PDF 규격 기준으로 구현한다.
  const command = String(payload.command || payload.commandCode || "UNKNOWN").toUpperCase();
  const mapped = COMMAND_EVENT_MAP[command] || {
    eventType: EXTERNAL_EVENT_TYPE.UNKNOWN,
    stage: payload.stage,
    message: "통합 제어보드 패킷 수신",
  };

  const crcStatus = payload.crcValid === true ? "VALID" : payload.crcValid === false ? "INVALID" : "NOT_VERIFIED";

  return createExternalEvent({
    id: payload.id || payload.event_id,
    source: options.source || EXTERNAL_EVENT_SOURCE.CONTROL_BOARD,
    eventType: payload.eventType || mapped.eventType,
    stage: payload.stage ?? mapped.stage,
    siteId: payload.site_id || payload.siteId,
    zoneId: payload.zone_id || payload.zoneId,
    deviceId: payload.device_id || payload.deviceId || "CONTROL-BOARD-01",
    message: payload.message || mapped.message,
    occurredAt: payload.timestamp || payload.occurred_at || payload.occurredAt,
    rawPayload: payload,
    rawSummary: {
      ...createRawSummary(payload),
      command,
      crcStatus,
      packetSize: getPacketSize(payload.packet),
    },
  });
}

module.exports = {
  adaptControlBoardPacket,
};
