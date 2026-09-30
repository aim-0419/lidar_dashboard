const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { test } = require("node:test");
const vm = require("node:vm");

function wait(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function createFakePrisma({ transactionDelayMs = 0 } = {}) {
  const state = {
    tracks: new Map(),
    dailyStats: [],
    incidents: [],
    trafficEvents: [],
    eventLogs: [],
    deviceUpdates: [],
    activeTransactions: 0,
    maxActiveTransactions: 0,
  };

  const prisma = {
    device: {
      findUnique: async ({ where }) => ({
        id: `device-${where.deviceCode}`,
        deviceCode: where.deviceCode,
        deviceType: "LIDAR_PC",
        zoneId: "zone-1",
        zone: { id: "zone-1" },
      }),
      update: async (args) => {
        state.deviceUpdates.push(args);
        return args;
      },
    },
    safetyIncident: {
      findFirst: async () => null,
      create: async ({ data }) => {
        const incident = { id: `incident-${state.incidents.length + 1}`, ...data };
        state.incidents.push(incident);
        return incident;
      },
      update: async ({ where, data }) => {
        const incident = state.incidents.find((item) => item.id === where.id);
        Object.assign(incident, data);
        return incident;
      },
    },
    vehicleTrack: {
      findUnique: async ({ where }) => {
        const key = `${where.deviceId_trackId.deviceId}:${where.deviceId_trackId.trackId}`;
        return state.tracks.get(key) || null;
      },
      upsert: async ({ where, update, create }) => {
        const key = `${where.deviceId_trackId.deviceId}:${where.deviceId_trackId.trackId}`;
        const previous = state.tracks.get(key);
        const track = previous
          ? { ...previous, ...update }
          : { id: `track-${state.tracks.size + 1}`, ...create };
        state.tracks.set(key, track);
        return track;
      },
      updateMany: async () => ({ count: 0 }),
    },
    dailyTrafficStat: {
      upsert: async (args) => {
        state.dailyStats.push(args);
        return args.create;
      },
    },
    trafficEvent: {
      create: async ({ data }) => {
        const event = { id: `event-${state.trafficEvents.length + 1}`, ...data };
        state.trafficEvents.push(event);
        return event;
      },
    },
    eventLog: {
      create: async ({ data }) => {
        state.eventLogs.push(data);
        return data;
      },
    },
    $transaction: async (callback) => {
      state.activeTransactions += 1;
      state.maxActiveTransactions = Math.max(
        state.maxActiveTransactions,
        state.activeTransactions,
      );
      try {
        if (transactionDelayMs) await wait(transactionDelayMs);
        return await callback(prisma);
      } finally {
        state.activeTransactions -= 1;
      }
    },
  };

  return { prisma, state };
}

function loadWrongwayService(prisma) {
  const filename = path.resolve(__dirname, "../src/domains/wrongway/wrongway.service.js");
  const loaded = { exports: {} };

  vm.runInNewContext(fs.readFileSync(filename, "utf8"), {
    module: loaded,
    exports: loaded.exports,
    require(name) {
      if (name === "../../prisma/client") return { prisma };
      if (name === "../../utils/logger") {
        return { logger: { info() {}, debug() {}, warn() {}, error() {} } };
      }
      if (name === "../mock-lidar/mockLidar.service") {
        return {
          applyDashboardEventEffects() {},
          addWrongWayHistory() {},
          broadcastDashboardEvent() {},
          pushLog() {},
        };
      }
      if (name.startsWith("./")) {
        return require(path.resolve(path.dirname(filename), name));
      }
      throw new Error(`Unexpected dependency: ${name}`);
    },
    clearInterval,
    setInterval,
  }, { filename });

  return loaded.exports;
}

function createNormalSnapshot(trackId) {
  return {
    timestamp: "2026-09-08T10:30:00.000+09:00",
    source: "lidar-pc-01",
    status: "normal-driving",
    total_objects: 1,
    objects: [
      {
        type: "normal-driving",
        warning_level: 0,
        zone_id: "Z261",
        track_id: trackId,
        speed_ms: 3.2,
        speed_kmh: 11.52,
        object_class: 1,
        confidence: 0.98,
      },
    ],
  };
}

function createWrongwaySnapshot(trackId) {
  const snapshot = createNormalSnapshot(trackId);
  snapshot.status = "wrong-way";
  snapshot.wrong_way_count = 1;
  snapshot.normal_moving_vehicle_count = 0;
  snapshot.objects[0] = {
    ...snapshot.objects[0],
    type: "wrong-way",
    warning_level: 1,
    message: "역주행 발생",
  };
  return snapshot;
}

test("다중 객체 수신은 트랙과 일별 통계를 저장하고 성공 응답을 반환한다", async () => {
  const { prisma, state } = createFakePrisma();
  const service = loadWrongwayService(prisma);

  const result = await service.receiveWrongWayPayload(createNormalSnapshot("track-001"));

  assert.equal(result.ok, true);
  assert.equal(result.summary.received, 1);
  assert.equal(result.summary.tracksCreated, 1);
  assert.equal(state.tracks.size, 1);
  assert.equal(state.dailyStats.length, 1);
  assert.equal(state.dailyStats[0].create.totalVehicleCount, 1);
  assert.equal(state.dailyStats[0].create.normalVehicleCount, 1);
});

test("역주행 수신은 사건과 이벤트 이력을 저장하고 성공 응답을 반환한다", async () => {
  const { prisma, state } = createFakePrisma();
  const service = loadWrongwayService(prisma);

  const result = await service.receiveWrongWayPayload(createWrongwaySnapshot("wrongway-001"));

  assert.equal(result.ok, true);
  assert.equal(result.summary.eventsStored, 1);
  assert.equal(state.incidents.length, 1);
  assert.equal(state.trafficEvents.length, 1);
  assert.equal(state.eventLogs.length, 1);
  assert.equal(state.dailyStats.length, 2);
  assert.equal(state.dailyStats[1].create.wrongWayCount, 1);
});

test("같은 source의 동시 snapshot은 순서대로 처리한다", async () => {
  const { prisma, state } = createFakePrisma({ transactionDelayMs: 20 });
  const service = loadWrongwayService(prisma);

  await Promise.all([
    service.receiveWrongWayPayload(createNormalSnapshot("track-001")),
    service.receiveWrongWayPayload(createNormalSnapshot("track-002")),
  ]);

  assert.equal(state.tracks.size, 2);
  assert.equal(state.maxActiveTransactions, 1);
});

test("객체가 없는 snapshot도 라이다 PC의 마지막 수신 시각을 기록한다", async () => {
  const { prisma, state } = createFakePrisma();
  const service = loadWrongwayService(prisma);
  const snapshot = createNormalSnapshot("track-001");
  snapshot.objects = [];
  snapshot.total_objects = 0;

  await service.receiveWrongWayPayload(snapshot);

  assert.equal(state.deviceUpdates.length, 1);
  assert.equal(state.deviceUpdates[0].where.id, "device-LIDAR-PC-01");
  // vm 컨텍스트의 Date는 instanceof로 비교할 수 없어 실제 날짜 값인지로 확인한다.
  assert.ok(!Number.isNaN(new Date(state.deviceUpdates[0].data.lastSeenAt).getTime()));
});

test("snapshot 저장 후 처리 완료 알림을 보내고, 알림 실패는 수신 응답에 영향을 주지 않는다", async () => {
  const { prisma } = createFakePrisma();
  const service = loadWrongwayService(prisma);
  const notified = [];

  service.setSnapshotProcessedListener((info) => notified.push(info));
  await service.receiveWrongWayPayload(createNormalSnapshot("track-001"));
  await wait(0);
  assert.deepEqual(notified.map((item) => item.source), ["LIDAR-PC-01"]);

  service.setSnapshotProcessedListener(() => {
    throw new Error("listener failed");
  });
  const result = await service.receiveWrongWayPayload(createNormalSnapshot("track-002"));
  await wait(0);
  assert.equal(result.ok, true);
});
