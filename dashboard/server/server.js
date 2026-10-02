const http = require("http");

const { app } = require("./src/app");
const { config } = require("./src/config");
const { initWebSocket } = require("./src/realtime/websocket");
const { createDashboardOverviewPublisher } = require("./src/realtime/dashboardOverviewPublisher");
const { setBroadcaster } = require("./src/domains/mock-lidar/mockLidar.service");
const { getDashboardOverview } = require("./src/domains/dashboard-overview/dashboardOverview.service");
const { setSnapshotProcessedListener } = require("./src/domains/wrongway/wrongway.service");
const { startLidarSimulator } = require("./src/simulator/lidarSimulator");
const {
  runSignupRequestMaintenance,
  SIGNUP_REQUEST_MAINTENANCE_INTERVAL_MS,
} = require("./src/domains/signup-requests/signupRequests.service");
const { logger } = require("./src/utils/logger");

const server = http.createServer(app);
const { broadcast } = initWebSocket(server);

setBroadcaster(broadcast);
startLidarSimulator();

// 라이다 snapshot 저장이 끝나면 메인 대시보드 현황(KPI, 현재 감지 객체, 수신 상태)을 실시간으로 보낸다.
const dashboardOverviewPublisher = createDashboardOverviewPublisher({
  getOverview: getDashboardOverview,
  broadcast,
  logger,
});
setSnapshotProcessedListener(() => dashboardOverviewPublisher.notify());

async function maintainSignupRequests() {
  try {
    const result = await runSignupRequestMaintenance();

    if (
      result.expiredCount > 0 ||
      result.anonymizedCount > 0 ||
      result.anonymizedAuditLogCount > 0 ||
      result.expiredEmailVerificationCount > 0
    ) {
      logger.info("signup request maintenance completed", result);
    }
  } catch (error) {
    logger.error("signup request maintenance failed", { message: error.message });
  }
}

void maintainSignupRequests();
const signupRequestMaintenanceTimer = setInterval(
  () => void maintainSignupRequests(),
  SIGNUP_REQUEST_MAINTENANCE_INTERVAL_MS,
);
signupRequestMaintenanceTimer.unref();

server.listen(config.port, "0.0.0.0", () => {
  logger.info("server started", {
    port: config.port,
    restUrl: `${config.dashboardBaseUrl}/api/state`,
    wsUrl: config.dashboardBaseUrl.replace(/^http/, "ws"),
    detectorBaseUrl: config.detectorBaseUrl,
  });
});
