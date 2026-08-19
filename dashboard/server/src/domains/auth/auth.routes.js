const express = require("express");
const { authenticateToken } = require("../../middlewares/auth.middleware");
const { loginRateLimit } = require("../../middlewares/login-rate-limit.middleware");
const { login, refresh, logout, me, wsTicket } = require("./auth.controller");

const router = express.Router();

router.post("/auth/login", loginRateLimit, login);
router.post("/auth/refresh", refresh);
router.post("/auth/logout", logout);
router.post("/auth/ws-ticket", authenticateToken, wsTicket); // 실시간 대시보드 연결 전에 사용할 websocket 티켓 발급 API. 
router.get("/auth/me", authenticateToken, me);

module.exports = router;
