const jwt = require("jsonwebtoken");

const { config } = require("../config");
const { prisma } = require("../prisma/client");
const { logger } = require("../utils/logger");

function authenticateToken(req, res, next) {
  const authorizationHeader = req.headers.authorization || "";

  if (!authorizationHeader.startsWith("Bearer ")) {
    logger.warn("authentication failed: missing bearer token", {
      path: req.originalUrl,
      method: req.method,
    });

    return res.status(401).json({
      ok: false,
      message: "인증이 필요합니다.",
    });
  }

  const accessToken = authorizationHeader.slice(7).trim();

  if (!accessToken) {
    logger.warn("authentication failed: empty bearer token", {
      path: req.originalUrl,
      method: req.method,
    });

    return res.status(401).json({
      ok: false,
      message: "인증이 필요합니다.",
    });
  }

  jwt.verify(accessToken, config.jwtSecret, async (error, decoded) => {
    if (error) {
      logger.warn("authentication failed: invalid token", {
        path: req.originalUrl,
        method: req.method,
        message: error.message,
      });

      return res.status(401).json({
        ok: false,
        message: "유효하지 않은 토큰입니다.",
      });
    }

    try {
      const user = await prisma.user.findUnique({
        where: { id: decoded.id },
        select: {
          id: true,
          userId: true,
          role: true,
          isActive: true,
        },
      });

      if (!user || !user.isActive) {
        logger.warn("authentication failed: user unavailable", {
          path: req.originalUrl,
          method: req.method,
          userId: decoded.userId,
          userDbId: decoded.id,
        });

        return res.status(401).json({
          ok: false,
          message: "인증된 사용자를 찾을 수 없습니다.",
        });
      }

      req.user = {
        id: user.id,
        userId: user.userId,
        role: user.role,
      };

      logger.info("authentication succeeded", {
        path: req.originalUrl,
        method: req.method,
        userId: req.user.userId,
        role: req.user.role,
      });

      next();
    } catch (dbError) {
      logger.error("authentication failed: database lookup error", {
        path: req.originalUrl,
        method: req.method,
        message: dbError.message,
      });

      return res.status(500).json({
        ok: false,
        message: "인증 처리 중 오류가 발생했습니다.",
      });
    }
  });
}

module.exports = { authenticateToken };
