const express = require("express");
const {
  getZonesController,
  getZonesBySiteController,
  getZoneByIdController,
} = require("./zones.controller");

const router = express.Router();

router.get("/zones", getZonesController);
router.get("/zones/:id", getZoneByIdController);
router.get("/sites/:siteId/zones", getZonesBySiteController);

module.exports = router;