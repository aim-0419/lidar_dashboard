import { getJson } from "../../shared/api/http";

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
