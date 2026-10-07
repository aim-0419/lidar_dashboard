const crypto = require("node:crypto");
const { PrismaClient } = require("@prisma/client");
const { PrismaPg } = require("@prisma/adapter-pg");

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

// 시연/화면 확인용 예시 데이터를 넣는다. 실제 라이다 데이터와 구분하기 위해 모든 이벤트/트랙에 DEMO- 표시를 붙인다.
// 사용법: npm run seed:demo          → 예시 데이터를 지우고 실행한 날 기준으로 다시 생성
//         npm run seed:demo -- --reset → 예시 데이터만 삭제(되돌리기)
const DEMO_PREFIX = "DEMO-";
const DEMO_DAYS = 30;
const SITE_ID = "site-wolchulsan-rest-area";
const KST_OFFSET_MS = 9 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;

const DEMO_ZONES = [
  { zoneCode: "ROUNDABOUT-01", lidarCode: "LIDAR-PC-01", source: "lidar-pc-01", volumeFactor: 1 },
  { zoneCode: "ROUNDABOUT-02", lidarCode: "LIDAR-PC-02", source: "lidar-pc-02", volumeFactor: 0.75 },
];

// 시간대별 기본 통과 차량 수(0~23시). 출퇴근 시간에 많고 새벽에 적은 휴게소 교통 패턴을 흉내 낸다.
const HOURLY_BASE_VOLUME = [3, 2, 1, 1, 2, 4, 9, 16, 20, 17, 15, 18, 22, 19, 16, 17, 20, 24, 21, 15, 11, 8, 6, 4];

