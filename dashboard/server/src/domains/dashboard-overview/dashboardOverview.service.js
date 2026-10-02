const { prisma } = require("../../prisma/client");

// 라이다 PC는 1초마다 snapshot을 보내므로, 이 시간 동안 수신이 없으면 끊김으로 본다.
// 차량 목록도 같은 기준으로 최근에 갱신된 트랙만 "현재 감지 객체"로 표시한다.
const LIDAR_STALE_AFTER_MS = 5000;
const ACTIVE_OBJECT_LIMIT = 500;
const LIDAR_DEVICE_TYPE = "LIDAR_PC";

// 통계 테이블은 KST 날짜 기준으로 쌓이므로 조회 날짜도 같은 기준으로 계산한다.
function toKstStatDate(date) {
  const kst = new Date(date.getTime() + 9 * 60 * 60 * 1000);
  return new Date(Date.UTC(kst.getUTCFullYear(), kst.getUTCMonth(), kst.getUTCDate()));
}

function createEmptyKpis() {
  return {
    todayVehicleCount: 0,
    todayWrongWayCount: 0,
    todayPedestrianCount: 0,
    activeObjectCount: 0,
  };
}

// 오늘 통계 행을 구역별로 합산한다. 한 구역에 라이다 PC가 여러 대면 행이 여러 개일 수 있다.
async function getTodayKpisByZone(statDate) {
  const stats = await prisma.dailyTrafficStat.findMany({ where: { statDate } });
  const byZone = new Map();

  for (const stat of stats) {
    const kpis = byZone.get(stat.zoneId) || createEmptyKpis();
    kpis.todayVehicleCount += stat.totalVehicleCount;
    kpis.todayWrongWayCount += stat.wrongWayCount;
    kpis.todayPedestrianCount += stat.pedestrianEnteredCount;
    byZone.set(stat.zoneId, kpis);
  }

  return byZone;
}

// 라이다 PC의 timestamp가 아니라 서버가 저장한 updatedAt으로 판단해 장비 시계 오차의 영향을 받지 않는다.
async function getActiveObjectsByZone(staleBefore) {
  const tracks = await prisma.vehicleTrack.findMany({
    where: { isActive: true, updatedAt: { gte: staleBefore } },
    orderBy: { updatedAt: "desc" },
    take: ACTIVE_OBJECT_LIMIT,
  });
  const byZone = new Map();

  for (const track of tracks) {
    if (!track.zoneId) continue;
    const objects = byZone.get(track.zoneId) || [];
    objects.push({
      trackId: track.trackId,
      type: track.lastEventType,
      warningLevel: track.lastWarningLevel,
      confidence: track.lastConfidence,
      externalZoneId: track.externalZoneId,
      speedKmh: track.lastSpeedKmh,
      objectClass: track.objectClass,
      lastSeenAt: track.lastSeenAt,
    });
    byZone.set(track.zoneId, objects);
  }

  return byZone;
}

// 구역에 연결된 라이다 PC 중 가장 최근 수신 시각을 기준으로 수신 상태를 판단한다.
function createLidarStatus(devices, staleBefore) {
  const lastReceivedAt = devices
    .map((device) => device.lastSeenAt)
    .filter(Boolean)
    .reduce((latest, value) => (!latest || value > latest ? value : latest), null);

  return {
    deviceCodes: devices.map((device) => device.deviceCode),
    lastReceivedAt,
    receiving: Boolean(lastReceivedAt && lastReceivedAt >= staleBefore),
  };
}

// 메인 대시보드의 KPI, 현재 감지 객체, 라이다 수신 상태를 구역별로 한 번에 반환한다.
async function getDashboardOverview({ now = new Date() } = {}) {
  const statDate = toKstStatDate(now);
  const staleBefore = new Date(now.getTime() - LIDAR_STALE_AFTER_MS);

  const [zones, kpisByZone, objectsByZone] = await Promise.all([
    prisma.zone.findMany({
      orderBy: { createdAt: "asc" },
      include: {
        devices: {
          where: { deviceType: LIDAR_DEVICE_TYPE },
          select: { deviceCode: true, lastSeenAt: true },
        },
      },
    }),
    getTodayKpisByZone(statDate),
    getActiveObjectsByZone(staleBefore),
  ]);

  const totals = createEmptyKpis();
  const zoneItems = zones.map((zone) => {
    const activeObjects = objectsByZone.get(zone.id) || [];
    const kpis = { ...(kpisByZone.get(zone.id) || createEmptyKpis()), activeObjectCount: activeObjects.length };

    totals.todayVehicleCount += kpis.todayVehicleCount;
    totals.todayWrongWayCount += kpis.todayWrongWayCount;
    totals.todayPedestrianCount += kpis.todayPedestrianCount;
    totals.activeObjectCount += kpis.activeObjectCount;

    return {
      zoneCode: zone.zoneCode,
      name: zone.name,
      kpis,
      lidar: createLidarStatus(zone.devices, staleBefore),
      activeObjects,
    };
  });

  return {
    generatedAt: now.toISOString(),
    statDate: statDate.toISOString().slice(0, 10),
    staleAfterMs: LIDAR_STALE_AFTER_MS,
    totals,
    zones: zoneItems,
  };
}

module.exports = { getDashboardOverview, LIDAR_STALE_AFTER_MS };
