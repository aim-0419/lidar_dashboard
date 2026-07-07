const path = require("path");
const fs = require("fs");

// 환경변수는 프로젝트 루트 .env만 기준으로 사용한다.
// 로그인에 필요한 JWT_SECRET, JWT_REFRESH_SECRET도 이 .env에서 불러온다. 
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

const controlBoardHost = process.env.CONTROL_BOARD_HOST || "";
const controlBoardPort = Number(process.env.CONTROL_BOARD_PORT || 0);
const controlBoardTimeoutMs = Number(process.env.CONTROL_BOARD_TIMEOUT_MS || 3000);

// accessToken 셍성 및 검증에 사용할 비밀키
// 프로젝트 루트 .env의 JWT_SECRET 값을 가져온다. 
const jwtSecret = process.env.JWT_SECRET || "";

// refreshToken 생성 및 검증에 사용할 비밀키
// 프로젝트 루트 .env의 JWT_REFRESH_SECRET 값을 가져온다.
const jwtRefreshSecret = process.env.JWT_REFRESH_SECRET || "";

// accessToken용 비밀키가 없으면 서버 시작을 중단한다.
if (!jwtSecret) {
  throw new Error("JWT_SECRET 환경변수가 필요합니다.");
}

// refreshToken용 비밀키가 없으면 서버 시작을 중단한다.
if (!jwtRefreshSecret) {
  throw new Error("JWT_REFRESH_SECRET 환경변수가 필요합니다.");
}

const distPath = path.join(serverRoot, "../dashboard-web/dist");

module.exports = {
  config: {
    dashboardHost,
    port,
    detectorHost,
    detectorPort,
    detectorBaseUrl,
    dashboardBaseUrl,
    controlBoardHost,
    controlBoardPort,
    controlBoardTimeoutMs,
    jwtSecret,
    jwtRefreshSecret,
    distPath,
  },
};
