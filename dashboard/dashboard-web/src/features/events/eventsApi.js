import { getJson, patchJson } from "../../shared/api/http";

// 빈 필터는 URL에 넣지 않아 Swagger와 브라우저 요청을 같은 형태로 유지한다.
export async function getEventHistory(params = {}, options = {}) {
  const query = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      query.set(key, String(value));
    }
  });

  const suffix = query.toString() ? `?${query.toString()}` : "";
  const response = await getJson(`/api/wrongway/history${suffix}`, options);
  return response.data;
}

// 이벤트 필터에 표시할 내부 구역 ID와 구역명을 조회한다.
export async function getEventZones(options = {}) {
  const response = await getJson("/api/zones", options);
  return response.data?.zones || [];
}

export async function getEventDetail(eventId, options = {}) {
  const response = await getJson(`/api/events/${eventId}`, options);
  return response.data?.event || null;
}

export async function updateEventStatus(eventId, payload) {
  const response = await patchJson(`/api/events/${eventId}/status`, payload);
  return response.data;
}
