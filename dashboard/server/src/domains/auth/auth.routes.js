const express = require("express");
const { authenticateToken } = require("../../middlewares/auth.middleware");
const { login, refresh, logout, me } = require("./auth.controller");

const router = express.Router();

router.post("/auth/login", login);
router.post("/auth/refresh", refresh);
router.post("/auth/logout", logout);
router.get("/auth/me", authenticateToken, me);

module.exports = router;
