const express = require("express");
const {
  getDevicesController,
  getDeviceByIdController,
  getDevicesByZoneController,
  getDeviceStatusController,
} = require("./devices.controller");

const router = express.Router();

router.get("/devices", getDevicesController);
router.get("/devices/:id", getDeviceByIdController);
router.get("/devices/:id/status", getDeviceStatusController);
router.get("/zones/:zoneId/devices", getDevicesByZoneController);

module.exports = router;