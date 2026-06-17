const { WebSocketServer } = require("ws");
const mockLidarService = require("../domains/mock-lidar/mockLidar.service");

function initWebSocket(server) {
  const wss = new WebSocketServer({ server });

  function broadcast(type, payload) {
    const msg = JSON.stringify({ type, ts: Date.now(), payload });

    wss.clients.forEach((client) => {
      if (client.readyState === 1) client.send(msg);
    });
  }

  wss.on("connection", (ws) => {
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
  });

  return { broadcast };
}

module.exports = { initWebSocket };