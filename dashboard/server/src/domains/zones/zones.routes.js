const express = require("express");
const { authenticateToken } = require("../../middlewares/auth.middleware");
const {
  getZonesController,
  getZonesBySiteController,
  getZoneByIdController,
} = require("./zones.controller");

const router = express.Router();

router.use(authenticateToken);
router.get("/zones", getZonesController);
router.get("/zones/:id", getZoneByIdController);
router.get("/sites/:siteId/zones", getZonesBySiteController);

module.exports = router;
