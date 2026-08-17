const express = require("express");
const { authenticateToken } = require("../../middlewares/auth.middleware");
const controller = require("./wrongway.controller");

const router = express.Router();

router.post("/wrongway", controller.receiveWrongWay);
router.get("/wrongway/history", controller.getWrongWayHistory);
router.patch("/events/:id/status", authenticateToken, controller.updateWrongWayEventStatus);
router.get("/wrongway/test-payloads", controller.getWrongWayTestPayloads);
router.post("/wrongway/test/normal", controller.sendNormalDrivingTest);
router.post("/wrongway/test/normal-stream/start", controller.startNormalDrivingStream);
router.post("/wrongway/test/normal-stream/stop", controller.stopNormalDrivingStream);
router.get("/wrongway/test/normal-stream/status", controller.getNormalDrivingStreamStatus);
router.post("/wrongway/test/wrong-way", controller.sendWrongWayTest);
router.post("/wrongway/test/mixed-snapshot", controller.sendWrongWayTest);

module.exports = router;
