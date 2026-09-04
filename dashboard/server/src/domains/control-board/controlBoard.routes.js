const express = require("express");
const { authenticateToken, requireRole } = require("../../middlewares/auth.middleware");
const controller = require("./controlBoard.controller");

const router = express.Router();

// 이 라우터는 /api에 경로 없이 등록되므로 권한 검사를 명령 API에만 적용한다.
router.post("/control-board/commands", authenticateToken, requireRole("SUPER_ADMIN"), controller.sendCommand);
router.get("/control-board/commands", authenticateToken, requireRole("SUPER_ADMIN"), controller.getCommands);
router.get("/control-board/commands/:id", authenticateToken, requireRole("SUPER_ADMIN"), controller.getCommand);

module.exports = router;
