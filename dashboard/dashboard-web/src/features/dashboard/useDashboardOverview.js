import { useCallback, useEffect, useState } from "react";
import { getDashboardOverview } from "./dashboardOverviewApi";

// WebSocket push가 주 갱신 경로이고, 이 주기 조회는 보조 경로다.
// 라이다가 멈추면 push가 오지 않으므로, 주기 조회로 "수신 끊김"과 오래된 객체 제거를 반영한다.
const FALLBACK_REFRESH_MS = 5000;

export function useDashboardOverview() {
  const [overview, setOverview] = useState(null);
  const [status, setStatus] = useState("loading");

  // WebSocket과 주기 조회 응답의 도착 순서가 뒤바뀌어도 더 오래된 데이터로 덮어쓰지 않는다.
  const applyOverview = useCallback((next) => {
    if (!next?.generatedAt) return;
    setOverview((prev) => (prev && prev.generatedAt > next.generatedAt ? prev : next));
    setStatus("ready");
  }, []);

  const refreshOverview = useCallback(async (signal) => {
    try {
      applyOverview(await getDashboardOverview({ signal }));
    } catch {
      if (signal?.aborted) return;
      // 일시적인 조회 실패 시 직전 현황은 유지하고 상태만 오류로 표시한다.
      setStatus("error");
    }
  }, [applyOverview]);

  useEffect(() => {
    const controller = new AbortController();

    async function load() {
      await refreshOverview(controller.signal);
    }

    void load();
    const timer = setInterval(() => void load(), FALLBACK_REFRESH_MS);

    return () => {
      controller.abort();
      clearInterval(timer);
    };
  }, [refreshOverview]);

  return { overview, status, applyOverview, refreshOverview };
}
