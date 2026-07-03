const express = require("express");
const controller = require("./controlBoard.controller");

const router = express.Router();

// 대시보드 화면/Swagger/curl에서 통합제어보드로 명령을 보낼 때 사용하는 진입점이다.
// controller -> service -> TCP client -> 통합제어보드 순서로 흐른다.
router.post("/control-board/commands", controller.sendCommand);

// 현장 테스트 중 최근에 어떤 명령을 보냈고 결과가 어땠는지 빠르게 확인하는 목록 API다.
router.get("/control-board/commands", controller.getCommands);

// 특정 commandId 하나의 전송 패킷, ACK, timeout 여부를 확인하는 상세 API다.
router.get("/control-board/commands/:id", controller.getCommand);

module.exports = router;
