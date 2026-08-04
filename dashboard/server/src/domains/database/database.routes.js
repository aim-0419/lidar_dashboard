const express = require("express");
const { authenticateToken } = require("../../middlewares/auth.middleware");
const { getDatabaseHealthController } = require("./database.controller");

const router = express.Router();

router.get("/database/health", authenticateToken, getDatabaseHealthController);

module.exports = router;
