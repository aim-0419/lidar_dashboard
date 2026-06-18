const express = require("express");
const controller = require("./demo.controller");

const router = express.Router();

router.post("/demo/start", controller.startDemo);
router.post("/demo/reset", controller.resetDemo);

module.exports = router;