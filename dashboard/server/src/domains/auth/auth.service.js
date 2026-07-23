const crypto = require("crypto");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const { config } = require("../../config");
const { prisma } = require("../../prisma/client");
const { logger } = require("../../utils/logger");

const INVALID_LOGIN_MESSAGE = "아이디 또는 비밀번호가 올바르지 않습니다.";
const INVALID_REFRESH_TOKEN_MESSAGE = "유효하지 않은 리프레시 토큰입니다.";
const REFRESH_TOKEN_EXPIRES_IN = "7d";
const REFRESH_TOKEN_EXPIRES_IN_MS = 7 * 24 * 60 * 60 * 1000;

function createHttpError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function normalizeRole(role) {
  return String(role || "").toLowerCase();
}

function hashRefreshToken(refreshToken) {
  return crypto.createHash("sha256").update(refreshToken).digest("hex");
}

function createAccessToken(user) {
  return jwt.sign(
    {
      id: user.id,
      userId: user.userId,
      role: user.role,
    },
    config.jwtSecret,
    { expiresIn: "1h" },
  );
}

async function login({ userId, password }) {
  logger.info("login attempt received", {
    userId,
  });

  if (!userId || !password) {
    logger.warn("login failed: missing credentials", {
      userId,
    });
    throw createHttpError(401, INVALID_LOGIN_MESSAGE);
  }

  logger.info("login user lookup started", {
    userId,
  });

  const user = await prisma.user.findUnique({
    where: { userId },
  });

  if (!user) {
    logger.warn("login failed: user not found", {
      userId,
    });
    throw createHttpError(401, INVALID_LOGIN_MESSAGE);
  }

  if (!user.isActive) {
    logger.warn("login failed: inactive user", {
      userId,
      userDbId: user.id,
    });
    throw createHttpError(401, INVALID_LOGIN_MESSAGE);
  }

  logger.info("login password verification started", {
    userId,
    userDbId: user.id,
  });

  const isPasswordMatched = await bcrypt.compare(password, user.passwordHash);

  if (!isPasswordMatched) {
    logger.warn("login failed: password mismatch", {
      userId,
      userDbId: user.id,
    });
    throw createHttpError(401, INVALID_LOGIN_MESSAGE);
  }

  const refreshToken = jwt.sign(
    {
      id: user.id,
    },
    config.jwtRefreshSecret,
    { expiresIn: REFRESH_TOKEN_EXPIRES_IN },
  );
  const refreshTokenHash = hashRefreshToken(refreshToken);
  const refreshTokenExpiresAt = new Date(Date.now() + REFRESH_TOKEN_EXPIRES_IN_MS);

  await prisma.$transaction([
    prisma.refreshToken.updateMany({
      where: {
        userId: user.id,
        revokedAt: null,
      },
      data: {
        revokedAt: new Date(),
      },
    }),
    prisma.user.update({
      where: { id: user.id },
      data: {
        lastLoginAt: new Date(),
      },
    }),
    prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash: refreshTokenHash,
        expiresAt: refreshTokenExpiresAt,
        revokedAt: null,
      },
    }),
  ]);

  logger.info("login refresh tokens rotated", {
    userId: user.userId,
    userDbId: user.id,
    refreshTokenExpiresAt: refreshTokenExpiresAt.toISOString(),
  });

  const accessToken = createAccessToken(user);

  logger.info("login token issuance completed", {
    userId: user.userId,
    userDbId: user.id,
    role: normalizeRole(user.role),
  });

  logger.info("login completed successfully", {
    userId: user.userId,
    userDbId: user.id,
    role: normalizeRole(user.role),
  });

  return {
    ok: true,
    accessToken,
    refreshToken,
    user: {
      id: user.id,
      userId: user.userId,
      name: user.name,
      role: normalizeRole(user.role),
    },
  };
}

async function refreshAccessToken({ refreshToken }) {
  logger.info("refresh token request received");

  if (!refreshToken) {
    logger.warn("refresh token request failed: missing cookie token");
    throw createHttpError(401, INVALID_REFRESH_TOKEN_MESSAGE);
  }

  let decoded;

  try {
    decoded = jwt.verify(refreshToken, config.jwtRefreshSecret);
  } catch (error) {
    logger.warn("refresh token request failed: invalid jwt", {
      message: error.message,
    });
    throw createHttpError(401, INVALID_REFRESH_TOKEN_MESSAGE);
  }

  const refreshTokenHash = hashRefreshToken(refreshToken);

  const storedToken = await prisma.refreshToken.findFirst({
    where: {
      tokenHash: refreshTokenHash,
    },
    include: {
      user: true,
    },
  });

  if (!storedToken) {
    logger.warn("refresh token request failed: token row not found", {
      userDbId: decoded.id,
    });
    throw createHttpError(401, INVALID_REFRESH_TOKEN_MESSAGE);
  }

  if (storedToken.revokedAt) {
    logger.warn("refresh token request failed: token revoked", {
      userDbId: storedToken.userId,
      revokedAt: storedToken.revokedAt.toISOString(),
    });
    throw createHttpError(401, INVALID_REFRESH_TOKEN_MESSAGE);
  }

  if (storedToken.expiresAt <= new Date()) {
    logger.warn("refresh token request failed: token expired", {
      userDbId: storedToken.userId,
      expiresAt: storedToken.expiresAt.toISOString(),
    });
    throw createHttpError(401, INVALID_REFRESH_TOKEN_MESSAGE);
  }

  if (!storedToken.user || !storedToken.user.isActive) {
    logger.warn("refresh token request failed: user unavailable", {
      userDbId: storedToken.userId,
    });
    throw createHttpError(401, INVALID_REFRESH_TOKEN_MESSAGE);
  }

  const accessToken = createAccessToken(storedToken.user);

  logger.info("refresh token request completed successfully", {
    userId: storedToken.user.userId,
    userDbId: storedToken.user.id,
  });

  return {
    ok: true,
    accessToken,
  };
}

async function logout({ refreshToken }) {
  logger.info("logout request received");

  if (!refreshToken) {
    logger.warn("logout request skipped: missing cookie token");
    return { ok: true };
  }

  const refreshTokenHash = hashRefreshToken(refreshToken);

  await prisma.refreshToken.updateMany({
    where: {
      tokenHash: refreshTokenHash,
      revokedAt: null,
    },
    data: {
      revokedAt: new Date(),
    },
  });

  logger.info("logout request completed successfully");

  return { ok: true };
}

module.exports = { login, refreshAccessToken, logout, hashRefreshToken };
