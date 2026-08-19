const express = require("express");
const { authenticateToken, requireRole } = require("../../middlewares/auth.middleware");
const controller = require("./externalIngest.controller");

// router는 /api 아래에 붙을 external-ingest URL들을 한 곳에 모은다.
const router = express.Router();

// 외부 장비 연동 전까지 Swagger/curl로 수신 흐름을 검증하기 위한 ingest API 묶음이다.
router.post("/ingest/lidar", controller.receiveLidar);
router.post("/ingest/lidar/mock", authenticateToken, requireRole("SUPER_ADMIN"), controller.receiveLidarMock);
router.post("/ingest/control-board", controller.receiveControlBoard);
router.post("/ingest/control-board/mock", authenticateToken, requireRole("SUPER_ADMIN"), controller.receiveControlBoardMock);
router.post("/ingest/control-board/serial/test", authenticateToken, requireRole("SUPER_ADMIN"), controller.testControlBoardSerial);
router.get("/ingest/status", authenticateToken, controller.getIngestStatus);
router.get("/ingest/events/recent", authenticateToken, controller.getRecentEvents);

module.exports = router;
