const express = require("express");
const controller = require("./wrongway.controller");

const router = express.Router();

router.post("/wrongway", controller.receiveWrongWay);
router.get("/wrongway/history", controller.getWrongWayHistory);
router.get("/wrongway/test-payloads", controller.getWrongWayTestPayloads);

module.exports = router;
