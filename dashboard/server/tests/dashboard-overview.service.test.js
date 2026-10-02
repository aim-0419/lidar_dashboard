const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { test } = require("node:test");
const vm = require("node:vm");

const NOW = new Date("2026-09-30T07:00:00.000Z"); // KST 2026-09-30 16:00

function secondsAgo(seconds) {
  return new Date(NOW.getTime() - seconds * 1000);
}

function createFakePrisma({ zones = [], stats = [], tracks = [] } = {}) {
  const calls = { dailyStatWhere: null, trackWhere: null };

  const prisma = {
    zone: {
      findMany: async () => zones,
    },
    dailyTrafficStat: {
      findMany: async ({ where }) => {
        calls.dailyStatWhere = where;
        return stats.filter((stat) => stat.statDate.getTime() === where.statDate.getTime());
      },
    },
    vehicleTrack: {
      findMany: async ({ where }) => {
        calls.trackWhere = where;
        return tracks.filter((track) => track.isActive && track.updatedAt >= where.updatedAt.gte);
      },
    },
  };

  return { prisma, calls };
}

function loadOverviewService(prisma) {
  const filename = path.resolve(__dirname, "../src/domains/dashboard-overview/dashboardOverview.service.js");
  const loaded = { exports: {} };

  vm.runInNewContext(fs.readFileSync(filename, "utf8"), {
    module: loaded,
    exports: loaded.exports,
    require(name) {
      if (name === "../../prisma/client") return { prisma };
      throw new Error(`Unexpected dependency: ${name}`);
    },
  }, { filename });

  return loaded.exports;
}

function createZone(id, zoneCode, lidarLastSeenAt) {
  return {
    id,
    zoneCode,
    name: zoneCode === "ROUNDABOUT-01" ? "회전교차로 1" : "회전교차로 2",
    devices: [{ deviceCode: `LIDAR-${id}`, lastSeenAt: lidarLastSeenAt }],
  };
}

function createTrack(overrides) {
  return {
    trackId: "track-001",
    zoneId: "zone-1",
    externalZoneId: "Z469",
    lastEventType: "normal-driving",
    lastWarningLevel: 0,
    lastConfidence: 0.98,
    lastSpeedKmh: 25.4,
    objectClass: 1,
    lastSeenAt: secondsAgo(1),
    updatedAt: secondsAgo(1),
    isActive: true,
    ...overrides,
  };
}

test("오늘 통계를 구역별로 합산하고 전체 합계를 계산한다", async () => {
  const today = new Date(Date.UTC(2026, 8, 30));
  const yesterday = new Date(Date.UTC(2026, 8, 29));
  const { prisma } = createFakePrisma({
    zones: [createZone("zone-1", "ROUNDABOUT-01", secondsAgo(1)), createZone("zone-2", "ROUNDABOUT-02", secondsAgo(1))],
    stats: [
      { statDate: today, zoneId: "zone-1", totalVehicleCount: 10, wrongWayCount: 1, pedestrianEnteredCount: 2 },
      { statDate: today, zoneId: "zone-1", totalVehicleCount: 5, wrongWayCount: 0, pedestrianEnteredCount: 1 },
      { statDate: today, zoneId: "zone-2", totalVehicleCount: 7, wrongWayCount: 2, pedestrianEnteredCount: 0 },
      { statDate: yesterday, zoneId: "zone-1", totalVehicleCount: 99, wrongWayCount: 9, pedestrianEnteredCount: 9 },
    ],
  });
  const service = loadOverviewService(prisma);

  const overview = await service.getDashboardOverview({ now: NOW });

  assert.equal(overview.statDate, "2026-09-30");
  assert.deepEqual({ ...overview.zones[0].kpis }, {
    todayVehicleCount: 15,
    todayWrongWayCount: 1,
    todayPedestrianCount: 3,
    activeObjectCount: 0,
  });
  assert.equal(overview.totals.todayVehicleCount, 22);
  assert.equal(overview.totals.todayWrongWayCount, 3);
  assert.equal(overview.totals.todayPedestrianCount, 3);
});

test("KST 자정 직후에는 새 날짜의 통계를 조회한다", async () => {
  const { prisma, calls } = createFakePrisma({ zones: [] });
  const service = loadOverviewService(prisma);

  // UTC 15:30은 KST 다음날 00:30이다.
  const overview = await service.getDashboardOverview({ now: new Date("2026-09-30T15:30:00.000Z") });

  assert.equal(overview.statDate, "2026-10-01");
  assert.equal(calls.dailyStatWhere.statDate.toISOString(), "2026-10-01T00:00:00.000Z");
});

test("최근 5초 안에 갱신된 활성 트랙만 현재 감지 객체로 반환한다", async () => {
  const { prisma, calls } = createFakePrisma({
    zones: [createZone("zone-1", "ROUNDABOUT-01", secondsAgo(1))],
    tracks: [
      createTrack({ trackId: "fresh", updatedAt: secondsAgo(1) }),
      createTrack({ trackId: "stale", updatedAt: secondsAgo(30) }),
      createTrack({ trackId: "ended", isActive: false }),
    ],
  });
  const service = loadOverviewService(prisma);

  const overview = await service.getDashboardOverview({ now: NOW });

  assert.equal(calls.trackWhere.updatedAt.gte.toISOString(), secondsAgo(5).toISOString());
  // vm 컨텍스트에서 만든 배열은 prototype이 달라 Array.from으로 현재 컨텍스트 배열로 바꿔 비교한다.
  assert.deepEqual(Array.from(overview.zones[0].activeObjects, (item) => item.trackId), ["fresh"]);
  assert.equal(overview.zones[0].kpis.activeObjectCount, 1);
  assert.equal(overview.totals.activeObjectCount, 1);
});

test("라이다 마지막 수신 시각으로 수신 중과 수신 끊김을 구분한다", async () => {
  const { prisma } = createFakePrisma({
    zones: [
      createZone("zone-1", "ROUNDABOUT-01", secondsAgo(2)),
      createZone("zone-2", "ROUNDABOUT-02", secondsAgo(60)),
      { id: "zone-3", zoneCode: "ROUNDABOUT-03", name: "미설치", devices: [{ deviceCode: "LIDAR-3", lastSeenAt: null }] },
    ],
  });
  const service = loadOverviewService(prisma);

  const overview = await service.getDashboardOverview({ now: NOW });

  assert.equal(overview.zones[0].lidar.receiving, true);
  assert.equal(overview.zones[1].lidar.receiving, false);
  assert.equal(overview.zones[1].lidar.lastReceivedAt.toISOString(), secondsAgo(60).toISOString());
  assert.equal(overview.zones[2].lidar.receiving, false);
  assert.equal(overview.zones[2].lidar.lastReceivedAt, null);
});

test("데이터가 없으면 0과 빈 목록을 반환한다", async () => {
  const { prisma } = createFakePrisma({ zones: [createZone("zone-1", "ROUNDABOUT-01", null)] });
  const service = loadOverviewService(prisma);

  const overview = await service.getDashboardOverview({ now: NOW });

  assert.equal(overview.totals.todayVehicleCount, 0);
  assert.equal(overview.totals.activeObjectCount, 0);
  assert.equal(overview.zones[0].activeObjects.length, 0);
  assert.equal(overview.staleAfterMs, 5000);
});
