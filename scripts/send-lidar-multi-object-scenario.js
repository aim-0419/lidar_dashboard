const fs = require("fs");
const path = require("path");

const ROOT_ENV_PATH = path.resolve(__dirname, "../.env");

function readRootEnv() {
  if (!fs.existsSync(ROOT_ENV_PATH)) return {};

  return fs.readFileSync(ROOT_ENV_PATH, "utf8").split(/\r?\n/).reduce((values, line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) return values;
    const separator = trimmed.indexOf("=");
    values[trimmed.slice(0, separator).trim()] = trimmed.slice(separator + 1).trim().replace(/^['"]|['"]$/g, "");
    return values;
  }, {});
}

function parseArgs(argv) {
  const env = readRootEnv();
  const args = {
    baseUrl: env.WRONGWAY_TEST_BASE_URL || "http://localhost:5000",
    intervalMs: 1000,
    source: "lidar-pc-01",
    normalZoneId: "Z469",
    wrongwayZoneId: "Z455",
  };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    const next = argv[index + 1];
    if (token === "--base-url") args.baseUrl = next;
    else if (token === "--interval-ms") args.intervalMs = Number(next);
    else if (token === "--source") args.source = next;
    else if (token === "--normal-zone-id") args.normalZoneId = next;
    else if (token === "--wrongway-zone-id") args.wrongwayZoneId = next;
    else if (token === "--help") args.help = true;
    else throw new Error(`지원하지 않는 옵션입니다: ${token}`);

    if (token !== "--help") index += 1;
  }

  if (!Number.isFinite(args.intervalMs) || args.intervalMs < 0) {
    throw new Error("--interval-ms는 0 이상의 숫자여야 합니다.");
  }
  args.baseUrl = args.baseUrl.replace(/\/+$/, "");
  return args;
}

