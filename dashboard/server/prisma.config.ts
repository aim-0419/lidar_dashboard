import { config as loadEnv } from "dotenv";
import { defineConfig } from "prisma/config";

// Prisma CLI도 프로젝트 루트 .env만 기준으로 사용한다.
loadEnv({ path: "../../.env", override: true });

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "node prisma/seed.js",
  },
  datasource: {
    url: process.env["DATABASE_URL"],
  },
});
