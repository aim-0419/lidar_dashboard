const express = require("express");
const { getZonesBySiteController } = require("./zones.controller");

const router = express.Router();

router.get("/sites/:siteId/zones", getZonesBySiteController);

module.exports = router;