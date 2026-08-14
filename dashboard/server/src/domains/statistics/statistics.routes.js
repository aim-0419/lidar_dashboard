const express = require("express");
const { authenticateToken } = require("../../middlewares/auth.middleware");
const { getSummary, getTrafficSeries } = require("./statistics.controller");

const router = express.Router();

router.get("/statistics/summary", authenticateToken, getSummary);
router.get("/statistics/traffic-series", authenticateToken, getTrafficSeries);

module.exports = router;
