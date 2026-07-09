const fs = require("fs");
const path = require("path");

const DEFAULT_BASE_URL = "http://localhost:5000";
const CONFIG_PATH = path.join(__dirname, "wrongway-test.config.json");
const ENV_PATH = path.resolve(__dirname, "../.env");

function loadRootEnv() {
  // 테스트 스크립트는 서버 코드 밖에서 실행되므로 루트 .env를 직접 읽어 기본 대상 서버를 맞춘다.
  // 새 의존성을 추가하지 않기 위해 KEY=VALUE 형태만 가볍게 파싱한다.
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
  // 테스트 요청을 보낼 서버 주소는 WRONGWAY_TEST_BASE_URL을 최우선으로 사용한다.
  // 값이 없으면 PUBLIC_HOST와 DASHBOARD_PORT를 조합해 개발 기본값을 만든다.
  if (process.env.WRONGWAY_TEST_BASE_URL) return process.env.WRONGWAY_TEST_BASE_URL;

  const host = process.env.PUBLIC_HOST || "localhost";
  const port = process.env.DASHBOARD_PORT || "5000";
  return `http://${host}:${port}`;
}

function readConfigFile() {
  // 현장/내부망 테스트 값은 config 파일로도 관리할 수 있다.
  // 실제 config 파일은 IP가 들어갈 수 있으므로 Git에 올리지 않고 example만 공유한다.
  if (!fs.existsSync(CONFIG_PATH)) return {};

  const rawConfig = fs.readFileSync(CONFIG_PATH, "utf-8");
  return JSON.parse(rawConfig);
}

function createRunId(date = new Date()) {
  // 실행 단위 ID를 track_id에 넣어 같은 스크립트를 다시 돌려도 새 차량 객체처럼 보이게 한다.
  const kstDate = new Date(date.getTime() + 9 * 60 * 60 * 1000);
  const stamp = kstDate
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\..+$/, "")
    .replace("T", "-");
  const suffix = Math.random().toString(16).slice(2, 6);
  return `${stamp}-${suffix}`;
}

function padNumber(value, size = 3) {
  return String(value).padStart(size, "0");
}

function createDefaultArgs() {
  return {
    baseUrl: process.env.WRONGWAY_BASE_URL || getDefaultBaseUrl() || DEFAULT_BASE_URL,
    scenario: "all",
    beforeNormalCount: 10,
    afterNormalCount: 10,
    normalVehiclesBefore: null,
    normalVehiclesAfter: null,
    samplesPerVehicle: 3,
    intervalMs: 1000,
    afterWrongwayDelayMs: 10000,
    randomTrackIds: false,
    runId: "",
    normalTrackId: "script-normal-track-001",
    wrongwayTrackId: "script-wrongway-track-001",
    normalZoneId: "Z261",
    wrongwayZoneId: "Z327",
    duplicateWrongway: true,
    help: false,
  };
}

function normalizePositiveInteger(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? Math.floor(number) : fallback;
}

function normalizeNonNegativeInteger(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? Math.floor(number) : fallback;
}

