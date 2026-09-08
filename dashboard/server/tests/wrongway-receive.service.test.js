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
