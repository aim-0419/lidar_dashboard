const express = require("express");
const { getSitesController, getSiteByIdController } = require("./sites.controller");

const router = express.Router();

router.get("/sites", getSitesController);
router.get("/sites/:id", getSiteByIdController);

module.exports = router;