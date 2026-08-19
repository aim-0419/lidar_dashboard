const rateLimit = require("express-rate-limit");

const { logger } = require("../utils/logger");

const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 5;

function normalizeLoginKeyPart(value) {
  return String(value || "").trim().toLowerCase();
}

const loginRateLimit = rateLimit({
  windowMs: WINDOW_MS,
  max: MAX_ATTEMPTS,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  keyGenerator(req) {
    const userId = normalizeLoginKeyPart(req.body?.userId);
    const ipAddress = normalizeLoginKeyPart(req.ip);
    return `${userId}::${ipAddress}`;
  },
  handler(req, res) {
    logger.warn("login blocked by express rate limit", {
      userId: req.body?.userId,
      ipAddress: req.ip,
      path: req.originalUrl,
      method: req.method,
    });

    res.status(429).json({
      ok: false,
      message: "Too many login attempts. Please try again later.",
    });
  },
});

module.exports = { loginRateLimit };
