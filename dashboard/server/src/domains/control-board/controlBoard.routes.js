const express = require("express");
const { authenticateToken } = require("../../middlewares/auth.middleware");
const controller = require("./controlBoard.controller");

const router = express.Router();

router.use(authenticateToken);
router.post("/control-board/commands", controller.sendCommand);
router.get("/control-board/commands", controller.getCommands);
router.get("/control-board/commands/:id", controller.getCommand);

module.exports = router;
