const express = require("express");
const { authenticateToken } = require("../../middlewares/auth.middleware");
const { getSummary } = require("./statistics.controller");

const router = express.Router();

router.get("/statistics/summary", authenticateToken, getSummary);

module.exports = router;
