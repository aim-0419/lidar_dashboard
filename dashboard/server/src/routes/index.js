const express = require("express");
const demoRoutes = require("../domains/demo/demo.routes");
const externalIngestRoutes = require("../domains/external-ingest/externalIngest.routes");
const mockLidarRoutes = require("../domains/mock-lidar/mockLidar.routes");
const wrongwayRoutes = require("../domains/wrongway/wrongway.routes");

const router = express.Router();

router.get("/health", (req, res) => {
  res.json({ ok: true, ts: new Date().toISOString() });
});

router.use(demoRoutes);
router.use(externalIngestRoutes);
router.use(mockLidarRoutes);
router.use(wrongwayRoutes);

module.exports = router;
