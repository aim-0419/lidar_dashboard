// 시연/화면 확인용 실시간 데모 스트림.
// 실제 라이다 PC처럼 1초마다 POST /api/wrongway 로 정상 주행 snapshot을 보내서
// 메인 대시보드의 "현재 감지 객체"와 "라이다 수신 중" 상태가 계속 보이게 한다.
// 사용법: npm run demo:live  (Ctrl+C로 종료하면 몇 초 뒤 화면이 "수신 끊김"으로 바뀐다)
// 예시 데이터와 구분하기 위해 track_id는 DEMO-LIVE- 로 시작한다. 삭제는 npm run seed:demo -- --reset

const INTERVAL_MS = 1000;
const MIN_VEHICLES = 2;
const MAX_VEHICLES = 5;
const TARGET_URL =
  process.env.DEMO_LIVE_URL || `http://localhost:${process.env.DASHBOARD_PORT || 5000}/api/wrongway`;

const LIDARS = [
  { source: "lidar-pc-01", zoneId: "ROUNDABOUT-01", label: "01" },
  { source: "lidar-pc-02", zoneId: "ROUNDABOUT-02", label: "02" },
].map((lidar) => ({ ...lidar, vehicles: [], nextId: 1 }));

function randomBetween(min, max) {
  return min + Math.random() * (max - min);
}

function toKstIsoString(date) {
  const kst = new Date(date.getTime() + 9 * 60 * 60 * 1000);
  return `${kst.toISOString().slice(0, 23)}+09:00`;
}

function createVehicle(lidar) {
  const vehicle = {
    trackId: `DEMO-LIVE-${lidar.label}-${Date.now().toString(36)}-${lidar.nextId}`,
    speedKmh: randomBetween(18, 40),
    objectClass: Math.random() < 0.85 ? 1 : 2,
    // 몇 초 동안 회전교차로 안에 머물다 빠져나가는 차량을 흉내 낸다.
    remainingTicks: Math.round(randomBetween(6, 20)),
  };
  lidar.nextId += 1;
  return vehicle;
}

// 매 tick마다 차량 체류 시간을 줄이고, 나간 차량은 빼고 새 차량을 가끔 추가한다.
function updateVehicles(lidar) {
  lidar.vehicles = lidar.vehicles
    .map((vehicle) => ({
      ...vehicle,
      remainingTicks: vehicle.remainingTicks - 1,
      speedKmh: Math.min(Math.max(vehicle.speedKmh + randomBetween(-3, 3), 10), 50),
    }))
    .filter((vehicle) => vehicle.remainingTicks > 0);

  if (lidar.vehicles.length < MAX_VEHICLES && Math.random() < 0.35) {
    lidar.vehicles.push(createVehicle(lidar));
  }
  while (lidar.vehicles.length < MIN_VEHICLES) {
    lidar.vehicles.push(createVehicle(lidar));
  }
}

function createSnapshot(lidar) {
  const objects = lidar.vehicles.map((vehicle) => ({
    type: "normal-driving",
    zone_id: lidar.zoneId,
    track_id: vehicle.trackId,
    speed_kmh: Number(vehicle.speedKmh.toFixed(1)),
    speed_ms: Number((vehicle.speedKmh / 3.6).toFixed(2)),
    confidence: Number(randomBetween(0.86, 0.98).toFixed(2)),
    object_class: vehicle.objectClass,
    message: "정상 주행 (데모)",
  }));

  return {
    timestamp: toKstIsoString(new Date()),
    source: lidar.source,
    status: "normal-driving",
    total_objects: objects.length,
    moving_vehicle_count: objects.length,
    normal_moving_vehicle_count: objects.length,
    wrong_way_count: 0,
    processing_time_ms: Math.round(randomBetween(8, 25)),
    objects,
  };
}

async function sendSnapshot(lidar) {
  const response = await fetch(TARGET_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(createSnapshot(lidar)),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`${lidar.source} 전송 실패 (HTTP ${response.status}): ${body.slice(0, 200)}`);
  }
}

let tickCount = 0;
let isSending = false;

async function tick() {
  // 서버 응답이 늦으면 다음 tick을 건너뛰어 요청이 쌓이지 않게 한다.
  if (isSending) return;
  isSending = true;

  try {
    for (const lidar of LIDARS) {
      updateVehicles(lidar);
    }
    const results = await Promise.allSettled(LIDARS.map((lidar) => sendSnapshot(lidar)));
    for (const result of results) {
      if (result.status === "rejected") console.error(`[demo:live] ${result.reason.message}`);
    }

    tickCount += 1;
    if (tickCount % 10 === 1) {
      const counts = LIDARS.map((lidar) => `${lidar.zoneId} ${lidar.vehicles.length}대`).join(", ");
      console.log(`[demo:live] 전송 중 (${tickCount}회) - ${counts}`);
    }
  } finally {
    isSending = false;
  }
}

if (process.env.NODE_ENV === "production") {
  console.error("[demo:live] 운영 환경(NODE_ENV=production)에서는 실행할 수 없습니다.");
  process.exit(1);
}

console.log(`[demo:live] ${TARGET_URL} 로 1초마다 데모 snapshot을 보냅니다. 종료하려면 Ctrl+C`);
const timer = setInterval(tick, INTERVAL_MS);
void tick();

process.on("SIGINT", () => {
  clearInterval(timer);
  console.log("\n[demo:live] 종료했습니다. 몇 초 뒤 대시보드가 \"라이다 수신 끊김\"으로 바뀝니다.");
  process.exit(0);
});
