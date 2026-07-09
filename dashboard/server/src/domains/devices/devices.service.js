const { prisma } = require("../../prisma/client");

// 장비(device) 응답은 여러 API에서 공통으로 쓰이므로 매퍼를 하나로 유지한다.
// DB 컬럼명을 그대로 노출하지 않고 프론트엔드가 읽는 camelCase 필드만 골라 반환한다.
function toDeviceResponse(device) {
  return {
    id: device.id,
    zoneId: device.zoneId,
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
  };
}

// 장비가 어느 구역/현장 소속인지 목록/상세에서 함께 보여주기 위한 요약 매퍼다.
function toZoneSummary(zone) {
  if (!zone) return null;
  return {
    id: zone.id,
    zoneCode: zone.zoneCode,
    name: zone.name,
    site: zone.site ? { id: zone.site.id, name: zone.site.name } : null,
  };
}

// 전체 장비 목록을 소속 구역/현장 요약과 함께 생성순으로 조회한다.
async function getDevices() {
  const devices = await prisma.device.findMany({
    orderBy: { createdAt: "asc" },
    include: {
      // 목록에서 각 장비가 어느 구역/현장에 있는지 바로 확인하도록 요약을 붙인다.
      zone: { select: { id: true, zoneCode: true, name: true, site: { select: { id: true, name: true } } } },
    },
  });

  return devices.map((device) => ({
    ...toDeviceResponse(device),
    zone: toZoneSummary(device.zone),
  }));
}

// 장비 하나의 상세 정보를 소속 구역/현장 요약과 함께 조회한다.
async function getDeviceById(id) {
  const device = await prisma.device.findUnique({
    where: { id },
    include: {
      zone: { select: { id: true, zoneCode: true, name: true, site: { select: { id: true, name: true, location: true } } } },
    },
  });

  // 존재하지 않는 장비는 null로 반환해 controller에서 404로 구분한다.
  if (!device) return null;

  return {
    ...toDeviceResponse(device),
    zone: device.zone
      ? {
          id: device.zone.id,
          zoneCode: device.zone.zoneCode,
          name: device.zone.name,
          site: device.zone.site
            ? { id: device.zone.site.id, name: device.zone.site.name, location: device.zone.site.location }
            : null,
        }
      : null,
  };
}

// 특정 구역(zone)에 속한 장비 목록을 조회한다.
async function getDevicesByZone(zoneId) {
  // 존재하지 않는 구역과 장비가 없는 구역을 구분하기 위해 구역 존재 여부를 먼저 확인한다.
  const zone = await prisma.zone.findUnique({ where: { id: zoneId } });
  if (!zone) return null;

  const devices = await prisma.device.findMany({
    where: { zoneId },
    orderBy: { createdAt: "asc" },
  });

  return devices.map(toDeviceResponse);
}

// 장비 하나의 상태 값만 좁게 조회한다. 상태 배지/헬스 확인 화면에서 가볍게 쓰기 위한 API다.
async function getDeviceStatus(id) {
  const device = await prisma.device.findUnique({
    where: { id },
    select: {
      id: true,
      deviceCode: true,
      name: true,
      deviceType: true,
      status: true,
      healthStatus: true,
      lastSeenAt: true,
      updatedAt: true,
    },
  });

  // 존재하지 않는 장비는 null로 반환해 controller에서 404로 구분한다.
  if (!device) return null;

  return device;
}

module.exports = { getDevices, getDeviceById, getDevicesByZone, getDeviceStatus };
