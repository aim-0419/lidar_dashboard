const bcrypt = require("bcrypt");
const { PrismaClient } = require("@prisma/client");
const { PrismaPg } = require("@prisma/adapter-pg");

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
  const site = await prisma.site.upsert({
    where: { id: "site-wolchulsan-rest-area" },
    update: {},
    create: {
      id: "site-wolchulsan-rest-area",
      name: "월출산휴게소",
      location: "전라남도 영암군",
      description: "역주행 방지 시스템 1차 개발 대상 현장",
    },
  });

  const roundabout1 = await prisma.zone.upsert({
    where: { zoneCode: "ROUNDABOUT-01" },
    update: {},
    create: {
      siteId: site.id,
      zoneCode: "ROUNDABOUT-01",
      name: "회전교차로 1",
      type: "ROUNDABOUT",
      description: "월출산휴게소 회전교차로 1",
    },
  });

  const roundabout2 = await prisma.zone.upsert({
    where: { zoneCode: "ROUNDABOUT-02" },
    update: {},
    create: {
      siteId: site.id,
      zoneCode: "ROUNDABOUT-02",
      name: "회전교차로 2",
      type: "ROUNDABOUT",
      description: "월출산휴게소 회전교차로 2",
    },
  });

  const devices = [
    {
      zoneId: roundabout1.id,
      deviceCode: "LIDAR-PC-01",
      name: "회전교차로 1 라이다 PC",
      deviceType: "LIDAR_PC",
      installedLocation: "회전교차로 1",
    },
    {
      zoneId: roundabout1.id,
      deviceCode: "CONTROL-BOARD-01",
      name: "회전교차로 1 통합제어보드",
      deviceType: "CONTROL_BOARD",
      installedLocation: "회전교차로 1",
    },
    {
      zoneId: roundabout2.id,
      deviceCode: "LIDAR-PC-02",
      name: "회전교차로 2 라이다 PC",
      deviceType: "LIDAR_PC",
      installedLocation: "회전교차로 2",
    },
    {
      zoneId: roundabout2.id,
      deviceCode: "CONTROL-BOARD-02",
      name: "회전교차로 2 통합제어보드",
      deviceType: "CONTROL_BOARD",
      installedLocation: "회전교차로 2",
    },
  ];

  for (const device of devices) {
    await prisma.device.upsert({
      where: { deviceCode: device.deviceCode },
      update: {
        zoneId: device.zoneId,
        name: device.name,
        deviceType: device.deviceType,
        installedLocation: device.installedLocation,
      },
      create: {
        ...device,
        status: "UNKNOWN",
        healthStatus: "UNKNOWN",
      },
    });
  }

  const passwordHash = await bcrypt.hash("password", 10);

  await prisma.user.upsert({
    where: { userId: "admin" },
    update: {
      name: "관리자",
      role: "SUPER_ADMIN",
      isActive: true,
    },
    create: {
      userId: "admin",
      name: "관리자",
      passwordHash,
      role: "SUPER_ADMIN",
      isActive: true,
    },
  });
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });