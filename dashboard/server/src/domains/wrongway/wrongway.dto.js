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

function createWrongwayBatchResponse({ snapshot, summary, results, warnings = [] }) {
  // 한 HTTP snapshot 안의 여러 객체가 각각 어떻게 처리됐는지 한 응답으로 묶는다.
  return {
    ok: true,
    source: snapshot.source,
    status: snapshot.status,
    occurredAt: snapshot.timestamp || null,
    receivedAt: snapshot.receivedAt,
    summary,
    warnings,
    results,
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

// DB 모델을 프론트 이벤트 목록에서 사용하는 camelCase 응답으로 제한한다.
// 목록 조회에서는 크기가 큰 rawPayload를 제외하고 상세 API에서만 제공할 예정이다.
function createEventHistoryItem(event) {
  return {
    id: event.id,
    eventCode: event.eventCode,
    eventType: event.eventType,
    status: event.status,
    occurredAt: event.occurredAt,
    receivedAt: event.receivedAt,
    zone: event.zone
      ? { id: event.zone.id, code: event.zone.zoneCode, name: event.zone.name }
      : null,
    externalZoneId: event.externalZoneId,
    trackId: event.trackId,
    warningLevel: event.warningLevel,
    confidence: event.confidence,
    message: event.message,
    speedKmh: event.speedKmh,
    objectClass: event.objectClass,
    description: event.description,
  };
}

function createEventHistoryResponse({ events, page, limit, total, filters }) {
  const totalPages = total === 0 ? 0 : Math.ceil(total / limit);

  return {
    success: true,
    data: {
      items: events.map(createEventHistoryItem),
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasPrevious: page > 1,
        hasNext: page < totalPages,
      },
      filters,
    },
    message: "OK",
  };
}

function createEventDetailItem(event) {
  return {
    ...createEventHistoryItem(event),
    speedMs: event.speedMs,
    createdAt: event.createdAt,
    updatedAt: event.updatedAt,
    zone: event.zone
      ? {
          id: event.zone.id,
          code: event.zone.zoneCode,
          name: event.zone.name,
          site: event.zone.site
            ? { id: event.zone.site.id, name: event.zone.site.name }
            : null,
        }
      : null,
    device: event.device
      ? {
          id: event.device.id,
          code: event.device.deviceCode,
          name: event.device.name,
          type: event.device.deviceType,
        }
      : null,
    rawPayload: event.rawPayload,
  };
}

function createEventDetailResponse(event) {
  // 목록에서는 제외한 진단 필드와 원본 payload를 단건 상세 조회에서만 반환한다.
  return {
    success: true,
    data: { event: createEventDetailItem(event) },
    message: "OK",
  };
}

function createEventStatusUpdateResponse({
  event,
  previousStatus,
  changed,
  statusChanged,
  memoSaved,
}) {
  // 관리자 상태 변경 결과만 반환하며 장비 제어 결과와 섞지 않는다.
  const message = statusChanged
    ? "이벤트 상태가 변경되었습니다."
    : memoSaved
      ? "이벤트 변경 사유가 기록되었습니다."
      : "저장할 변경 사항이 없습니다.";

  return {
    success: true,
    data: {
      event: createEventHistoryItem(event),
      previousStatus,
      changed,
      statusChanged,
      memoSaved,
    },
    message,
  };
}

module.exports = {
  createEventDetailResponse,
  createEventHistoryResponse,
  createEventStatusUpdateResponse,
  createWrongwayErrorResponse,
  createWrongwayReceiveResponse,
  createWrongwayBatchResponse,
  createWrongwayTestSendResponse,
};
