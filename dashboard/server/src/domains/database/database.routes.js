const express = require("express");
const { getDatabaseHealthController } = require("./database.controller");

const router = express.Router();

router.get("/database/health", getDatabaseHealthController);

module.exports = router;
