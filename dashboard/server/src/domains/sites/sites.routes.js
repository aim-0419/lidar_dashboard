const express = require("express");
const { authenticateToken } = require("../../middlewares/auth.middleware");
const { getSitesController, getSiteByIdController } = require("./sites.controller");

const router = express.Router();

router.use(authenticateToken);
router.get("/sites", getSitesController);
router.get("/sites/:id", getSiteByIdController);

module.exports = router;
