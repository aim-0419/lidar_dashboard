const { prisma } = require("../../prisma/client");

const PERIODS = new Set(["daily", "weekly", "monthly", "custom"]);
const KST_OFFSET_MS = 9 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

function createHttpError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function normalizePeriod(period) {
  const value = String(period || "daily").trim().toLowerCase();

  if (!PERIODS.has(value)) {
    throw createHttpError(400, "period must be one of daily, weekly, monthly, or custom.");
  }

  return value;
}

function formatTwoDigits(value) {
  return String(value).padStart(2, "0");
}

function toKstParts(date) {
  const shifted = new Date(date.getTime() + KST_OFFSET_MS);

  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth(),
    date: shifted.getUTCDate(),
    hours: shifted.getUTCHours(),
    day: shifted.getUTCDay(),
  };
}

function createKstDate(year, month, date, hours = 0, minutes = 0) {
  return new Date(Date.UTC(year, month, date, hours, minutes) - KST_OFFSET_MS);
}

function startOfKstDay(date) {
  const parts = toKstParts(new Date(date));
  return createKstDate(parts.year, parts.month, parts.date);
}

function addKstDays(date, days) {
  return new Date(date.getTime() + days * DAY_MS);
}

function addHours(date, hours) {
  return new Date(date.getTime() + hours * 60 * 60 * 1000);
}

function startOfKstWeek(date) {
  const dayStart = startOfKstDay(date);
  const parts = toKstParts(dayStart);
  const diff = parts.day === 0 ? -6 : 1 - parts.day;
  return addKstDays(dayStart, diff);
}

function startOfKstMonth(date) {
  const parts = toKstParts(new Date(date));
  return createKstDate(parts.year, parts.month, 1);
}

function addKstMonths(date, months) {
  const parts = toKstParts(new Date(date));
  return createKstDate(parts.year, parts.month + months, 1);
}

function getWeekOfMonth(date) {
  const parts = toKstParts(new Date(date));
  const firstDay = createKstDate(parts.year, parts.month, 1);
  const firstDayParts = toKstParts(firstDay);
  const offset = firstDayParts.day === 0 ? 6 : firstDayParts.day - 1;

  return Math.floor((parts.date + offset - 1) / 7) + 1;
}

function normalizeDateInput(value, fieldName) {
  if (typeof value !== "string" || !value.trim()) {
    throw createHttpError(400, `${fieldName} is required when period is custom.`);
  }

  const match = value.trim().match(/^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}))?$/);

  if (!match) {
    throw createHttpError(400, `${fieldName} must be a valid date.`);
  }

  const year = Number(match[1]);
  const month = Number(match[2]) - 1;
  const date = Number(match[3]);
  const hours = match[4] === undefined ? 0 : Number(match[4]);
  const minutes = match[5] === undefined ? 0 : Number(match[5]);

  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
    throw createHttpError(400, `${fieldName} must be a valid date.`);
  }

  const parsed = createKstDate(year, month, date, hours, minutes);

  if (Number.isNaN(parsed.getTime())) {
    throw createHttpError(400, `${fieldName} must be a valid date.`);
  }

  return {
    value: parsed,
    hasTime: match[4] !== undefined,
  };
}

function getDaySpan(startAt, endAtExclusive) {
  const diffMs = endAtExclusive.getTime() - startAt.getTime();
  return Math.ceil(diffMs / DAY_MS);
}

function getCustomBucketUnit(startAt, endAtExclusive) {
  const daySpan = getDaySpan(startAt, endAtExclusive);

  if (daySpan <= 3) {
    return "hour";
  }

  if (daySpan <= 90) {
    return "day";
  }

  return "month";
}