function normalizeArgs(args) {
  const normalized = { ...args };

  normalized.baseUrl = String(normalized.baseUrl || DEFAULT_BASE_URL).replace(/\/+$/, "");
  normalized.beforeNormalCount = normalizePositiveInteger(normalized.beforeNormalCount, 10);
  normalized.afterNormalCount = normalizePositiveInteger(normalized.afterNormalCount, 10);
  normalized.samplesPerVehicle = normalizePositiveInteger(normalized.samplesPerVehicle, 3);
  normalized.intervalMs = normalizeNonNegativeInteger(normalized.intervalMs, 1000);
  normalized.afterWrongwayDelayMs = normalizeNonNegativeInteger(
    normalized.afterWrongwayDelayMs,
    10000,
  );
  normalized.normalVehiclesBefore = normalized.normalVehiclesBefore == null
    ? null
    : normalizePositiveInteger(normalized.normalVehiclesBefore, 3);
  normalized.normalVehiclesAfter = normalized.normalVehiclesAfter == null
    ? null
    : normalizePositiveInteger(normalized.normalVehiclesAfter, 3);
  normalized.randomTrackIds = normalized.randomTrackIds === true;
  normalized.duplicateWrongway = normalized.duplicateWrongway !== false;
  normalized.runId = String(normalized.runId || "").trim();

  if (normalized.randomTrackIds && !normalized.runId) {
    normalized.runId = createRunId();
  }

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
      args.normalVehiclesBefore = null;
      args.normalVehiclesAfter = null;
      index += 1;
      continue;
    }

    if (token === "--before-normal-count") {
      args.beforeNormalCount = Number(next || args.beforeNormalCount);
      args.normalVehiclesBefore = null;
      index += 1;
      continue;
    }

    if (token === "--after-normal-count") {
      args.afterNormalCount = Number(next || args.afterNormalCount);
      args.normalVehiclesAfter = null;
      index += 1;
      continue;
    }

    if (token === "--normal-vehicles-before") {
      args.normalVehiclesBefore = Number(next || args.normalVehiclesBefore);
      index += 1;
      continue;
    }

    if (token === "--normal-vehicles-after") {
      args.normalVehiclesAfter = Number(next || args.normalVehiclesAfter);
      index += 1;
      continue;
    }

    if (token === "--normal-vehicles") {
      args.normalVehiclesBefore = Number(next || args.normalVehiclesBefore);
      args.normalVehiclesAfter = Number(next || args.normalVehiclesAfter);
      index += 1;
      continue;
    }

    if (token === "--samples-per-vehicle") {
      args.samplesPerVehicle = Number(next || args.samplesPerVehicle);
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

    if (token === "--random-track-ids") {
      args.randomTrackIds = true;
      continue;
    }

    if (token === "--run-id") {
      args.runId = next || args.runId;
      index += 1;
      continue;
    }

    if (token === "--normal-track-id") {
      args.normalTrackId = next || args.normalTrackId;
      args.randomTrackIds = false;
      index += 1;
      continue;
    }

    if (token === "--wrongway-track-id") {
      args.wrongwayTrackId = next || args.wrongwayTrackId;
      args.randomTrackIds = false;
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
      // 기존 사용법인 `npm run test:wrongway-samples -- http://서버IP:5000`을 계속 지원한다.
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
  npm run test:wrongway-samples -- --base-url http://192.168.0.20:5000 --random-track-ids
  npm run test:wrongway-samples -- --scenario normal --normal-vehicles 5 --samples-per-vehicle 3 --random-track-ids
  npm run test:wrongway-samples -- --scenario wrongway --random-track-ids

옵션:
  --base-url URL                  요청을 보낼 백엔드 주소
  --scenario all|normal|wrongway
  --normal-count N                정주행 전/후 전송 횟수를 같은 값으로 설정
  --before-normal-count N         역주행 전 정주행 전송 횟수
  --after-normal-count N          역주행 후 정주행 전송 횟수
  --normal-vehicles N             정주행 전/후 차량 객체 수를 같은 값으로 설정
  --normal-vehicles-before N      역주행 전 정주행 차량 객체 수
  --normal-vehicles-after N       역주행 후 정주행 차량 객체 수
  --samples-per-vehicle N         차량 객체 1대당 반복 전송 횟수
  --interval-ms N                 정주행 전송 간격(ms)
  --after-wrongway-delay-ms N     역주행 후 정주행 재개 전 대기 시간(ms)
  --random-track-ids              실행마다 runId 기반 track_id 자동 생성
  --run-id ID                     random track_id에 사용할 실행 ID
  --normal-track-id ID            정주행 track_id 직접 지정
  --wrongway-track-id ID          역주행 track_id 직접 지정
  --normal-zone-id ID             정주행 zone_id
  --wrongway-zone-id ID           역주행 zone_id
  --no-duplicate-wrongway         역주행 중복 전송 생략

설정 파일:
  scripts/wrongway-test.config.json 값이 있으면 기본값으로 사용한다.
  설정 파일이 없으면 루트 .env의 WRONGWAY_TEST_BASE_URL을 우선 사용한다.
  명령어 옵션은 설정 파일보다 우선 적용된다.
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

function buildNormalTrackId(args, groupLabel, vehicleIndex) {
  // 다중 차량 시나리오는 차량마다 track_id가 달라야 DB에서 여러 객체 흐름을 확인할 수 있다.
  // 랜덤 모드가 아니어도 normalTrackId 뒤에 차량 순번을 붙여 서로 다른 차량으로 만든다.
  if (!args.randomTrackIds) {
    return `${args.normalTrackId}-${groupLabel}-veh-${padNumber(vehicleIndex)}`;
  }

  return `normal-${args.runId}-${groupLabel}-veh-${padNumber(vehicleIndex)}`;
}

function buildWrongwayTrackId(args) {
  // 역주행은 중복 방지 테스트를 위해 한 실행 안에서는 같은 track_id를 재사용한다.
  if (!args.randomTrackIds) return args.wrongwayTrackId;
  return `wrongway-${args.runId}-veh-001`;
}

function createNormalPayload(sequence, args, trackId) {
  // 같은 차량 객체는 track_id를 유지하고 sequence/속도만 바꿔 VehicleTrack upsert 흐름을 확인한다.
  const speedMs = 0.5 + sequence * 0.05 + Math.random() * 0.05;
  return {
    type: "normal-driving",
    warning_level: 0,
    timestamp: toKstIsoString(),
    confidence: 1.0,
    zone_id: args.normalZoneId,
    track_id: trackId,
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
    track_id: buildWrongwayTrackId(args),
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

async function sendNormalVehicle(endpoint, args, trackId, samplesPerVehicle, labelPrefix, vehicleIndex) {
  for (let sampleIndex = 1; sampleIndex <= samplesPerVehicle; sampleIndex += 1) {
    const sequence = (vehicleIndex - 1) * samplesPerVehicle + sampleIndex;
    await postPayload(
      endpoint,
      `${labelPrefix} ${trackId} ${sampleIndex}/${samplesPerVehicle}`,
      createNormalPayload(sequence, args, trackId),
    );

    if (sampleIndex < samplesPerVehicle) await sleep(args.intervalMs);
  }
}

async function sendNormalSequence(endpoint, args, count, labelPrefix) {
  // 다중 차량 옵션이 없으면 기존처럼 같은 track_id로 count회 반복 전송한다.
  for (let index = 1; index <= count; index += 1) {
    await postPayload(
      endpoint,
      `${labelPrefix} normal-driving ${index}/${count}`,
      createNormalPayload(index, args, args.normalTrackId),
    );

    if (index < count) await sleep(args.intervalMs);
  }
}

async function sendNormalVehicleSequence(endpoint, args, vehicleCount, labelPrefix) {
  for (let vehicleIndex = 1; vehicleIndex <= vehicleCount; vehicleIndex += 1) {
    const trackId = buildNormalTrackId(args, labelPrefix, vehicleIndex);
    await sendNormalVehicle(
      endpoint,
      args,
      trackId,
      args.samplesPerVehicle,
      labelPrefix,
      vehicleIndex,
    );

    if (vehicleIndex < vehicleCount) await sleep(args.intervalMs);
  }
}

async function sendNormalBlock(endpoint, args, count, vehicleCount, labelPrefix) {
  if (vehicleCount == null) {
    await sendNormalSequence(endpoint, args, count, labelPrefix);
    return;
  }

  await sendNormalVehicleSequence(endpoint, args, vehicleCount, labelPrefix);
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
  console.log(`scenario=${args.scenario}, randomTrackIds=${args.randomTrackIds}, runId=${args.runId || "fixed"}`);
  console.log(`beforeNormalCount=${args.beforeNormalCount}, afterNormalCount=${args.afterNormalCount}`);
  console.log(`normalVehiclesBefore=${args.normalVehiclesBefore ?? "off"}, normalVehiclesAfter=${args.normalVehiclesAfter ?? "off"}, samplesPerVehicle=${args.samplesPerVehicle}`);
  console.log(`intervalMs=${args.intervalMs}, afterWrongwayDelayMs=${args.afterWrongwayDelayMs}`);
  console.log(`normalTrackId=${args.normalTrackId}, wrongwayTrackId=${args.wrongwayTrackId}`);

  if (!["all", "normal", "wrongway"].includes(args.scenario)) {
    throw new Error(`지원하지 않는 scenario입니다: ${args.scenario}`);
  }

  if (args.scenario === "normal") {
    await sendNormalBlock(
      endpoint,
      args,
      args.beforeNormalCount,
      args.normalVehiclesBefore,
      "before",
    );
    return;
  }

  if (args.scenario === "wrongway") {
    await sendWrongwaySequence(endpoint, args);
    return;
  }

  await sendNormalBlock(
    endpoint,
    args,
    args.beforeNormalCount,
    args.normalVehiclesBefore,
    "before",
  );
  await sendWrongwaySequence(endpoint, args);

  console.log(`waiting ${args.afterWrongwayDelayMs}ms before sending normal-driving again...`);
  await sleep(args.afterWrongwayDelayMs);
  await sendNormalBlock(
    endpoint,
    args,
    args.afterNormalCount,
    args.normalVehiclesAfter,
    "after",
  );
}

main().catch((error) => {
  console.error("wrongway sample sender failed");
  console.error(error);
  process.exit(1);
});
