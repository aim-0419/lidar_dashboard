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
  // userId를 바꿔 요청 횟수 제한을 우회하지 못하도록 IP 단위로 제한합니다.
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
  // 공개 API를 통한 사용자 ID 존재 여부 조회를 최소화한다.
  max: 10,
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

module.exports = { signupRateLimit, signupAvailabilityRateLimit };
