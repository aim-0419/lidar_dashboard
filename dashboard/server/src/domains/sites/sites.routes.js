const express = require("express");
const { getSitesController } = require("./sites.controller");

const router = express.Router();

router.get("/sites", getSitesController);

module.exports = router;