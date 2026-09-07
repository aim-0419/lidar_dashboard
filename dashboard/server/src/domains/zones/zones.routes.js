const express = require("express");
const { authenticateToken } = require("../../middlewares/auth.middleware");
const {
  getZonesController,
  getZonesBySiteController,
  getZoneByIdController,
} = require("./zones.controller");

const router = express.Router();

router.get("/zones", authenticateToken, getZonesController);
router.get("/zones/:id", authenticateToken, getZoneByIdController);
router.get("/sites/:siteId/zones", authenticateToken, getZonesBySiteController);

module.exports = router;
