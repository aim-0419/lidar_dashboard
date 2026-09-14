const { rateLimit, ipKeyGenerator } = require("express-rate-limit");

const { logger } = require("../utils/logger");

const WINDOW_MS = 10 * 60 * 1000;

function normalizeKeyPart(value) {
  return String(value || "").trim().toLowerCase();
}

// 인증코드 발송은 메일 비용·스팸성 재발송을 막기 위해 더 엄격하게 제한한다.
const signupEmailCodeSendRateLimit = rateLimit({
  windowMs: WINDOW_MS,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator(req) {
    return normalizeKeyPart(ipKeyGenerator(req.ip || ""));
  },
  handler(req, res) {
    logger.warn("signup email code send blocked by express rate limit", {
      email: req.body?.email,
      ipAddress: req.ip,
      path: req.originalUrl,
      method: req.method,
    });

    res.status(429).json({
      ok: false,
      message: "인증코드 요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.",
    });
  },
});

// 코드 확인은 정상적인 오타 재시도를 감안해 발송보다 여유 있게 허용한다.
// (레코드별 시도 횟수 제한은 서비스 로직에서 별도로 적용된다.)
const signupEmailCodeVerifyRateLimit = rateLimit({
  windowMs: WINDOW_MS,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator(req) {
    return normalizeKeyPart(ipKeyGenerator(req.ip || ""));
  },
  handler(req, res) {
    logger.warn("signup email code verify blocked by express rate limit", {
      email: req.body?.email,
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

module.exports = { signupEmailCodeSendRateLimit, signupEmailCodeVerifyRateLimit };
