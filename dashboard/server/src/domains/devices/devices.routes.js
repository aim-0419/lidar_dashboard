const express = require("express");
const { authenticateToken } = require("../../middlewares/auth.middleware");
const {
  getDevicesController,
  getDeviceByIdController,
  getDevicesByZoneController,
  getDeviceStatusController,
} = require("./devices.controller");

const router = express.Router();

router.get("/devices", authenticateToken, getDevicesController);
router.get("/devices/:id", authenticateToken, getDeviceByIdController);
router.get("/devices/:id/status", authenticateToken, getDeviceStatusController);
router.get("/zones/:zoneId/devices", authenticateToken, getDevicesByZoneController);

module.exports = router;
