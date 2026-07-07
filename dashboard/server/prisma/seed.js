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
      description: "라이다 역주행 방지 시스템 1차 개발 대상 현장",
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

  // userId가 "admin"인 사용자를 조회하여
  // 이미 존재하면 update, 존재하지 않으면 create한다.
  await prisma.user.upsert({
    where: { userId: "admin" },
    // admin 사용자가 이미 존재하는 경우 로그인 관련 정보를 갱신한다.
    update: {
      name: "관리자",
      // 평문 비밀번호가 아닌 bcrypt 해시값을 DB의 passwordHash에 저장한다.
      passwordHash,
      // 초기 개발 단계에서는 최고 관리자 권한을 사용한다.
      role: "SUPER_ADMIN",
      // 로그인 가능한 활성 계정으로 설정한다.
      isActive: true,
    },

    // admin 사용자가 존재하지 않는 경우 기본 관리자 계정을 생성한다.
    create: {
      // 로그인 시 입력할 사용자 ID
      userId: "admin",
      // 사용자 이름
      name: "관리자",
      // bcrypt로 생성한 비밀번호 해시값
      passwordHash,
      // 최고 관리자 권한 
      role: "SUPER_ADMIN",
      // 로그인 가능한 활성 계정 상태 
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
