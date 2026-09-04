const express = require("express");
const { authenticateToken, requireRole } = require("../../middlewares/auth.middleware");
const controller = require("./controlBoard.controller");

const router = express.Router();

router.post("/control-board/commands", authenticateToken, requireRole("SUPER_ADMIN"), controller.sendCommand);
router.get("/control-board/commands", authenticateToken, requireRole("SUPER_ADMIN"), controller.getCommands);
router.get("/control-board/commands/:id", authenticateToken, requireRole("SUPER_ADMIN"), controller.getCommand);

module.exports = router;
