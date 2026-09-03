const { rateLimit, ipKeyGenerator } = require("express-rate-limit");

const { logger } = require("../utils/logger");

const WINDOW_MS = 10 * 60 * 1000;
const MAX_ATTEMPTS = 5;

function normalizeKeyPart(value) {
  return String(value || "").trim().toLowerCase();
}

const signupRateLimit = rateLimit({
  windowMs: WINDOW_MS,
  max: MAX_ATTEMPTS,
  standardHeaders: true,
  legacyHeaders: false,
  // userId를 바꿔도 우회할 수 없도록 IP 단위로 가입 신청을 제한한다.
  keyGenerator(req) {
    return normalizeKeyPart(ipKeyGenerator(req.ip || ""));
  },
  handler(req, res) {
    logger.warn("signup request blocked by express rate limit", {
      userId: req.body?.userId,
      ipAddress: req.ip,
      path: req.originalUrl,
      method: req.method,
    });

    res.status(429).json({
      ok: false,
      message: "가입 신청 요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.",
    });
  },
});

const signupAvailabilityRateLimit = rateLimit({
  windowMs: WINDOW_MS,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator(req) {
    return ipKeyGenerator(req.ip || "");
  },
  handler(req, res) {
    logger.warn("signup user id availability check blocked by express rate limit", {
      ipAddress: req.ip,
      path: req.originalUrl,
      method: req.method,
    });

    res.status(429).json({
      ok: false,
      message: "요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.",
    });
  },
});

const signupCancelRateLimit = rateLimit({
  windowMs: WINDOW_MS,
  max: MAX_ATTEMPTS,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator(req) {
    return ipKeyGenerator(req.ip || "");
  },
  handler(req, res) {
    logger.warn("signup cancellation blocked by express rate limit", {
      userId: req.body?.userId,
      ipAddress: req.ip,
      path: req.originalUrl,
      method: req.method,
    });

    res.status(429).json({
      ok: false,
      message: "가입 신청 취소 요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.",
    });
  },
});

module.exports = { signupRateLimit, signupAvailabilityRateLimit, signupCancelRateLimit };