function printHelp() {
  console.log(`
라이다 다중 객체 시나리오 전송

npm run test:lidar-scenario -- --base-url http://서버IP:5000

옵션:
  --base-url URL
  --interval-ms N
  --source lidar-pc-01
  --normal-zone-id Z469
  --wrongway-zone-id Z455
`);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function toKstIsoString(date = new Date()) {
  const kstDate = new Date(date.getTime() + 9 * 60 * 60 * 1000);
  return kstDate.toISOString().replace("Z", "+09:00");
}

function createVehicle(trackId, type, zoneId, speedMs, options = {}) {
  const messageByType = {
    "normal-driving": "정주행",
    "wrong-way": "역주행 발생",
    "situation-ended": "역주행 상황 종료",
  };

  return {
    type,
    warning_level: type === "wrong-way" ? 1 : 0,
    confidence: options.confidence ?? (type === "wrong-way" ? 0.95 : 1),
    zone_id: zoneId,
    track_id: trackId,
    message: messageByType[type],
    speed_ms: speedMs,
    speed_kmh: speedMs * 3.6,
    object_class: 1,
    description: type === "normal-driving" ? "Normal" : type === "wrong-way" ? "Wrong-way detected" : "Situation ended",
  };
}

function createScenario(args) {
  // 실행마다 새로운 ID를 발급하되, 같은 차량은 시나리오가 끝날 때까지 같은 track_id를 유지한다.
  const runId = `${Date.now().toString(36)}-${Math.random().toString(16).slice(2, 8)}`;
  const ids = {
    normalA: `normal-${runId}-A`,
    normalB: `normal-${runId}-B`,
    normalC: `normal-${runId}-C`,
    normalD: `normal-${runId}-D`,
    wrongwayA: `wrongway-${runId}-A`,
    wrongwayB: `wrongway-${runId}-B`,
  };
  const normal = (id, speed) => createVehicle(id, "normal-driving", args.normalZoneId, speed);
  const wrongway = (id, speed) => createVehicle(id, "wrong-way", args.wrongwayZoneId, speed);
  const ended = (id) => createVehicle(id, "situation-ended", args.wrongwayZoneId, 0.5);

  return [
    { label: "정주행 차량 A 진입", objects: [normal(ids.normalA, 3.1)] },
    { label: "정주행 차량 B 추가 진입", objects: [normal(ids.normalA, 3.2), normal(ids.normalB, 2.7)] },
    { label: "정주행 차량 A/B 이동", objects: [normal(ids.normalA, 3.3), normal(ids.normalB, 2.8)] },
    { label: "정주행 차량 C 추가 진입", objects: [normal(ids.normalA, 3.4), normal(ids.normalB, 2.9), normal(ids.normalC, 2.5)] },
    { label: "정주행 3대와 역주행 A 최초 동시 감지", objects: [normal(ids.normalA, 3.5), normal(ids.normalB, 3), normal(ids.normalC, 2.6), wrongway(ids.wrongwayA, 2.8)] },
    { label: "정주행 A 이탈, 역주행 A 지속", objects: [normal(ids.normalB, 3.1), normal(ids.normalC, 2.7), wrongway(ids.wrongwayA, 2.9)] },
    { label: "정주행과 역주행 A 지속", objects: [normal(ids.normalB, 3.2), wrongway(ids.wrongwayA, 3)] },
    { label: "두 번째 역주행 B 추가 발생", objects: [normal(ids.normalB, 3.2), wrongway(ids.wrongwayA, 3.1), wrongway(ids.wrongwayB, 2.4)] },
    { label: "역주행 차량 2대 동시 지속", objects: [normal(ids.normalB, 3.3), wrongway(ids.wrongwayA, 3.1), wrongway(ids.wrongwayB, 2.5)] },
    { label: "역주행 A 종료, 역주행 B 지속", objects: [normal(ids.normalB, 3.4), ended(ids.wrongwayA), wrongway(ids.wrongwayB, 2.6)] },
    { label: "마지막 역주행 B 종료", objects: [normal(ids.normalB, 3.5), ended(ids.wrongwayB)] },
    { label: "상황 종료 후 정주행 B/D", objects: [normal(ids.normalB, 3.6), normal(ids.normalD, 2.9)] },
    { label: "정주행 B 이탈, D 이동", objects: [normal(ids.normalD, 3)] },
    { label: "감지 객체 없음 1초", objects: [] },
    { label: "감지 객체 없음 2초", objects: [] },
    { label: "감지 객체 없음 3초, 누락 track 비활성화", objects: [] },
  ];
}

function createSnapshot(args, step, timestamp) {
  const wrongWayCount = step.objects.filter((object) => object.type === "wrong-way").length;
  const situationEnded = step.objects.some((object) => object.type === "situation-ended");
  const normalCount = step.objects.filter((object) => object.type === "normal-driving").length;

  return {
    timestamp: toKstIsoString(timestamp),
    source: args.source,
    status: wrongWayCount > 0 ? "wrong-way" : situationEnded ? "situation-ended" : "normal-driving",
    total_objects: step.objects.length,
    moving_vehicle_count: step.objects.length,
    normal_moving_vehicle_count: normalCount,
    wrong_way_count: wrongWayCount,
    processing_time_ms: Number((6 + Math.random() * 4).toFixed(3)),
    objects: step.objects,
  };
}

async function postSnapshot(endpoint, payload) {
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const body = await response.json();
  if (!response.ok) throw new Error(`HTTP ${response.status}: ${JSON.stringify(body)}`);
  return { status: response.status, body };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) return printHelp();

  const endpoint = `${args.baseUrl}/api/wrongway`;
  const scenario = createScenario(args);
  const scenarioStartedAt = new Date();
  console.log(`라이다 다중 객체 시나리오 -> ${endpoint}`);
  console.log(`source=${args.source}, intervalMs=${args.intervalMs}, steps=${scenario.length}`);

  for (let index = 0; index < scenario.length; index += 1) {
    const step = scenario[index];
    // 빠른 테스트에서도 실제 1초 간격 데이터와 같은 DB 시간 흐름을 검증하도록 timestamp는 항상 1초씩 증가시킨다.
    const payload = createSnapshot(args, step, new Date(scenarioStartedAt.getTime() + index * 1000));
    const result = await postSnapshot(endpoint, payload);
    const summary = result.body.summary || {};
    console.log(
      `[${String(index + 1).padStart(2, "0")}/${scenario.length}] HTTP ${result.status} ${step.label}`,
      `objects=${payload.objects.length}, created=${summary.tracksCreated || 0}, updated=${summary.tracksUpdated || 0}, events=${summary.eventsStored || 0}, inactive=${summary.tracksDeactivated || 0}`,
    );
    if (index < scenario.length - 1) await sleep(args.intervalMs);
  }

  console.log("시나리오 전송 완료");
}

main().catch((error) => {
  console.error("라이다 다중 객체 시나리오 전송 실패");
  console.error(error);
  process.exit(1);
});
