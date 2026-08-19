const { WebSocketServer } = require("ws");
const { URL } = require("url");

const { config } = require("../config");
const { verifyAndConsumeWebSocketTicket } = require("../domains/auth/auth.service");
const mockLidarService = require("../domains/mock-lidar/mockLidar.service");
const { logger } = require("../utils/logger");

function initWebSocket(server) {
  const wss = new WebSocketServer({ server });

  // 인증된 websocket 클라이언트에게만 실시간 이벤트를 브로드캐스트한다. 
  function broadcast(type, payload) {
    const msg = JSON.stringify({ type, ts: Date.now(), payload });

    wss.clients.forEach((client) => {
      if (client.readyState === 1 && client.isAuthenticated) client.send(msg);
    });
  }

  // 연결 시 전달된 ticket을 검증한 뒤 인증된 사용자만 websocket 접속을 허용한다. 
  wss.on("connection", async (ws, req) => {
    try {
      const requestUrl = new URL(req.url || "/", config.dashboardBaseUrl);
      const ticket = requestUrl.searchParams.get("ticket");
      const authUser = await verifyAndConsumeWebSocketTicket(ticket);

      ws.isAuthenticated = true;
      ws.authUser = authUser;

      logger.info("websocket connection accepted", {
        userId: authUser.userId,
        userDbId: authUser.id,
        role: authUser.role,
        ipAddress: req.socket?.remoteAddress,
      });

      ws.send(JSON.stringify({
        type: "state",
        ts: Date.now(),
        payload: mockLidarService.getState(),
      }));

      ws.send(JSON.stringify({
        type: "logs",
        ts: Date.now(),
        payload: mockLidarService.getLogs(10),
      }));
    } catch (error) {
      logger.warn("websocket connection rejected", {
        ipAddress: req.socket?.remoteAddress,
        message: error.message,
      });

      ws.close(1008, "Unauthorized");
    }
  });

  return { broadcast };
}

module.exports = { initWebSocket };
