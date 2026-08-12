const { prisma } = require("../../prisma/client");

const PERIODS = new Set(["daily", "weekly", "monthly"]);

function createHttpError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function normalizePeriod(period) {
  const value = String(period || "daily").trim().toLowerCase();

  if (!PERIODS.has(value)) {
    throw createHttpError(400, "period must be one of daily, weekly, or monthly.");
  }

  return value;
}

function startOfDay(date) {
  const value = new Date(date);
  value.setHours(0, 0, 0, 0);
  return value;
}

function addDays(date, days) {
  const value = new Date(date);
  value.setDate(value.getDate() + days);
  return value;
}

function startOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function addMonths(date, months) {
  return new Date(date.getFullYear(), date.getMonth() + months, 1);
}

function getRangeForPeriod(period) {
  const now = new Date();
  const today = startOfDay(now);

  if (period === "daily") {
    return {
      startAt: today,
      endAt: addDays(today, 1),
    };
  }

  if (period === "weekly") {
    return {
      startAt: addDays(today, -6),
      endAt: addDays(today, 1),
    };
  }

  return {
    startAt: startOfMonth(now),
    endAt: addMonths(startOfMonth(now), 1),
  };
}

async function getStatisticsSummary({ period, siteId, zoneId }) {
  const normalizedPeriod = normalizePeriod(period);
  const { startAt, endAt } = getRangeForPeriod(normalizedPeriod);

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

  const result = await prisma.trafficStatistic.aggregate({
    where,
    _sum: {
      totalVehicles: true,
    },
  });

  return {
    period: normalizedPeriod,
    range: {
      startAt,
      endAt,
    },
    summary: {
      totalVehicles: Number(result._sum.totalVehicles || 0),
      wrongWayEvents: 0,
      wrongWayRate: 0,
      pedestrianCount: 0,
    },
  };
}

module.exports = {
  getStatisticsSummary,
};