function getRangeForPeriod(period, { startDate, endDate } = {}) {
  const now = new Date();
  const today = startOfKstDay(now);

  if (period === "daily") {
    return {
      startAt: today,
      endAt: addKstDays(today, 1),
      bucketUnit: "hour",
    };
  }

  if (period === "weekly") {
    const currentWeekStart = startOfKstWeek(today);

    return {
      startAt: addKstDays(currentWeekStart, -357),
      endAt: addKstDays(currentWeekStart, 7),
      bucketUnit: "week",
    };
  }

  if (period === "monthly") {
    const currentMonthStart = startOfKstMonth(now);

    return {
      startAt: addKstMonths(currentMonthStart, -35),
      endAt: addKstMonths(currentMonthStart, 1),
      bucketUnit: "month",
    };
  }

  const customStart = normalizeDateInput(startDate, "startDate");
  const customEnd = normalizeDateInput(endDate, "endDate");
  const customStartAt = customStart.value;
  const customEndAt = customEnd.value;

  if (customEndAt < customStartAt) {
    throw createHttpError(400, "endDate must be greater than or equal to startDate.");
  }

  const endAtExclusive = customEnd.hasTime
    ? new Date(customEndAt.getTime() + 60 * 1000)
    : addKstDays(customEndAt, 1);

  return {
    startAt: customStartAt,
    endAt: endAtExclusive,
    bucketUnit: getCustomBucketUnit(customStartAt, endAtExclusive),
  };
}

function buildWhereClause({ startAt, endAt, siteId, zoneId }) {
  const where = {
    periodType: "hourly",
    statDate: {
      gte: startAt,
      lt: endAt,
    },
  };

  if (typeof siteId === "string" && siteId.trim()) {
    where.siteId = siteId.trim();
  }

  if (typeof zoneId === "string" && zoneId.trim()) {
    where.zoneId = zoneId.trim();
  }

  return where;
}

function getRangeDescriptor(period, startAt, endAt, bucketUnit) {
  return {
    period,
    range: {
      startAt,
      endAt,
    },
    bucketUnit,
  };
}

function startOfKstHour(date) {
  const parts = toKstParts(new Date(date));
  return createKstDate(parts.year, parts.month, parts.date, parts.hours);
}

function getRowTimeRange(row) {
  const rowStart = addHours(startOfKstDay(row.statDate), Number(row.hourSlot || 0));
  const rowEnd = addHours(rowStart, 1);
  return { rowStart, rowEnd };
}

function shouldIncludeRowInRange(row, startAt, endAt) {
  const { rowStart, rowEnd } = getRowTimeRange(row);
  return rowEnd > startAt && rowStart < endAt;
}

function getRowQueryRange(startAt, endAt) {
  const queryStart = startOfKstDay(startAt);
  const queryEnd = addKstDays(startOfKstDay(new Date(endAt.getTime() - 1)), 1);

  return {
    queryStart,
    queryEnd,
  };
}

function createBucketKey(date, bucketUnit) {
  const parts = toKstParts(new Date(date));

  if (bucketUnit === "hour") {
    return [
      parts.year,
      formatTwoDigits(parts.month + 1),
      formatTwoDigits(parts.date),
      formatTwoDigits(parts.hours),
    ].join("-");
  }

  if (bucketUnit === "day") {
    return [parts.year, formatTwoDigits(parts.month + 1), formatTwoDigits(parts.date)].join("-");
  }

  if (bucketUnit === "week") {
    const weekStart = startOfKstWeek(date);
    const weekParts = toKstParts(weekStart);

    return [
      weekParts.year,
      formatTwoDigits(weekParts.month + 1),
      formatTwoDigits(weekParts.date),
    ].join("-");
  }

  return [parts.year, formatTwoDigits(parts.month + 1)].join("-");
}

function formatBucketLabel(bucketStart, bucketUnit) {
  const parts = toKstParts(new Date(bucketStart));

  if (bucketUnit === "hour") {
    return `${formatTwoDigits(parts.month + 1)}/${formatTwoDigits(parts.date)} ${formatTwoDigits(parts.hours)}시`;
  }

  if (bucketUnit === "day") {
    return `${formatTwoDigits(parts.month + 1)}/${formatTwoDigits(parts.date)}`;
  }

  if (bucketUnit === "week") {
    return `${parts.month + 1}월 ${getWeekOfMonth(bucketStart)}주차`;
  }

  return `${parts.year}년 ${parts.month + 1}월`;
}

function getBucketEnd(bucketStart, bucketUnit) {
  if (bucketUnit === "hour") {
    return addHours(bucketStart, 1);
  }

  if (bucketUnit === "day") {
    return addKstDays(bucketStart, 1);
  }

  if (bucketUnit === "week") {
    return addKstDays(bucketStart, 7);
  }

  return addKstMonths(bucketStart, 1);
}

