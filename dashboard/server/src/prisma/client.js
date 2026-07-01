const { PrismaClient } = require("@prisma/client");
const { PrismaPg } = require("@prisma/adapter-pg");
const { logger } = require("../utils/logger");

// 개발 중 hot reload나 반복 import가 생겨도 Prisma 연결 객체를 재사용합니다.
const globalForPrisma = globalThis;
const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });

const prisma =
  globalForPrisma.__lidarDashboardPrisma ||
  new PrismaClient({
    adapter,
    log: [
      { emit: "event", level: "error" },
      { emit: "event", level: "warn" },
    ],
  });

prisma.$on("error", (event) => {
  logger.error("prisma error", {
    target: event.target,
    message: event.message,
  });
});

prisma.$on("warn", (event) => {
  logger.warn("prisma warning", {
    target: event.target,
    message: event.message,
  });
});

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.__lidarDashboardPrisma = prisma;
}

module.exports = { prisma };
