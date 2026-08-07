const bcrypt = require("bcrypt");
const { PrismaClient } = require("@prisma/client");
const { PrismaPg } = require("@prisma/adapter-pg");

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
  // 대시보드 데모 데이터에 필요한 기본 현장과 구역 구조를 시드합니다.
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

  // 개발 환경에서 로그인 API를 테스트할 수 있도록 기본 관리자 계정을 생성한다.

  // 평문 비밀번호 "password"를 bcrypt로 해시 처리한다.
  // 두 번째 인자 10은 salt rounds 값으로, 해시 연산 강도를 의미한다.
  const passwordHash = await bcrypt.hash("password", 10);

  // seed를 다시 실행해도 기존 admin 계정 상태를 덮어쓰지 않도록 한다.
  await prisma.user.upsert({
    where: { userId: "admin" },
    // admin 사용자가 이미 존재하면 운영 중 변경된 권한/활성 상태를 유지한다.
    update: {},
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