function buildBuckets(startAt, endAt, bucketUnit) {
  const buckets = [];
  let cursor =
    bucketUnit === "hour"
      ? startOfKstHour(startAt)
      : bucketUnit === "day"
        ? startOfKstDay(startAt)
        : bucketUnit === "week"
          ? startOfKstWeek(startAt)
          : startOfKstMonth(startAt);

  while (cursor < endAt) {
    const bucketStart = new Date(cursor);
    const bucketEnd = getBucketEnd(bucketStart, bucketUnit);

    buckets.push({
      key: createBucketKey(bucketStart, bucketUnit),
      label: formatBucketLabel(bucketStart, bucketUnit),
      startAt: bucketStart,
      endAt: bucketEnd,
      value: 0,
    });

    cursor = bucketEnd;
  }

  return buckets;
}

function getRowBucketStart(row, bucketUnit) {
  const baseDate = startOfKstDay(row.statDate);

  if (bucketUnit === "hour") {
    return addHours(baseDate, Number(row.hourSlot || 0));
  }

  if (bucketUnit === "day") {
    return baseDate;
  }

  if (bucketUnit === "week") {
    return startOfKstWeek(baseDate);
  }

  return startOfKstMonth(baseDate);
}

function mergeRowsIntoBuckets(buckets, rows, bucketUnit) {
  const bucketMap = new Map(buckets.map((bucket) => [bucket.key, bucket]));

  for (const row of rows) {
    const bucketStart = getRowBucketStart(row, bucketUnit);
    const key = createBucketKey(bucketStart, bucketUnit);
    const bucket = bucketMap.get(key);

    if (!bucket) {
      continue;
    }

    bucket.value += Number(row.totalVehicles || 0);
  }

  return buckets.map((bucket) => ({
    label: bucket.label,
    value: bucket.value,
    startAt: bucket.startAt,
    endAt: new Date(bucket.endAt.getTime() - 1000),
  }));
}

async function getStatisticsSummary({ period, siteId, zoneId, startDate, endDate }) {
  const normalizedPeriod = normalizePeriod(period);
  const { startAt, endAt, bucketUnit } = getRangeForPeriod(normalizedPeriod, {
    startDate,
    endDate,
  });
  const { queryStart, queryEnd } = getRowQueryRange(startAt, endAt);
  const where = buildWhereClause({ startAt: queryStart, endAt: queryEnd, siteId, zoneId });

  const rows = await prisma.trafficStatistic.findMany({
    where,
    select: {
      statDate: true,
      hourSlot: true,
      totalVehicles: true,
    },
  });
  const filteredRows = rows.filter((row) => shouldIncludeRowInRange(row, startAt, endAt));
  const totalVehicles = filteredRows.reduce((sum, row) => sum + Number(row.totalVehicles || 0), 0);

  return {
    ...getRangeDescriptor(normalizedPeriod, startAt, endAt, bucketUnit),
    summary: {
      totalVehicles,
      wrongWayEvents: 0,
      wrongWayRate: 0,
      pedestrianCount: 0,
    },
  };
}

async function getTrafficSeries({ period, siteId, zoneId, startDate, endDate }) {
  const normalizedPeriod = normalizePeriod(period);
  const { startAt, endAt, bucketUnit } = getRangeForPeriod(normalizedPeriod, {
    startDate,
    endDate,
  });
  const { queryStart, queryEnd } = getRowQueryRange(startAt, endAt);
  const where = buildWhereClause({ startAt: queryStart, endAt: queryEnd, siteId, zoneId });

  const rows = await prisma.trafficStatistic.findMany({
    where,
    select: {
      statDate: true,
      hourSlot: true,
      totalVehicles: true,
    },
    orderBy: [{ statDate: "asc" }, { hourSlot: "asc" }],
  });
  const filteredRows = rows.filter((row) => shouldIncludeRowInRange(row, startAt, endAt));

  const buckets = buildBuckets(startAt, endAt, bucketUnit);
  const series = mergeRowsIntoBuckets(buckets, filteredRows, bucketUnit);

  return {
    ...getRangeDescriptor(normalizedPeriod, startAt, endAt, bucketUnit),
    series,
    summary: {
      totalVehicles: series.reduce((sum, item) => sum + Number(item.value || 0), 0),
    },
  };
}

module.exports = {
  getStatisticsSummary,
  getTrafficSeries,
};
