const express = require("express");
const { getZonesController, getZonesBySiteController } = require("./zones.controller");

const router = express.Router();

router.get("/zones", getZonesController);
router.get("/sites/:siteId/zones", getZonesBySiteController);

module.exports = router;