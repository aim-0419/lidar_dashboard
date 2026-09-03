const express = require("express");
const authRoutes = require("../domains/auth/auth.routes");
const controlBoardRoutes = require("../domains/control-board/controlBoard.routes");
const databaseRoutes = require("../domains/database/database.routes");
const demoRoutes = require("../domains/demo/demo.routes");
const devicesRoutes = require("../domains/devices/devices.routes");
const externalIngestRoutes = require("../domains/external-ingest/externalIngest.routes");
const mockLidarRoutes = require("../domains/mock-lidar/mockLidar.routes");
const sitesRoutes = require("../domains/sites/sites.routes");
const signupRequestsRoutes = require("../domains/signup-requests/signupRequests.routes");
const statisticsRoutes = require("../domains/statistics/statistics.routes");
const usersRoutes = require("../domains/users/users.routes");
const wrongwayRoutes = require("../domains/wrongway/wrongway.routes");
const zonesRoutes = require("../domains/zones/zones.routes");

const router = express.Router();

router.get("/health", (req, res) => {
  res.json({ ok: true, ts: new Date().toISOString() });
});

router.use(authRoutes);
router.use(demoRoutes);
router.use(controlBoardRoutes);
router.use(databaseRoutes);
router.use(devicesRoutes);
router.use(externalIngestRoutes);
router.use(mockLidarRoutes);
router.use(sitesRoutes);
router.use(signupRequestsRoutes);
router.use(statisticsRoutes);
router.use(usersRoutes);
router.use(wrongwayRoutes);
router.use(zonesRoutes);

module.exports = router;
