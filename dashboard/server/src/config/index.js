const path = require("path");
const fs = require("fs");

// 서버는 프로젝트 루트의 .env 파일에서 공용 환경변수를 읽습니다.
require("dotenv").config({ path: path.resolve(__dirname, "../../../../.env"), override: true });

const serverRoot = path.resolve(__dirname, "../..");

// 실제 설정 파일이 있으면 우선 사용하고, 없으면 예제 설정 파일을 fallback으로 사용합니다.
const configPath = fs.existsSync(path.join(serverRoot, "config.json"))
  ? path.join(serverRoot, "config.json")
  : path.join(serverRoot, "config.example.json");

const rawConfig = JSON.parse(fs.readFileSync(configPath, "utf-8"));

// 호스트와 포트는 환경변수를 우선하고, 없으면 설정 파일 또는 기본값을 사용합니다.
const publicHost = process.env.PUBLIC_HOST || "localhost";
const dashboardHost = process.env.DASHBOARD_HOST || rawConfig.dashboardIP || publicHost;
const port = Number(process.env.DASHBOARD_PORT || rawConfig.serverPort || 5000);
const detectorHost = process.env.DETECTOR_HOST || dashboardHost;
const detectorPort = Number(process.env.DETECTOR_PORT || rawConfig.detectorPort || 8888);
const frontendPort = Number(process.env.FRONTEND_PORT || 5173);

// 각 서비스 기본 URL은 환경변수로 덮어쓸 수 있고, 끝의 슬래시는 제거해 둡니다.
const detectorBaseUrl = (
  process.env.DETECTOR_BASE_URL || `http://${detectorHost}:${detectorPort}`
).replace(/\/+$/, "");

const dashboardBaseUrl = (
  process.env.DASHBOARD_BASE_URL || `http://${dashboardHost}:${port}`
).replace(/\/+$/, "");

const frontendBaseUrl = (
  process.env.FRONTEND_BASE_URL || `http://${publicHost}:${frontendPort}`
).replace(/\/+$/, "");

// 통합제어보드 연결 정보는 별도 환경변수로 관리합니다.
const controlBoardHost = process.env.CONTROL_BOARD_HOST || "";
const controlBoardPort = Number(process.env.CONTROL_BOARD_PORT || 0);
const controlBoardTimeoutMs = Number(process.env.CONTROL_BOARD_TIMEOUT_MS || 3000);

const jwtSecret = process.env.JWT_SECRET || "";
const jwtRefreshSecret = process.env.JWT_REFRESH_SECRET || "";

// 토큰 서명 비밀키가 없으면 서버 시작을 바로 중단합니다.
if (!jwtSecret) {
  throw new Error("JWT_SECRET 환경변수가 필요합니다.");
}

if (!jwtRefreshSecret) {
  throw new Error("JWT_REFRESH_SECRET 환경변수가 필요합니다.");
}

// 프론트 빌드 결과물 경로를 서버 정적 파일 제공용으로 보관합니다.
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