// 같은 날 실행하면 같은 모양의 데이터가 나오도록 고정 시드 난수를 사용한다.
function createRandom(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function toKstParts(date) {
  const kst = new Date(date.getTime() + KST_OFFSET_MS);
  return {
    year: kst.getUTCFullYear(),
    month: kst.getUTCMonth(),
    date: kst.getUTCDate(),
    hours: kst.getUTCHours(),
    day: kst.getUTCDay(),
  };
}

// daily_traffic_stats.stat_date(@db.Date)는 KST 날짜를 UTC 자정으로 저장한다.
function toDailyStatDate(parts) {
  return new Date(Date.UTC(parts.year, parts.month, parts.date));
}

// traffic_statistics.stat_date는 KST 자정 시각으로 저장해야 통계 API의 KST 범위 계산과 맞는다.
function toKstMidnight(parts) {
  return new Date(Date.UTC(parts.year, parts.month, parts.date) - KST_OFFSET_MS);
}

function pickInt(random, min, max) {
  return min + Math.floor(random() * (max - min + 1));
}

function pickWeighted(random, weights) {
  const total = weights.reduce((sum, weight) => sum + weight, 0);
  let target = random() * total;
  for (let index = 0; index < weights.length; index += 1) {
    target -= weights[index];
    if (target < 0) return index;
  }
  return weights.length - 1;
}

function round(value, digits = 1) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

async function loadDemoTargets() {
  const zones = await prisma.zone.findMany({
    where: { zoneCode: { in: DEMO_ZONES.map((zone) => zone.zoneCode) } },
  });
  const devices = await prisma.device.findMany({
    where: { deviceCode: { in: DEMO_ZONES.map((zone) => zone.lidarCode) } },
  });

  return DEMO_ZONES.map((config) => {
    const zone = zones.find((item) => item.zoneCode === config.zoneCode);
    const device = devices.find((item) => item.deviceCode === config.lidarCode);
    if (!zone || !device) {
      throw new Error(
        `${config.zoneCode}/${config.lidarCode} 기본 데이터가 없습니다. 먼저 기본 seed(npx prisma db seed)를 실행하세요.`,
      );
    }
    return { ...config, zone, device };
  });
}

// 통계 테이블에는 DEMO 표시 컬럼이 없어서, 예시 데이터 기간(최근 31일)의 대상 구역 통계를 통째로 지운다.
// 개발/시연용 DB 기준이며, 이 기간에 실제로 쌓인 통계도 함께 지워진다.
function getDemoStatRange(now) {
  const today = toKstParts(now);
  const firstDay = toKstParts(new Date(now.getTime() - DEMO_DAYS * 24 * HOUR_MS));
  return {
    dailyFrom: toDailyStatDate(firstDay),
    hourlyFrom: toKstMidnight(firstDay),
    today,
  };
}

async function clearDemoData(targets, now) {
  const zoneIds = targets.map((target) => target.zone.id);
  const { dailyFrom, hourlyFrom } = getDemoStatRange(now);

  const demoEvents = await prisma.trafficEvent.findMany({
    where: { eventCode: { startsWith: DEMO_PREFIX } },
    select: { id: true, incidentId: true },
  });
  const eventIds = demoEvents.map((event) => event.id);
  const incidentIds = [...new Set(demoEvents.map((event) => event.incidentId).filter(Boolean))];

  const [eventLogs, events, incidents, tracks, dailyStats, hourlyStats] = await prisma.$transaction([
    prisma.eventLog.deleteMany({ where: { eventId: { in: eventIds } } }),
    prisma.trafficEvent.deleteMany({ where: { id: { in: eventIds } } }),
    prisma.safetyIncident.deleteMany({ where: { id: { in: incidentIds } } }),
    prisma.vehicleTrack.deleteMany({ where: { trackId: { startsWith: DEMO_PREFIX } } }),
    prisma.dailyTrafficStat.deleteMany({ where: { zoneId: { in: zoneIds }, statDate: { gte: dailyFrom } } }),
    prisma.trafficStatistic.deleteMany({
      where: { periodType: "hourly", zoneId: { in: zoneIds }, statDate: { gte: hourlyFrom } },
    }),
  ]);

  return {
    eventLogs: eventLogs.count,
    events: events.count,
    incidents: incidents.count,
    tracks: tracks.count,
    dailyStats: dailyStats.count,
    hourlyStats: hourlyStats.count,
  };
}

function createEventRow({ id, eventCode, eventType, status, occurredAt, target, trackId, incidentId, object }) {
  const isWrongWay = eventType === "wrong-way";
  return {
    id,
    eventCode,
    eventType,
    status,
    occurredAt,
    receivedAt: new Date(occurredAt.getTime() + 180),
    zoneId: target.zone.id,
    deviceId: target.device.id,
    incidentId,
    externalZoneId: target.zoneCode,
    trackId,
    warningLevel: isWrongWay ? 1 : 0,
    confidence: object.confidence,
    message: object.message,
    speedKmh: object.speedKmh,
    speedMs: round(object.speedKmh / 3.6, 2),
    objectClass: object.objectClass,
    description: object.description,
    rawPayload: {
      demo: true,
      snapshot: { source: target.source, timestamp: occurredAt.toISOString() },
      object: {
        type: eventType,
        zone_id: target.zoneCode,
        track_id: trackId,
        speed_kmh: object.speedKmh,
        confidence: object.confidence,
        object_class: object.objectClass,
      },
    },
  };
}

// 하루치 구역 데이터: 시간대별 통과 차량 + 역주행/보행자 이벤트를 만든다.
function buildDayData({ target, dayParts, isToday, nowHour, random, sequence }) {
  const isWeekend = dayParts.day === 0 || dayParts.day === 6;
  const weekendFactor = isWeekend ? 1.35 : 1;
  const lastHour = isToday ? nowHour : 23;
  const kstMidnight = toKstMidnight(dayParts);

  const hourly = [];
  for (let hour = 0; hour <= lastHour; hour += 1) {
    const noise = 0.75 + random() * 0.5;
    const volume = Math.round(HOURLY_BASE_VOLUME[hour] * target.volumeFactor * weekendFactor * noise);
    hourly.push({ hour, volume });
  }

  const events = [];
  const incidents = [];
  const randomTimeInHour = (hour) => new Date(kstMidnight.getTime() + hour * HOUR_MS + pickInt(random, 0, 3599) * 1000);
  const pickHour = (weights) => {
    const allowed = weights.map((weight, hour) => (hour <= lastHour ? weight : 0));
    return pickWeighted(random, allowed);
  };

  // 역주행은 야간과 출퇴근 시간에 조금 더 자주 나오도록 가중치를 둔다.
  const wrongWayHourWeights = HOURLY_BASE_VOLUME.map((volume, hour) => (hour <= 5 || hour >= 21 ? 3 : 1) + volume / 10);
  const wrongWayCount = isToday ? pickInt(random, 1, 2) : pickWeighted(random, [5, 4, 2]);
  for (let index = 0; index < wrongWayCount; index += 1) {
    sequence.value += 1;
    const occurredAt = randomTimeInHour(pickHour(wrongWayHourWeights));
    const endedAt = new Date(occurredAt.getTime() + pickInt(random, 25, 120) * 1000);
    const trackId = `${DEMO_PREFIX}${target.zoneCode.slice(-2)}-${sequence.value}`;
    const incidentId = crypto.randomUUID();
    const isFalseAlarm = !isToday && random() < 0.12;
    const speedKmh = round(15 + random() * 30);

    incidents.push({
      id: incidentId,
      zoneId: target.zone.id,
      sourceDeviceId: target.device.id,
      incidentType: "WRONG_WAY",
      status: "RESOLVED",
      startedAt: occurredAt,
      resolvedAt: endedAt,
    });
    events.push(
      createEventRow({
        id: crypto.randomUUID(),
        eventCode: `${DEMO_PREFIX}${sequence.value}-WW`,
        eventType: "wrong-way",
        status: isToday ? "CONFIRMED" : isFalseAlarm ? "FALSE_ALARM" : "RESOLVED",
        occurredAt,
        target,
        trackId,
        incidentId,
        object: {
          confidence: round(0.82 + random() * 0.16, 2),
          message: "역주행 차량 감지",
          speedKmh,
          objectClass: random() < 0.85 ? 1 : 2,
          description: "진입 방향 반대로 주행",
        },
      }),
      createEventRow({
        id: crypto.randomUUID(),
        eventCode: `${DEMO_PREFIX}${sequence.value}-END`,
        eventType: "situation-ended",
        status: "RESOLVED",
        occurredAt: endedAt,
        target,
        trackId,
        incidentId,
        object: {
          confidence: round(0.85 + random() * 0.1, 2),
          message: "역주행 상황 종료",
          speedKmh: round(speedKmh * 0.6),
          objectClass: 1,
          description: "구역 이탈 확인",
        },
      }),
    );
  }

  const pedestrianCount = isToday ? pickInt(random, 1, 2) : pickWeighted(random, [3, 4, 2, 1]);
  for (let index = 0; index < pedestrianCount; index += 1) {
    sequence.value += 1;
    // 보행자는 낮 시간대에만 나오도록 한다.
    const pedestrianHourWeights = HOURLY_BASE_VOLUME.map((_, hour) => (hour >= 8 && hour <= 19 ? 1 : 0));
    const hasDaytimeHour = pedestrianHourWeights.some((weight, hour) => weight > 0 && hour <= lastHour);
    const occurredAt = randomTimeInHour(hasDaytimeHour ? pickHour(pedestrianHourWeights) : 0);
    const exitedAt = new Date(occurredAt.getTime() + pickInt(random, 20, 90) * 1000);
    const trackId = `${DEMO_PREFIX}${target.zoneCode.slice(-2)}-P${sequence.value}`;
    const object = {
      confidence: round(0.75 + random() * 0.2, 2),
      speedKmh: round(3 + random() * 3),
      objectClass: 7,
    };

    events.push(
      createEventRow({
        id: crypto.randomUUID(),
        eventCode: `${DEMO_PREFIX}${sequence.value}-PIN`,
        eventType: "pedestrian-entered",
        status: isToday ? "NEW" : "RESOLVED",
        occurredAt,
        target,
        trackId,
        incidentId: null,
        object: { ...object, message: "보행자 도로 진입", description: "횡단보도 외 구간 진입" },
      }),
      createEventRow({
        id: crypto.randomUUID(),
        eventCode: `${DEMO_PREFIX}${sequence.value}-POUT`,
        eventType: "pedestrian-exited",
        status: "RESOLVED",
        occurredAt: exitedAt,
        target,
        trackId,
        incidentId: null,
        object: { ...object, message: "보행자 도로 이탈", description: "보도로 이동" },
      }),
    );
  }

  return { hourly, events, incidents, wrongWayCount, pedestrianCount };
}

async function seedDemoData(targets, now) {
  const { today } = getDemoStatRange(now);
  const random = createRandom(Number(`${today.year}${today.month + 1}${today.date}`));
  const sequence = { value: 0 };

  const hourlyRows = [];
  const dailyRows = [];
  const eventRows = [];
  const incidentRows = [];

  for (let offset = DEMO_DAYS - 1; offset >= 0; offset -= 1) {
    const dayParts = toKstParts(new Date(now.getTime() - offset * 24 * HOUR_MS));
    const isToday = offset === 0;

    for (const target of targets) {
      const day = buildDayData({ target, dayParts, isToday, nowHour: today.hours, random, sequence });
      const totalVehicleCount = day.hourly.reduce((sum, item) => sum + item.volume, 0);

      for (const item of day.hourly) {
        hourlyRows.push({
          statDate: toKstMidnight(dayParts),
          hourSlot: item.hour,
          periodType: "hourly",
          siteId: SITE_ID,
          zoneId: target.zone.id,
          totalVehicles: item.volume,
        });
      }

      dailyRows.push({
        statDate: toDailyStatDate(dayParts),
        zoneId: target.zone.id,
        deviceId: target.device.id,
        totalVehicleCount,
        normalVehicleCount: Math.max(totalVehicleCount - day.wrongWayCount, 0),
        wrongWayCount: day.wrongWayCount,
        pedestrianEnteredCount: day.pedestrianCount,
        pedestrianExitedCount: day.pedestrianCount,
      });

      eventRows.push(...day.events);
      incidentRows.push(...day.incidents);
    }
  }

  // 오늘 이벤트 중 현재 시각 이후로 계산된 종료/이탈 이벤트는 현재 시각 직전으로 당긴다.
  for (const row of eventRows) {
    if (row.occurredAt > now) {
      row.occurredAt = new Date(now.getTime() - 5000);
      row.receivedAt = new Date(row.occurredAt.getTime() + 180);
    }
  }
  for (const row of incidentRows) {
    if (row.resolvedAt > now) row.resolvedAt = new Date(now.getTime() - 5000);
  }

  const eventLogRows = eventRows.map((row) => ({
    eventId: row.id,
    action: "EVENT_RECEIVED",
    message: `${row.eventType} 이벤트를 수신했습니다. (예시 데이터)`,
    metadata: { demo: true, externalZoneId: row.externalZoneId, trackId: row.trackId },
    createdAt: row.receivedAt,
  }));

  await prisma.$transaction([
    prisma.safetyIncident.createMany({ data: incidentRows }),
    prisma.trafficEvent.createMany({ data: eventRows }),
    prisma.eventLog.createMany({ data: eventLogRows }),
    prisma.dailyTrafficStat.createMany({ data: dailyRows }),
    prisma.trafficStatistic.createMany({ data: hourlyRows }),
  ]);

  return {
    events: eventRows.length,
    incidents: incidentRows.length,
    dailyStats: dailyRows.length,
    hourlyStats: hourlyRows.length,
  };
}

async function main() {
  if (process.env.NODE_ENV === "production") {
    throw new Error("운영 환경(NODE_ENV=production)에서는 예시 데이터를 넣거나 지울 수 없습니다.");
  }

  const isReset = process.argv.includes("--reset");
  const now = new Date();
  const targets = await loadDemoTargets();

  const cleared = await clearDemoData(targets, now);
  console.log("[seed:demo] 기존 예시 데이터 삭제:", cleared);

  if (isReset) {
    console.log("[seed:demo] --reset: 예시 데이터를 삭제했습니다.");
    return;
  }

  const created = await seedDemoData(targets, now);
  console.log("[seed:demo] 예시 데이터 생성:", created);
  console.log("[seed:demo] 현재 감지 객체/라이다 수신 상태는 npm run demo:live 를 켜 두면 표시됩니다.");
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
