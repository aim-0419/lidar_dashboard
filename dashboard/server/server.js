const http = require("http");

const { app } = require("./src/app");
const { config } = require("./src/config");
const { initWebSocket } = require("./src/realtime/websocket");
const { setBroadcaster } = require("./src/domains/mock-lidar/mockLidar.service");
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

async function maintainSignupRequests() {
  try {
    const result = await runSignupRequestMaintenance();

    if (result.expiredCount > 0 || result.anonymizedCount > 0 || result.anonymizedAuditLogCount > 0) {
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
