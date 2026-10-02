const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { test } = require("node:test");
const vm = require("node:vm");

function loadService(tracks = []) {
  const filename = path.resolve(__dirname, "../src/domains/wrongway/liveSnapshot.service.js");
  const loaded = { exports: {} };
  vm.runInNewContext(fs.readFileSync(filename, "utf8"), {
    module: loaded,
    exports: loaded.exports,
    require(name) {
      if (name === "../../prisma/client") {
        return { prisma: { vehicleTrack: { findMany: async () => tracks } } };
      }
      throw new Error(`Unexpected dependency: ${name}`);
    },
    Map,
    Date,
  }, { filename });
  return loaded.exports;
}

test("최신 스냅샷만 구역 상태에 반영하고 상황 종료 객체는 제외한다", async () => {
  const service = loadService();
  const device = { id: "device-1", zoneId: "zone-1" };
  const now = Date.now();
  const snapshot = (offset) => ({
    source: "lidar-pc-01",
    timestamp: new Date(now + offset).toISOString(),
    receivedAt: new Date(now).toISOString(),
  });
  const entry = (index, trackId, type) => ({
    index,
    event: { trackId, originalType: type, externalZoneId: "Z1", objectClass: 1 },
  });
  service.updateLiveSnapshot(snapshot(0), device, [
    entry(0, "car-1", "normal-driving"),
    entry(1, "car-2", "situation-ended"),
  ], []);
  service.updateLiveSnapshot(snapshot(-1000), device, [entry(0, "old-car", "wrong-way")], []);
  const result = await service.getLiveObjects();
  assert.equal(result.zones.length, 1);
  assert.equal(result.zones[0].objects.length, 1);
  assert.equal(result.zones[0].objects[0].trackId, "car-1");
});

test("마지막 수신이 오래되면 객체를 반환하지 않고 stale로 표시한다", async () => {
  const service = loadService();
  const old = new Date(Date.now() - 10000).toISOString();
  service.updateLiveSnapshot({ source: "lidar-pc-01", timestamp: old, receivedAt: old },
    { id: "device-1", zoneId: "zone-1" },
    [{ index: 0, event: { trackId: "car-1", originalType: "normal-driving" } }], []);
  const result = await service.getLiveObjects();
  assert.equal(result.zones[0].connectionStatus, "stale");
  assert.equal(result.zones[0].objects.length, 0);
});
