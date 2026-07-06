const fs = require("fs");
const path = require("path");

const DEFAULT_BASE_URL = "http://localhost:5000";
const CONFIG_PATH = path.join(__dirname, "wrongway-test.config.json");
const ENV_PATH = path.resolve(__dirname, "../.env");

function loadRootEnv() {
  // 테스트 스크립트는 서버 코드 밖에서 실행되므로 루트 .env를 직접 읽어 기본 목적지를 맞춘다.
  // dotenv 의존성을 새로 쓰지 않고, KEY=VALUE 형태만 가볍게 읽는다.
  if (!fs.existsSync(ENV_PATH)) return;

  const lines = fs.readFileSync(ENV_PATH, "utf-8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex === -1) continue;

    const key = trimmed.slice(0, separatorIndex).trim();
    const value = trimmed.slice(separatorIndex + 1).trim().replace(/^["']|["']$/g, "");

    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

loadRootEnv();

function getDefaultBaseUrl() {
  // 기본 목적지는 테스트 스크립트 전용 Base URL을 우선 사용한다.
  // 서버 실행용 PUBLIC_HOST와 "요청을 보낼 대상"은 다를 수 있어 값을 분리한다.
  if (process.env.WRONGWAY_TEST_BASE_URL) return process.env.WRONGWAY_TEST_BASE_URL;

  const host = process.env.PUBLIC_HOST || "localhost";
  const port = process.env.DASHBOARD_PORT || "5000";
  return `http://${host}:${port}`;
}

function readConfigFile() {
  // 현장/내부망 테스트 값은 매번 긴 명령어로 쓰기 번거로워서 JSON 파일로 받을 수 있게 한다.
  // 실제 config 파일은 IP가 들어갈 수 있으므로 Git에 올리지 않고, example 파일만 공유한다.
  if (!fs.existsSync(CONFIG_PATH)) return {};

  const rawConfig = fs.readFileSync(CONFIG_PATH, "utf-8");
  return JSON.parse(rawConfig);
}

function createDefaultArgs() {
  return {
    baseUrl: process.env.WRONGWAY_BASE_URL || getDefaultBaseUrl() || DEFAULT_BASE_URL,
    scenario: "all",
    beforeNormalCount: 10,
    afterNormalCount: 10,
    intervalMs: 1000,
    afterWrongwayDelayMs: 10000,
    normalTrackId: "script-normal-track-001",
    wrongwayTrackId: "script-wrongway-track-001",
    normalZoneId: "Z261",
    wrongwayZoneId: "Z327",
    duplicateWrongway: true,
    help: false,
  };
}

function normalizeArgs(args) {
  const normalized = { ...args };

  normalized.baseUrl = String(normalized.baseUrl || DEFAULT_BASE_URL).replace(/\/+$/, "");
  normalized.beforeNormalCount = Number.isFinite(Number(normalized.beforeNormalCount)) && Number(normalized.beforeNormalCount) > 0
    ? Math.floor(Number(normalized.beforeNormalCount))
    : 10;
  normalized.afterNormalCount = Number.isFinite(Number(normalized.afterNormalCount)) && Number(normalized.afterNormalCount) > 0
    ? Math.floor(Number(normalized.afterNormalCount))
    : 10;
  normalized.intervalMs = Number.isFinite(Number(normalized.intervalMs)) && Number(normalized.intervalMs) >= 0
    ? Math.floor(Number(normalized.intervalMs))
    : 1000;
  normalized.afterWrongwayDelayMs = Number.isFinite(Number(normalized.afterWrongwayDelayMs)) && Number(normalized.afterWrongwayDelayMs) >= 0
    ? Math.floor(Number(normalized.afterWrongwayDelayMs))
    : 10000;
  normalized.duplicateWrongway = normalized.duplicateWrongway !== false;

  return normalized;
}

function parseArgs(argv) {
  const fileConfig = readConfigFile();
  const args = {
    ...createDefaultArgs(),
    ...fileConfig,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    const next = argv[index + 1];

    if (token === "--help" || token === "-h") {
      args.help = true;
      continue;
    }

    if (token === "--base-url") {
      args.baseUrl = next || args.baseUrl;
      index += 1;
      continue;
    }

    if (token === "--scenario") {
      args.scenario = next || args.scenario;
      index += 1;
      continue;
    }

    if (token === "--normal-count") {
      args.beforeNormalCount = Number(next || args.beforeNormalCount);
      args.afterNormalCount = Number(next || args.afterNormalCount);
      index += 1;
      continue;
    }

    if (token === "--before-normal-count") {
      args.beforeNormalCount = Number(next || args.beforeNormalCount);
      index += 1;
      continue;
    }

    if (token === "--after-normal-count") {
      args.afterNormalCount = Number(next || args.afterNormalCount);
      index += 1;
      continue;
    }

    if (token === "--interval-ms") {
      args.intervalMs = Number(next || args.intervalMs);
      index += 1;
      continue;
    }

    if (token === "--after-wrongway-delay-ms") {
      args.afterWrongwayDelayMs = Number(next || args.afterWrongwayDelayMs);
      index += 1;
      continue;
    }

    if (token === "--normal-track-id") {
      args.normalTrackId = next || args.normalTrackId;
      index += 1;
      continue;
    }

    if (token === "--wrongway-track-id") {
      args.wrongwayTrackId = next || args.wrongwayTrackId;
      index += 1;
      continue;
    }

    if (token === "--normal-zone-id") {
      args.normalZoneId = next || args.normalZoneId;
      index += 1;
      continue;
    }

    if (token === "--wrongway-zone-id") {
      args.wrongwayZoneId = next || args.wrongwayZoneId;
      index += 1;
      continue;
    }

    if (token === "--no-duplicate-wrongway") {
      args.duplicateWrongway = false;
      continue;
    }

    if (!token.startsWith("--")) {
      // 기존 사용법인 `npm run test:wrongway-samples -- http://서버IP:5000`도 계속 지원한다.
      args.baseUrl = token;
    }
  }

  return normalizeArgs(args);
}

function printHelp() {
  console.log(`
wrongway sample sender

사용 예시:
  npm run test:wrongway-samples
  copy scripts\\wrongway-test.config.example.json scripts\\wrongway-test.config.json
  npm run test:wrongway-samples -- http://192.168.0.20:5000
  npm run test:wrongway-samples -- --base-url http://192.168.0.20:5000 --before-normal-count 30 --after-normal-count 30
  npm run test:wrongway-samples -- --scenario normal --normal-count 60
  npm run test:wrongway-samples -- --scenario wrongway --wrongway-track-id laptop-wrongway-001

옵션:
  --base-url URL               요청을 보낼 백엔드 주소
  --scenario all|normal|wrongway
  --normal-count N             역주행 전/후 정주행 전송 횟수를 같은 값으로 설정
  --before-normal-count N      역주행 전 정주행 전송 횟수
  --after-normal-count N       역주행 후 정주행 전송 횟수
  --interval-ms N              정주행 전송 간격(ms)
  --after-wrongway-delay-ms N  역주행 후 정주행 재개 전 대기 시간(ms)
  --normal-track-id ID         정주행 track_id
  --wrongway-track-id ID       역주행 track_id
  --normal-zone-id ID          정주행 zone_id
  --wrongway-zone-id ID        역주행 zone_id
  --no-duplicate-wrongway      역주행 중복 전송 생략

설정 파일:
  scripts/wrongway-test.config.json 값이 있으면 기본값으로 사용한다.
  설정 파일이 없으면 루트 .env의 WRONGWAY_TEST_BASE_URL을 우선 사용한다.
  명령어 옵션을 함께 쓰면 설정 파일 값보다 명령어 옵션이 우선한다.
`);
}

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function toKstIsoString(date = new Date()) {
  // 라이다 PC 예시와 같은 +09:00 형태로 테스트 시간을 만든다.
  const kstDate = new Date(date.getTime() + 9 * 60 * 60 * 1000);
  return kstDate.toISOString().replace("Z", "+09:00");
}

function createNormalPayload(sequence, args) {
  // 같은 track_id를 반복 전송해서 VehicleTrack upsert가 update로 동작하는지 확인한다.
  const speedMs = 0.5 + sequence * 0.05;
  return {
    type: "normal-driving",
    warning_level: 0,
    timestamp: toKstIsoString(),
    confidence: 1.0,
    zone_id: args.normalZoneId,
    track_id: args.normalTrackId,
    message: "정주행",
    speed_ms: speedMs,
    speed_kmh: speedMs * 3.6,
    object_class: 1,
    description: "Normal",
    consecutive_count: 0,
    is_confirmed: false,
  };
}

function createWrongWayPayload(args) {
  // 같은 payload를 두 번 보내면 두 번째 요청은 중복 이벤트로 처리되어야 한다.
  return {
    type: "wrong-way-level-1",
    warning_level: 1,
    timestamp: toKstIsoString(),
    confidence: 0.95,
    zone_id: args.wrongwayZoneId,
    track_id: args.wrongwayTrackId,
    message: "역주행 1차 감지",
    speed_ms: 2.835765050970876,
    speed_kmh: 10.208754183495154,
    object_class: 6,
    description: "Wrong-way driving detected (Heading and Path Confirmed)",
    consecutive_count: 3,
    is_confirmed: true,
  };
}

async function postPayload(endpoint, label, payload) {
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const result = await response.json();
  console.log(`[${label}] HTTP ${response.status}`);
  console.log(JSON.stringify(result, null, 2));
  return result;
}

async function sendNormalSequence(endpoint, args, count, labelPrefix) {
  for (let index = 1; index <= count; index += 1) {
    await postPayload(
      endpoint,
      `${labelPrefix} normal-driving ${index}/${count}`,
      createNormalPayload(index, args),
    );

    if (index < count) await sleep(args.intervalMs);
  }
}

async function sendWrongwaySequence(endpoint, args) {
  const wrongWayPayload = createWrongWayPayload(args);
  await postPayload(endpoint, "wrong-way-level-1 first", wrongWayPayload);

  if (args.duplicateWrongway) {
    await postPayload(endpoint, "wrong-way-level-1 duplicated", wrongWayPayload);
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    printHelp();
    return;
  }

  const endpoint = `${args.baseUrl}/api/wrongway`;
  console.log(`wrongway sample sender -> ${endpoint}`);
  console.log(`configFile=${fs.existsSync(CONFIG_PATH) ? CONFIG_PATH : "not found"}`);
  console.log(`scenario=${args.scenario}, beforeNormalCount=${args.beforeNormalCount}, afterNormalCount=${args.afterNormalCount}`);
  console.log(`intervalMs=${args.intervalMs}, afterWrongwayDelayMs=${args.afterWrongwayDelayMs}`);
  console.log(`normalTrackId=${args.normalTrackId}, wrongwayTrackId=${args.wrongwayTrackId}`);

  if (!["all", "normal", "wrongway"].includes(args.scenario)) {
    throw new Error(`지원하지 않는 scenario입니다: ${args.scenario}`);
  }

  if (args.scenario === "normal") {
    await sendNormalSequence(endpoint, args, args.beforeNormalCount, "before");
    return;
  }

  if (args.scenario === "wrongway") {
    await sendWrongwaySequence(endpoint, args);
    return;
  }

  await sendNormalSequence(endpoint, args, args.beforeNormalCount, "before");
  await sendWrongwaySequence(endpoint, args);

  console.log(`waiting ${args.afterWrongwayDelayMs}ms before sending normal-driving again...`);
  await sleep(args.afterWrongwayDelayMs);
  await sendNormalSequence(endpoint, args, args.afterNormalCount, "after");
}

main().catch((error) => {
  console.error("wrongway sample sender failed");
  console.error(error);
  process.exit(1);
});
