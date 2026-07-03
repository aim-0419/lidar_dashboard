const { prisma } = require("../../prisma/client");

// 특정 현장(site)에 속한 구역(zone) 목록을 디바이스 수와 함께 조회한다.
async function getZonesBySite(siteId) {
  // 존재하지 않는 현장과 구역이 없는 현장을 구분하기 위해 현장 존재 여부를 먼저 확인한다.
  const site = await prisma.site.findUnique({ where: { id: siteId } });
  if (!site) return null;

  const zones = await prisma.zone.findMany({
    where: { siteId },
    orderBy: { createdAt: "asc" },
    include: {
      // 구역 목록에서 규모를 빠르게 확인할 수 있도록 디바이스 수를 함께 계산한다.
      _count: { select: { devices: true } },
    },
  });

  return zones.map((zone) => ({
    id: zone.id,
    siteId: zone.siteId,
    zoneCode: zone.zoneCode,
    name: zone.name,
    type: zone.type,
    description: zone.description,
    deviceCount: zone._count.devices,
    createdAt: zone.createdAt,
    updatedAt: zone.updatedAt,
  }));
}

// 전체 구역(zone) 목록을 소속 현장 요약과 디바이스 수와 함께 조회한다.
async function getZones() {
  const zones = await prisma.zone.findMany({
    orderBy: { createdAt: "asc" },
    include: {
      // 전체 목록에서는 각 구역이 어느 현장 소속인지 함께 보여준다.
      site: { select: { id: true, name: true } },
      _count: { select: { devices: true } },
    },
  });

  return zones.map((zone) => ({
    id: zone.id,
    siteId: zone.siteId,
    site: zone.site ? { id: zone.site.id, name: zone.site.name } : null,
    zoneCode: zone.zoneCode,
    name: zone.name,
    type: zone.type,
    description: zone.description,
    deviceCount: zone._count.devices,
    createdAt: zone.createdAt,
    updatedAt: zone.updatedAt,
  }));
}

// 구역 하나의 상세 정보를 소속 현장 요약과 디바이스 목록까지 포함해 조회한다.
async function getZoneById(id) {
  const zone = await prisma.zone.findUnique({
    where: { id },
    include: {
      site: { select: { id: true, name: true, location: true } },
      devices: { orderBy: { createdAt: "asc" } },
    },
  });

  // 존재하지 않는 구역은 null로 반환해 controller에서 404로 구분한다.
  if (!zone) return null;

  return {
    id: zone.id,
    siteId: zone.siteId,
    site: zone.site
      ? { id: zone.site.id, name: zone.site.name, location: zone.site.location }
      : null,
    zoneCode: zone.zoneCode,
    name: zone.name,
    type: zone.type,
    description: zone.description,
    deviceCount: zone.devices.length,
    devices: zone.devices.map((device) => ({
      id: device.id,
      deviceCode: device.deviceCode,
      name: device.name,
      deviceType: device.deviceType,
      status: device.status,
      healthStatus: device.healthStatus,
      ipAddress: device.ipAddress,
      port: device.port,
      lastSeenAt: device.lastSeenAt,
      installedLocation: device.installedLocation,
      createdAt: device.createdAt,
      updatedAt: device.updatedAt,
    })),
    createdAt: zone.createdAt,
    updatedAt: zone.updatedAt,
  };
}

module.exports = { getZones, getZonesBySite, getZoneById };