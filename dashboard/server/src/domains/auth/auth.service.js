const crypto = require("crypto");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const { config } = require("../../config");
const { prisma } = require("../../prisma/client");
const { logger } = require("../../utils/logger");

const INVALID_LOGIN_MESSAGE = "아이디 또는 비밀번호가 올바르지 않습니다.";

function createHttpError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function normalizeRole(role) {
  return String(role || "").toLowerCase();
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

  const sessionId = crypto.randomUUID();

  await prisma.user.update({
    where: { id: user.id },
    data: {
      currentSessionId: sessionId,
      lastLoginAt: new Date(),
    },
  });

  logger.info("login session issued", {
    userId: user.userId,
    userDbId: user.id,
    sessionId,
  });

  const accessToken = jwt.sign(
    {
      id: user.id,
      userId: user.userId,
      role: user.role,
      sessionId,
    },
    config.jwtSecret,
    { expiresIn: "1h" },
  );

  const refreshToken = jwt.sign(
    {
      id: user.id,
      sessionId,
    },
    config.jwtRefreshSecret,
    { expiresIn: "7d" },
  );

  logger.info("login token issuance completed", {
    userId: user.userId,
    userDbId: user.id,
    role: normalizeRole(user.role),
    sessionId,
  });

  logger.info("login completed successfully", {
    userId: user.userId,
    userDbId: user.id,
    role: normalizeRole(user.role),
    sessionId,
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

module.exports = { login };
