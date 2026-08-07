function createWrongwayReceiveResponse({
  stored,
  duplicated,
  reason,
  eventId = null,
  trackId,
  type,
  warningLevel,
  normalMovingVehicleCount,
  receivedAt,
}) {
  // 라이다 수신 API의 성공 응답 규격을 공통 형태로 만듭니다.
  // service는 처리 결과만 넘기고 실제 응답 필드 구조는 DTO에서 고정합니다.
  return {
    ok: true,
    stored,
    duplicated,
    reason,
    eventId,
    trackId,
    type,
    warningLevel,
    normalMovingVehicleCount,
    receivedAt,
  };
}

function createWrongwayTestSendResponse({ payload, result }) {
  // Swagger/테스트 API가 반환하는 "테스트 payload + 실제 처리 결과" 규격입니다.
  return {
    ok: true,
    payload,
    result,
  };
}

function createWrongwayErrorResponse(error, fallbackMessage) {
  // controller의 실패 응답을 같은 형태로 맞춰 Swagger와 실제 응답이 어긋나지 않게 합니다.
  return {
    ok: false,
    message: error?.statusCode && error.statusCode < 500 ? error.message : fallbackMessage,
    details: error.details,
  };
}

module.exports = {
  createWrongwayErrorResponse,
  createWrongwayReceiveResponse,
  createWrongwayTestSendResponse,
};
