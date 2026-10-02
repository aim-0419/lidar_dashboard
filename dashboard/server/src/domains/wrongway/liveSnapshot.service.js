const { prisma } = require("../../prisma/client");

const STALE_AFTER_MS = 5000;
const latestByDevice = new Map();
let broadcast = () => {};

function setLiveSnapshotBroadcaster(fn) {
  broadcast = typeof fn === "function" ? fn : () => {};
}

function present(entry, now = Date.now()) {
  const stale = now - Date.parse(entry.receivedAt) > STALE_AFTER_MS;
  return {
    zoneId: entry.zoneId,
    source: entry.source,
    snapshotAt: entry.snapshotAt,
    lastReceivedAt: entry.receivedAt,
    connectionStatus: stale ? "stale" : "online",
    objects: stale ? [] : entry.objects,
  };
}

function updateLiveSnapshot(snapshot, device, accepted, results) {
  const previous = latestByDevice.get(device.id);
  if (previous && Date.parse(snapshot.timestamp) < Date.parse(previous.snapshotAt)) return;

  const skipped = new Set(results.filter((item) => item.action === "STALE_OBJECT_SKIPPED").map((item) => item.index));
  const objects = accepted
    .filter((entry) => !skipped.has(entry.index) && entry.event.originalType !== "situation-ended")
    .map((entry) => ({
      trackId: entry.event.trackId,
      externalZoneId: entry.event.externalZoneId,
      type: entry.event.originalType,
      objectClass: entry.event.objectClass ?? null,
      speedKmh: entry.event.speedKmh ?? null,
      confidence: entry.event.confidence ?? null,
    }));
  const entry = {
    zoneId: device.zoneId,
    source: snapshot.source,
    snapshotAt: snapshot.timestamp,
    receivedAt: snapshot.receivedAt,
    objects,
  };
  latestByDevice.set(device.id, entry);
  broadcast("live-snapshot", present(entry));
}

async function getLiveObjects() {
  // 프로세스 재시작 직후에는 최근 DB 트랙으로 화면 상태를 복구한다.
  if (!latestByDevice.size) {
    const tracks = await prisma.vehicleTrack.findMany({
      where: { isActive: true, lastSeenAt: { gte: new Date(Date.now() - STALE_AFTER_MS) } },
      include: { device: { select: { deviceCode: true } } },
    });
    for (const track of tracks) {
      if (!track.deviceId || !track.zoneId) continue;
      const entry = latestByDevice.get(track.deviceId) || {
        zoneId: track.zoneId,
        source: track.device?.deviceCode || "",
        snapshotAt: track.lastSeenAt.toISOString(),
        receivedAt: track.lastSeenAt.toISOString(),
        objects: [],
      };
      entry.objects.push({
        trackId: track.trackId,
        externalZoneId: track.externalZoneId,
        type: track.lastEventType,
        objectClass: track.objectClass,
        speedKmh: track.lastSpeedKmh,
        confidence: track.lastConfidence,
      });
      if (track.lastSeenAt > new Date(entry.receivedAt)) {
        entry.snapshotAt = track.lastSeenAt.toISOString();
        entry.receivedAt = entry.snapshotAt;
      }
      latestByDevice.set(track.deviceId, entry);
    }
  }
  return { ok: true, checkedAt: new Date().toISOString(), zones: [...latestByDevice.values()].map((entry) => present(entry)) };
}

module.exports = { getLiveObjects, setLiveSnapshotBroadcaster, updateLiveSnapshot };
