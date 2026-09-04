const express = require("express");
const { authenticateToken } = require("../../middlewares/auth.middleware");
const { getSitesController, getSiteByIdController } = require("./sites.controller");

const router = express.Router();

router.get("/sites", authenticateToken, getSitesController);
router.get("/sites/:id", authenticateToken, getSiteByIdController);

module.exports = router;
