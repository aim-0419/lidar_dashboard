const { rateLimit, ipKeyGenerator } = require("express-rate-limit");

const { logger } = require("../utils/logger");

const WINDOW_MS = 10 * 60 * 1000;

function normalizeKeyPart(value) {
  return String(value || "").trim().toLowerCase();
}

// 계정 존재 여부와 무관하게 항상 같은 응답을 주므로, 남용을 막는 건 이 rate limit이 거의 전부다.
const passwordResetSendCodeRateLimit = rateLimit({
  windowMs: WINDOW_MS,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator(req) {
    return normalizeKeyPart(ipKeyGenerator(req.ip || ""));
  },
  handler(req, res) {
    logger.warn("password reset code send blocked by express rate limit", {
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

// IP 기준 제한은 공격자가 IP를 여러 개로 나눠 같은 이메일을 노리면 사실상 무력화된다.
// 이메일 기준으로도 따로 제한해서, 한 계정(이메일)에 대한 총 시도량 자체를 막는다.
const passwordResetSendCodeByEmailRateLimit = rateLimit({
  windowMs: WINDOW_MS,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator(req) {
    return normalizeKeyPart(req.body?.email);
  },
  handler(req, res) {
    logger.warn("password reset code send blocked by per-email rate limit", {
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

const passwordResetVerifyCodeRateLimit = rateLimit({
  windowMs: WINDOW_MS,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator(req) {
    return normalizeKeyPart(ipKeyGenerator(req.ip || ""));
  },
  handler(req, res) {
    logger.warn("password reset code verify blocked by express rate limit", {
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

// IP 분산 공격으로부터 특정 이메일(계정)의 실제 코드 추측 시도 총량을 제한한다.
const passwordResetVerifyCodeByEmailRateLimit = rateLimit({
  windowMs: WINDOW_MS,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator(req) {
    return normalizeKeyPart(req.body?.email);
  },
  handler(req, res) {
    logger.warn("password reset code verify blocked by per-email rate limit", {
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

const passwordResetConfirmRateLimit = rateLimit({
  windowMs: WINDOW_MS,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator(req) {
    return normalizeKeyPart(ipKeyGenerator(req.ip || ""));
  },
  handler(req, res) {
    logger.warn("password reset confirm blocked by express rate limit", {
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

module.exports = {
  passwordResetSendCodeRateLimit,
  passwordResetSendCodeByEmailRateLimit,
  passwordResetVerifyCodeRateLimit,
  passwordResetVerifyCodeByEmailRateLimit,
  passwordResetConfirmRateLimit,
};
