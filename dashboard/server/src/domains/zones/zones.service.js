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

module.exports = { getZonesBySite };