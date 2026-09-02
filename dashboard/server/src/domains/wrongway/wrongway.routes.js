const express = require("express");
const { authenticateToken, requireRole } = require("../../middlewares/auth.middleware");
const controller = require("./wrongway.controller");

const router = express.Router();

router.post("/wrongway", controller.receiveWrongWay);
router.get("/wrongway/history", authenticateToken, controller.getWrongWayHistory);
router.patch("/events/:id/status", authenticateToken, requireRole("SUPER_ADMIN"), controller.updateWrongWayEventStatus);
router.get("/wrongway/test-payloads", authenticateToken, requireRole("SUPER_ADMIN"), controller.getWrongWayTestPayloads);
router.post("/wrongway/test/normal", authenticateToken, requireRole("SUPER_ADMIN"), controller.sendNormalDrivingTest);
router.post("/wrongway/test/normal-stream/start", authenticateToken, requireRole("SUPER_ADMIN"), controller.startNormalDrivingStream);
router.post("/wrongway/test/normal-stream/stop", authenticateToken, requireRole("SUPER_ADMIN"), controller.stopNormalDrivingStream);
router.get("/wrongway/test/normal-stream/status", authenticateToken, requireRole("SUPER_ADMIN"), controller.getNormalDrivingStreamStatus);
router.post("/wrongway/test/wrong-way", authenticateToken, requireRole("SUPER_ADMIN"), controller.sendWrongWayTest);
router.post("/wrongway/test/mixed-snapshot", authenticateToken, requireRole("SUPER_ADMIN"), controller.sendWrongWayTest);

module.exports = router;
