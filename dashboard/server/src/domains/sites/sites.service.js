const { prisma } = require("../../prisma/client");

// 현장 목록과 각 현장에 속한 존/디바이스 수를 함께 조회한다.
async function getSites() {
  const sites = await prisma.site.findMany({
    orderBy: { createdAt: "asc" },
    include: {
      // 목록 화면에서 현장 규모를 빠르게 확인할 수 있도록 존/디바이스 수를 함께 계산한다.
      _count: { select: { zones: true } },
      zones: {
        select: {
          _count: { select: { devices: true } },
        },
      },
    },
  });

  return sites.map((site) => {
    // 디바이스는 존에 속하므로 현장 단위 수는 각 존의 디바이스 수를 합산해 구한다.
    const deviceCount = site.zones.reduce(
      (sum, zone) => sum + zone._count.devices,
      0
    );

    return {
      id: site.id,
      name: site.name,
      location: site.location,
      description: site.description,
      zoneCount: site._count.zones,
      deviceCount,
      createdAt: site.createdAt,
      updatedAt: site.updatedAt,
    };
  });
}

// 현장 하나의 상세 정보를 존/디바이스까지 중첩해서 조회한다.
async function getSiteById(id) {
  const site = await prisma.site.findUnique({
    where: { id },
    include: {
      zones: {
        orderBy: { createdAt: "asc" },
        include: {
          devices: { orderBy: { createdAt: "asc" } },
        },
      },
    },
  });

  // 존재하지 않는 현장은 null로 반환해 controller에서 404로 구분한다.
  if (!site) return null;

  const zones = site.zones.map((zone) => ({
    id: zone.id,
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
  }));

  return {
    id: site.id,
    name: site.name,
    location: site.location,
    description: site.description,
    zoneCount: zones.length,
    deviceCount: zones.reduce((sum, zone) => sum + zone.deviceCount, 0),
    zones,
    createdAt: site.createdAt,
    updatedAt: site.updatedAt,
  };
}

module.exports = { getSites, getSiteById };