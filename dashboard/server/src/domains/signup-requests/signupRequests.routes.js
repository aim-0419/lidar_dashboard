const express = require("express");
const { authenticateToken, requireRole } = require("../../middlewares/auth.middleware");
const {
  signupRateLimit,
  signupAvailabilityRateLimit,
} = require("../../middlewares/signup-rate-limit.middleware");
const {
  signupEmailCodeSendRateLimit,
  signupEmailCodeSendByEmailRateLimit,
  signupEmailCodeVerifyRateLimit,
  signupEmailCodeVerifyByEmailRateLimit,
} = require("../../middlewares/signup-email-rate-limit.middleware");
const {
  createSignupRequest,
  checkSignupRequestUserId,
  sendSignupEmailCode,
  verifySignupEmailCode,
  getSignupRequests,
  approveSignupRequest,
  rejectSignupRequest,
} = require("./signupRequests.controller");

const router = express.Router();

router.get("/signup-requests/availability", signupAvailabilityRateLimit, checkSignupRequestUserId);
router.post(
  "/signup-requests/email/send-code",
  signupEmailCodeSendRateLimit,
  signupEmailCodeSendByEmailRateLimit,
  sendSignupEmailCode,
);
router.post(
  "/signup-requests/email/verify-code",
  signupEmailCodeVerifyRateLimit,
  signupEmailCodeVerifyByEmailRateLimit,
  verifySignupEmailCode,
);
router.post("/signup-requests", signupRateLimit, createSignupRequest);
router.get("/signup-requests", authenticateToken, requireRole("SUPER_ADMIN"), getSignupRequests);
router.patch("/signup-requests/:id/approve", authenticateToken, requireRole("SUPER_ADMIN"), approveSignupRequest);
router.patch("/signup-requests/:id/reject", authenticateToken, requireRole("SUPER_ADMIN"), rejectSignupRequest);

module.exports = router;
