import { detectedObjects, liveSnapshot, monitoringZones } from "../../shared/constants/operationsDashboardData";

// 현장 좌표 규격이 확정되기 전까지 벡터 맵은 목업 객체를 사용한다.
export const LIVE_DATA_SOURCE = import.meta.env.VITE_LIVE_DATA_SOURCE === "api" ? "api" : "mock";

export function getDashboardObjects(zones) {
  if (LIVE_DATA_SOURCE === "mock") return detectedObjects;
  return zones.flatMap((zone) => {
    if (zone.connectionStatus !== "online") return [];
    return zone.objects.map((object) => ({
      monitoringZoneId: monitoringZones.find((item) => item.laneletZoneIds.includes(object.externalZoneId) || item.id === zone.zoneId)?.id || zone.zoneId,
      trackId: object.trackId,
      zoneId: object.externalZoneId || zone.zoneId,
      type: object.type,
      warningLevel: object.type === "wrong-way" ? 1 : 0,
      message: object.type === "wrong-way" ? "역주행" : object.objectClass === 7 ? "보행자" : "정주행",
      objectClass: object.objectClass,
      speedKmh: object.speedKmh ?? 0,
      confidence: object.confidence ?? 0,
    }));
  });
}

export function getDashboardSnapshot(zones, selectedZoneId) {
  if (LIVE_DATA_SOURCE === "mock") {
    return monitoringZones.find((zone) => zone.id === selectedZoneId)?.snapshot || liveSnapshot;
  }
  const relevant = selectedZoneId === "all"
    ? zones
    : zones.filter((zone) => zone.zoneId === selectedZoneId || zone.objects.some((object) =>
      monitoringZones.find((item) => item.id === selectedZoneId)?.laneletZoneIds.includes(object.externalZoneId),
    ));
  const objects = relevant.filter((zone) => zone.connectionStatus === "online").flatMap((zone) =>
    selectedZoneId === "all" ? zone.objects : zone.objects.filter((object) =>
      monitoringZones.find((item) => item.id === selectedZoneId)?.laneletZoneIds.includes(object.externalZoneId),
    ),
  );
  return {
    normalMovingVehicleCount: objects.filter((item) => item.type === "normal-driving" && item.objectClass !== 7).length,
    totalObjects: objects.length,
    wrongWayCount: objects.filter((item) => item.type === "wrong-way").length,
    pedestrianCount: objects.filter((item) => item.objectClass === 7).length,
  };
}
