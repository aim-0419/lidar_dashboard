const http = require("http");

const { app } = require("./src/app");
const { config } = require("./src/config");
const { initWebSocket } = require("./src/realtime/websocket");
const { setBroadcaster } = require("./src/domains/mock-lidar/mockLidar.service");
const { startLidarSimulator } = require("./src/simulator/lidarSimulator");

const server = http.createServer(app);
const { broadcast } = initWebSocket(server);

setBroadcaster(broadcast);
startLidarSimulator();

server.listen(config.port, "0.0.0.0", () => {
  console.log(`Server started and listening on port ${config.port}`);
  console.log(`REST  ${config.dashboardBaseUrl}/api/state`);
  console.log(`WS    ${config.dashboardBaseUrl.replace(/^http/, "ws")}`);
  console.log(`Detector proxy ${config.detectorBaseUrl}`);
});