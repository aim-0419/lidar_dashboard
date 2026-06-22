const express = require("express");
const controller = require("./externalIngest.controller");

// router는 /api 아래에 붙을 external-ingest URL들을 한 곳에 모은다.
const router = express.Router();

// 외부 장비 연동 전까지 Swagger/curl로 수신 흐름을 검증하기 위한 ingest API 묶음이다.
router.post("/ingest/lidar/mock", controller.receiveLidarMock);
router.post("/ingest/control-board/mock", controller.receiveControlBoardMock);
router.post("/ingest/control-board/serial/test", controller.testControlBoardSerial);
router.get("/ingest/events/recent", controller.getRecentEvents);

module.exports = router;
