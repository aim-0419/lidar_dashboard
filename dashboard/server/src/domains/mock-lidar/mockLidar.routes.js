const express = require("express");
const { authenticateToken, requireRole } = require("../../middlewares/auth.middleware");
const controller = require("./mockLidar.controller");

const router = express.Router();

router.get("/state", authenticateToken, controller.getState);
router.get("/control/status", authenticateToken, controller.getControlStatus);
router.get("/logs", authenticateToken, controller.getLogs);

router.post("/gate/open", authenticateToken, requireRole("SUPER_ADMIN"), controller.openGate);
router.post("/gate/close", authenticateToken, requireRole("SUPER_ADMIN"), controller.closeGate);
router.post("/vms", authenticateToken, requireRole("SUPER_ADMIN"), controller.setVms);
router.post("/vehicle/pass", authenticateToken, requireRole("SUPER_ADMIN"), controller.passVehicle);

module.exports = router;
