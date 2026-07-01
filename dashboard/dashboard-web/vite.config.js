import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  // 프론트엔드도 프로젝트 루트 .env를 공통 환경변수 기준으로 사용한다.
  envDir: "../..",
  plugins: [react()],
});
