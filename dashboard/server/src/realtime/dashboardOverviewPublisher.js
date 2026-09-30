// 라이다 snapshot이 들어올 때마다 대시보드 현황을 WebSocket으로 보낸다.
// 라이다 PC 여러 대가 1초마다 보내도 DB 조회가 몰리지 않도록 최소 간격을 두고,
// 간격 안에 들어온 요청은 버리지 않고 마지막에 한 번 더 보내 최신 상태를 놓치지 않는다.
function createDashboardOverviewPublisher({ getOverview, broadcast, logger, minIntervalMs = 500 }) {
  let lastPublishedAt = 0;
  let pendingTimer = null;
  let publishing = false;
  let requestedWhilePublishing = false;

  async function publish() {
    if (publishing) {
      requestedWhilePublishing = true;
      return;
    }

    publishing = true;
    lastPublishedAt = Date.now();
    try {
      const overview = await getOverview();
      broadcast("dashboard-overview", overview);
    } catch (error) {
      logger.warn("dashboard overview publish failed", { message: error.message });
    } finally {
      publishing = false;
      if (requestedWhilePublishing) {
        requestedWhilePublishing = false;
        notify();
      }
    }
  }

  function notify() {
    if (pendingTimer) return;

    const waitMs = Math.max(0, lastPublishedAt + minIntervalMs - Date.now());
    pendingTimer = setTimeout(() => {
      pendingTimer = null;
      void publish();
    }, waitMs);
  }

  return { notify };
}

module.exports = { createDashboardOverviewPublisher };
