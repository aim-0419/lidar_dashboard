const path = require("path");
const fs = require("fs");

require("dotenv").config({ path: path.resolve(__dirname, "../../../../.env"), override: true });

const serverRoot = path.resolve(__dirname, "../..");

const configPath = fs.existsSync(path.join(serverRoot, "config.json"))
  ? path.join(serverRoot, "config.json")
  : path.join(serverRoot, "config.example.json");

const rawConfig = JSON.parse(fs.readFileSync(configPath, "utf-8"));

const publicHost = process.env.PUBLIC_HOST || "localhost";
const dashboardHost = process.env.DASHBOARD_HOST || rawConfig.dashboardIP || publicHost;
const port = Number(process.env.DASHBOARD_PORT || rawConfig.serverPort || 5000);
const detectorHost = process.env.DETECTOR_HOST || dashboardHost;
const detectorPort = Number(process.env.DETECTOR_PORT || rawConfig.detectorPort || 8888);
const frontendPort = Number(process.env.FRONTEND_PORT || 5173);

const detectorBaseUrl = (
  process.env.DETECTOR_BASE_URL || `http://${detectorHost}:${detectorPort}`
).replace(/\/+$/, "");

const dashboardBaseUrl = (
  process.env.DASHBOARD_BASE_URL || `http://${dashboardHost}:${port}`
).replace(/\/+$/, "");

const frontendBaseUrl = (
  process.env.FRONTEND_BASE_URL || `http://${publicHost}:${frontendPort}`
).replace(/\/+$/, "");

const controlBoardHost = process.env.CONTROL_BOARD_HOST || "";
const controlBoardPort = Number(process.env.CONTROL_BOARD_PORT || 0);
const controlBoardTimeoutMs = Number(process.env.CONTROL_BOARD_TIMEOUT_MS || 3000);

const jwtSecret = process.env.JWT_SECRET || "";
const jwtRefreshSecret = process.env.JWT_REFRESH_SECRET || "";

if (!jwtSecret) {
  throw new Error("JWT_SECRET 환경변수가 필요합니다.");
}

if (!jwtRefreshSecret) {
  throw new Error("JWT_REFRESH_SECRET 환경변수가 필요합니다.");
}

const distPath = path.join(serverRoot, "../dashboard-web/dist");

module.exports = {
  config: {
    publicHost,
    dashboardHost,
    port,
    detectorHost,
    detectorPort,
    frontendPort,
    detectorBaseUrl,
    dashboardBaseUrl,
    frontendBaseUrl,
    controlBoardHost,
    controlBoardPort,
    controlBoardTimeoutMs,
    jwtSecret,
    jwtRefreshSecret,
    distPath,
  },
};
