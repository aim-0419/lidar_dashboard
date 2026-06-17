const express = require("express");
const controller = require("./mockLidar.controller");

const router = express.Router();

router.get("/state", controller.getState);
router.get("/logs", controller.getLogs);

router.post("/gate/open", controller.openGate);
router.post("/gate/close", controller.closeGate);
router.post("/vms", controller.setVms);
router.post("/vehicle/pass", controller.passVehicle);

module.exports = router;