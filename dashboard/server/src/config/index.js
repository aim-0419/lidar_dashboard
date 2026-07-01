const path = require("path");
const fs = require("fs");

// 환경변수는 프로젝트 루트 .env만 기준으로 사용한다.
require("dotenv").config({ path: path.resolve(__dirname, "../../../../.env"), override: true });

const serverRoot = path.resolve(__dirname, "../..");

const configPath = fs.existsSync(path.join(serverRoot, "config.json"))
  ? path.join(serverRoot, "config.json")
  : path.join(serverRoot, "config.example.json");

const rawConfig = JSON.parse(fs.readFileSync(configPath, "utf-8"));

const dashboardHost = process.env.DASHBOARD_HOST || rawConfig.dashboardIP || "localhost";
const port = Number(process.env.DASHBOARD_PORT || rawConfig.serverPort || 5000);
const detectorHost = process.env.DETECTOR_HOST || dashboardHost;
const detectorPort = Number(process.env.DETECTOR_PORT || rawConfig.detectorPort || 8888);

const detectorBaseUrl = (
  process.env.DETECTOR_BASE_URL || `http://${detectorHost}:${detectorPort}`
).replace(/\/+$/, "");

const dashboardBaseUrl = (
  process.env.DASHBOARD_BASE_URL || `http://${dashboardHost}:${port}`
).replace(/\/+$/, "");

const distPath = path.join(serverRoot, "../dashboard-web/dist");

module.exports = {
  config: {
    dashboardHost,
    port,
    detectorHost,
    detectorPort,
    detectorBaseUrl,
    dashboardBaseUrl,
    distPath,
  },
};
