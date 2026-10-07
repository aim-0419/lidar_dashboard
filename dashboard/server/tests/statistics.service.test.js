const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { test } = require("node:test");
const vm = require("node:vm");

const wrongwayConstants = require("../src/domains/wrongway/wrongway.constants");

// KST 시각을 UTC Date로 만든다. 예: kst(2026, 10, 2, 23, 30) → 2026-10-02 23:30 KST
function kst(year, month, date, hours = 0, minutes = 0) {
  return new Date(Date.UTC(year, month - 1, date, hours, minutes) - 9 * 60 * 60 * 1000);
}

function createFakePrisma({ rows = [], events = [] } = {}) {
  const calls = { eventWhere: null };

  const prisma = {
    trafficStatistic: {
      findMany: async () => rows,
    },
    trafficEvent: {
      findMany: async ({ where }) => {
        calls.eventWhere = where;
        return events;
      },
    },
  };

  return { prisma, calls };
}

function loadStatisticsService(prisma) {
  const filename = path.resolve(__dirname, "../src/domains/statistics/statistics.service.js");
  const loaded = { exports: {} };

  vm.runInNewContext(fs.readFileSync(filename, "utf8"), {
    module: loaded,
    exports: loaded.exports,
    require(name) {
      if (name === "../../prisma/client") return { prisma };
      if (name === "../wrongway/wrongway.constants") return wrongwayConstants;
      throw new Error(`Unexpected dependency: ${name}`);
    },
  }, { filename });

  return loaded.exports;
}

// 2026-10-01 ~ 2026-10-05 사용자 지정 기간(일 단위 버킷)
const CUSTOM_RANGE = { period: "custom", startDate: "2026-10-01", endDate: "2026-10-05" };

const ROWS = [
  { statDate: kst(2026, 10, 2), hourSlot: 10, totalVehicles: 100 },
  { statDate: kst(2026, 10, 3), hourSlot: 9, totalVehicles: 100 },
];

const EVENTS = [
  // KST 기준 10/02 23:30 → 10/02 버킷 (UTC로는 10/02 14:30)
  { eventType: "wrong-way", occurredAt: kst(2026, 10, 2, 23, 30), receivedAt: kst(2026, 10, 2, 23, 30) },
  // KST 기준 10/03 00:10 → 10/03 버킷 (UTC로는 아직 10/02)
  { eventType: "pedestrian-entered", occurredAt: kst(2026, 10, 3, 0, 10), receivedAt: kst(2026, 10, 3, 0, 10) },
  // occurredAt이 없으면 receivedAt 기준 → 10/04 버킷
  { eventType: "wrong-way", occurredAt: null, receivedAt: kst(2026, 10, 4, 9, 0) },
];

test("요약에 역주행/보행자 건수와 통과 차량 대비 역주행 비율을 계산한다", async () => {
  const { prisma } = createFakePrisma({ rows: ROWS, events: EVENTS });
  const service = loadStatisticsService(prisma);

  const result = await service.getStatisticsSummary({ ...CUSTOM_RANGE, siteId: "site-wolchulsan-rest-area" });

  assert.equal(result.summary.totalVehicles, 200);
  assert.equal(result.summary.wrongWayEvents, 2);
  assert.equal(result.summary.pedestrianCount, 1);
  assert.equal(result.summary.wrongWayRate, 1);
});

test("통과 차량이 없으면 역주행 비율은 0이다", async () => {
  const { prisma } = createFakePrisma({ rows: [], events: EVENTS });
  const service = loadStatisticsService(prisma);

  const result = await service.getStatisticsSummary(CUSTOM_RANGE);

  assert.equal(result.summary.totalVehicles, 0);
  assert.equal(result.summary.wrongWayEvents, 2);
  assert.equal(result.summary.wrongWayRate, 0);
});

test("그래프 버킷에 KST 날짜 기준으로 역주행/보행자 건수를 나눠 담는다", async () => {
  const { prisma } = createFakePrisma({ rows: ROWS, events: EVENTS });
  const service = loadStatisticsService(prisma);

  const result = await service.getTrafficSeries(CUSTOM_RANGE);
  const byLabel = Object.fromEntries(result.series.map((item) => [item.label, item]));

  assert.equal(result.bucketUnit, "day");
  assert.deepEqual(
    ["10/01", "10/02", "10/03", "10/04", "10/05"].map((label) => [
      byLabel[label].value,
      byLabel[label].wrongWay,
      byLabel[label].pedestrians,
    ]),
    [
      [0, 0, 0],
      [100, 1, 0],
      [100, 0, 1],
      [0, 1, 0],
      [0, 0, 0],
    ],
  );
  assert.equal(result.summary.wrongWayEvents, 2);
  assert.equal(result.summary.pedestrianCount, 1);
});

test("이벤트 조회 조건에 오탐 제외, 현장/구역 필터, 발생 시각 범위를 넣는다", async () => {
  const { prisma, calls } = createFakePrisma();
  const service = loadStatisticsService(prisma);

  await service.getStatisticsSummary({ ...CUSTOM_RANGE, siteId: "site-a", zoneId: "zone-1" });

  // vm 컨텍스트에서 만든 객체는 prototype이 달라서 JSON으로 바꿔 비교한다.
  const where = JSON.parse(JSON.stringify(calls.eventWhere));
  assert.deepEqual(where.eventType, { in: ["wrong-way", "pedestrian-entered"] });
  assert.deepEqual(where.NOT, { eventType: "wrong-way", status: "FALSE_ALARM" });
  assert.deepEqual(where.zone, { siteId: "site-a" });
  assert.equal(where.zoneId, "zone-1");
  assert.deepEqual(where.OR, [
    { occurredAt: { gte: kst(2026, 10, 1).toISOString(), lt: kst(2026, 10, 6).toISOString() } },
    { occurredAt: null, receivedAt: { gte: kst(2026, 10, 1).toISOString(), lt: kst(2026, 10, 6).toISOString() } },
  ]);
});
