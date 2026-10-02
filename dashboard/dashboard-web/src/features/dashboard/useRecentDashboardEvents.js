import { useEffect, useState } from "react";
import { getEventHistory } from "../events/eventsApi";

const RECENT_EVENT_LIMIT = 10;
const REFRESH_INTERVAL_MS = 10000;

// 대시보드 "실시간 이벤트" 카드에 표시할 최근 이벤트를 DB 이력 API에서 가져온다.
// 주기 조회와 별도로 refreshKey가 바뀌면(WebSocket 역주행 이벤트 수신 등) 즉시 다시 조회한다.
export function useRecentDashboardEvents(refreshKey) {
  const [events, setEvents] = useState([]);
  const [status, setStatus] = useState("loading");

  useEffect(() => {
    const controller = new AbortController();

    async function load() {
      try {
        const data = await getEventHistory(
          { limit: RECENT_EVENT_LIMIT },
          { signal: controller.signal },
        );
        setEvents(data?.items || []);
        setStatus("ready");
      } catch {
        if (controller.signal.aborted) return;
        // 일시적인 조회 실패 시 직전 목록은 유지하고 상태만 오류로 표시한다.
        setStatus("error");
      }
    }

    load();
    const timer = setInterval(load, REFRESH_INTERVAL_MS);

    return () => {
      controller.abort();
      clearInterval(timer);
    };
  }, [refreshKey]);

  return { events, status };
}
