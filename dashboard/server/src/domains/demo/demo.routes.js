const express = require("express");
const { authenticateToken, requireRole } = require("../../middlewares/auth.middleware");
const controller = require("./demo.controller");

const router = express.Router();

router.post("/demo/start", authenticateToken, requireRole("SUPER_ADMIN"), controller.startDemo);
router.post("/demo/reset", authenticateToken, requireRole("SUPER_ADMIN"), controller.resetDemo);

module.exports = router;
