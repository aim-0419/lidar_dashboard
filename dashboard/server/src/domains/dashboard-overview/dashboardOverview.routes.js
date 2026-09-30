const express = require("express");
const { authenticateToken } = require("../../middlewares/auth.middleware");
const { getDashboardOverviewController } = require("./dashboardOverview.controller");

const router = express.Router();

router.get("/dashboard/overview", authenticateToken, getDashboardOverviewController);

module.exports = router;
