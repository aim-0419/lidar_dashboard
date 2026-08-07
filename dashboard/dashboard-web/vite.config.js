import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  // 프론트엔드도 프로젝트 루트 .env를 공통 환경변수 기준으로 사용한다.
  envDir: "../..",
  plugins: [react()],
  server: {
    // Docker 컨테이너 외부의 브라우저에서도 Vite 개발 서버에 접근할 수 있게 한다.
    host: "0.0.0.0",
    port: 5173,
    strictPort: true,
    watch: {
      // Docker Desktop의 bind mount 변경 이벤트 누락을 방지한다.
      usePolling: true,
      interval: 300,
    },
  },
});
