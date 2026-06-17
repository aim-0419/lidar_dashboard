const mockLidarService = require("../domains/mock-lidar/mockLidar.service");

function startLidarSimulator() {
  return setInterval(() => {
    mockLidarService.updateLidarStats();
  }, 1000);
}

module.exports = { startLidarSimulator };