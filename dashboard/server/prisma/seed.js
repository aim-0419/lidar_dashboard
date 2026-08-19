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
        protocolDeviceId: null,
      },
      create: {
        ...device,
        status: "UNKNOWN",
        healthStatus: "UNKNOWN",
      },
    });
  }

  const controlBoard1 = await prisma.device.findUnique({ where: { deviceCode: "CONTROL-BOARD-01" } });
  const controlBoard2 = await prisma.device.findUnique({ where: { deviceCode: "CONTROL-BOARD-02" } });

  // 물리 장비는 DB의 device_code로만 식별한다.
  // 프로토콜 바이트 주소는 하드웨어 규격 확정 후 protocolDeviceId에 별도로 매핑한다.
  const controlledDevices = [
    { zoneId: roundabout1.id, controllerId: controlBoard1.id, prefix: "ROUNDABOUT-01", location: "회전교차로 1" },
    { zoneId: roundabout2.id, controllerId: controlBoard2.id, prefix: "ROUNDABOUT-02", location: "회전교차로 2" },
  ].flatMap((group) => [
    { ...group, suffix: "SPEAKER-01", name: "스피커 1", deviceType: "SPEAKER" },
    { ...group, suffix: "SPEAKER-02", name: "스피커 2", deviceType: "SPEAKER" },
    { ...group, suffix: "DISPLAY-01", name: "전광판 1", deviceType: "DISPLAY" },
    { ...group, suffix: "DISPLAY-02", name: "전광판 2", deviceType: "DISPLAY" },
    { ...group, suffix: "BARRIER-01", name: "차단기 1", deviceType: "BARRIER" },
  ]);

  for (const device of controlledDevices) {
    const deviceCode = `${device.prefix}-${device.suffix}`;
    await prisma.device.upsert({
      where: { deviceCode },
      update: {
        zoneId: device.zoneId,
        controllerId: device.controllerId,
        name: `${device.location} ${device.name}`,
        deviceType: device.deviceType,
        protocolDeviceId: null,
        installedLocation: device.location,
      },
      create: {
        zoneId: device.zoneId,
        controllerId: device.controllerId,
        deviceCode,
        name: `${device.location} ${device.name}`,
        deviceType: device.deviceType,
        protocolDeviceId: null,
        installedLocation: device.location,
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

