const express = require("express");
const controller = require("./wrongway.controller");

const router = express.Router();

router.post("/wrongway", controller.receiveWrongWay);
router.get("/wrongway/history", controller.getWrongWayHistory);

module.exports = router;