const { ipKeyGenerator } = require("express-rate-limit");
const rateLimit = require("express-rate-limit");

const { logger } = require("../utils/logger");

const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 5;

// 인증된 사용자와 요청 IP를 함께 기준으로 비밀번호 확인 실패 횟수를 제한한다.
const passwordRateLimit = rateLimit({
  windowMs: WINDOW_MS,
  max: MAX_ATTEMPTS,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  keyGenerator(req) {
    const userId = String(req.user?.id || req.params?.id || "").trim();
    const ipAddress = ipKeyGenerator(req.ip || "");
    return `${userId}::${ipAddress}`;
  },
  handler(req, res) {
    logger.warn("password verification blocked by rate limit", {
      requesterId: req.user?.id,
      requesterUserId: req.user?.userId,
      ipAddress: req.ip,
      path: req.originalUrl,
      method: req.method,
    });

    res.status(429).json({
      ok: false,
      message: "비밀번호 확인 요청이 너무 많습니다. 잠시 후 다시 시도해주세요.",
    });
  },
});

module.exports = { passwordRateLimit };
