const express = require("express");
const { getMe } = require("./users.controller");
const { authenticateToken } = require("../../middlewares/auth.middleware");

const router = express.Router();

router.get("/users/me", authenticateToken, getMe);

module.exports = router;
