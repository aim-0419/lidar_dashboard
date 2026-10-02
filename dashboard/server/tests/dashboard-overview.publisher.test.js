const assert = require("node:assert/strict");
const { test } = require("node:test");
const { createDashboardOverviewPublisher } = require("../src/realtime/dashboardOverviewPublisher");

function wait(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

const silentLogger = { warn() {} };

test("짧은 시간에 여러 번 알림이 와도 최소 간격 안에서는 한 번만 조회해 보낸다", async () => {
  let queryCount = 0;
  const sent = [];
  const publisher = createDashboardOverviewPublisher({
    getOverview: async () => ({ count: ++queryCount }),
    broadcast: (type, payload) => sent.push({ type, payload }),
    logger: silentLogger,
    minIntervalMs: 50,
  });

  publisher.notify();
  publisher.notify();
  publisher.notify();
  await wait(20);

  assert.equal(queryCount, 1);
  assert.deepEqual(sent, [{ type: "dashboard-overview", payload: { count: 1 } }]);
});

test("간격 안에 들어온 알림은 버리지 않고 간격이 지난 뒤 최신 상태를 한 번 더 보낸다", async () => {
  const sent = [];
  let version = 0;
  const publisher = createDashboardOverviewPublisher({
    getOverview: async () => ({ version: ++version }),
    broadcast: (type, payload) => sent.push(payload.version),
    logger: silentLogger,
    minIntervalMs: 50,
  });

  publisher.notify();
  await wait(10);
  publisher.notify();
  publisher.notify();
  await wait(80);

  assert.deepEqual(sent, [1, 2]);
});

test("조회에 실패해도 다음 알림은 정상적으로 보낸다", async () => {
  const sent = [];
  let fail = true;
  const warnings = [];
  const publisher = createDashboardOverviewPublisher({
    getOverview: async () => {
      if (fail) throw new Error("db down");
      return { ok: true };
    },
    broadcast: (type, payload) => sent.push(payload),
    logger: { warn: (message) => warnings.push(message) },
    minIntervalMs: 10,
  });

  publisher.notify();
  await wait(5);
  fail = false;
  publisher.notify();
  await wait(30);

  assert.equal(warnings.length, 1);
  assert.deepEqual(sent, [{ ok: true }]);
});
