import { getJson } from "../../shared/api/http";

// 메인 대시보드 KPI, 현재 감지 객체, 라이다 수신 상태를 구역별로 조회한다.
export async function getDashboardOverview(options = {}) {
  const response = await getJson("/api/dashboard/overview", options);
  return response.data;
}
