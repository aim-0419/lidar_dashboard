const express = require("express");
const { authenticateToken, requireRole } = require("../../middlewares/auth.middleware");
const {
  signupRateLimit,
  signupAvailabilityRateLimit,
  signupCancelRateLimit,
} = require("../../middlewares/signup-rate-limit.middleware");
const {
  createSignupRequest,
  checkSignupRequestUserId,
  getSignupRequests,
  approveSignupRequest,
  rejectSignupRequest,
  cancelSignupRequest,
} = require("./signupRequests.controller");

const router = express.Router();

router.get("/signup-requests/availability", signupAvailabilityRateLimit, checkSignupRequestUserId);
router.post("/signup-requests", signupRateLimit, createSignupRequest);
router.get("/signup-requests", authenticateToken, requireRole("SUPER_ADMIN"), getSignupRequests);
router.patch("/signup-requests/:id/approve", authenticateToken, requireRole("SUPER_ADMIN"), approveSignupRequest);
router.patch("/signup-requests/:id/reject", authenticateToken, requireRole("SUPER_ADMIN"), rejectSignupRequest);
router.patch("/signup-requests/:id/cancel", signupCancelRateLimit, cancelSignupRequest);

module.exports = router;
