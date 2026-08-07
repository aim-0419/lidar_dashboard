const crypto = require("crypto");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const { config } = require("../../config");
const { prisma } = require("../../prisma/client");
const { logger } = require("../../utils/logger");

const INVALID_LOGIN_MESSAGE = "?꾩씠???먮뒗 鍮꾨?踰덊샇媛 ?щ컮瑜댁? ?딆뒿?덈떎.";
const LOGIN_RATE_LIMIT_MESSAGE = "濡쒓렇???쒕룄媛 ?덈Т 留롮뒿?덈떎. ?좎떆 ???ㅼ떆 ?쒕룄?댁＜?몄슂.";
const INVALID_REFRESH_TOKEN_MESSAGE = "?좏슚?섏? ?딆? refresh token?낅땲??";
const REFRESH_TOKEN_EXPIRES_IN = "7d";
const REFRESH_TOKEN_EXPIRES_IN_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_LOGIN_FAILURES = 5;
const LOGIN_BLOCK_DURATION_MS = 15 * 60 * 1000;

// userId + IP 기준 로그인 실패 횟수를 서버 메모리에 임시 저장합니다.
const loginAttemptStore = new Map();

function createHttpError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function normalizeRole(role) {
  return String(role || "").toLowerCase();
}

function normalizeLoginKeyPart(value) {
  return String(value || "").trim().toLowerCase();
}

// 같은 userId와 IP의 반복 실패를 하나의 키로 묶기 위한 값을 만듭니다.
function buildLoginAttemptKey(userId, ipAddress) {
  return `${normalizeLoginKeyPart(userId)}::${normalizeLoginKeyPart(ipAddress)}`;
}

// 차단 시간이 지난 메모리 기록은 정리해서 불필요하게 남지 않도록 합니다.
function cleanupLoginAttempt(key, now = Date.now()) {
  const attempt = loginAttemptStore.get(key);

  if (!attempt) {
    return;
  }

  if (attempt.blockedUntil && attempt.blockedUntil > now) {
    return;
  }

  if (now - attempt.lastFailedAt >= LOGIN_BLOCK_DURATION_MS) {
    loginAttemptStore.delete(key);
  }
}

// 현재 userId + IP 조합이 차단 상태면 로그인 로직을 바로 중단합니다.
function assertLoginAttemptAllowed(userId, ipAddress) {
  const key = buildLoginAttemptKey(userId, ipAddress);
  const now = Date.now();

  cleanupLoginAttempt(key, now);

  const attempt = loginAttemptStore.get(key);

  if (!attempt) {
    return key;
  }

  if (attempt.blockedUntil && attempt.blockedUntil > now) {
    logger.warn("login blocked by rate limit", {
      userId,
      ipAddress,
      blockedUntil: new Date(attempt.blockedUntil).toISOString(),
      failureCount: attempt.failureCount,
    });

    throw createHttpError(429, LOGIN_RATE_LIMIT_MESSAGE);
  }

  return key;
}

// 실패 횟수를 올리고 임계치에 도달하면 일정 시간 로그인 시도를 막습니다.
function recordLoginFailure(key, { userId, ipAddress }) {
  const now = Date.now();
  const currentAttempt = loginAttemptStore.get(key);

  if (!currentAttempt || now - currentAttempt.lastFailedAt >= LOGIN_BLOCK_DURATION_MS) {
    loginAttemptStore.set(key, {
      failureCount: 1,
      lastFailedAt: now,
      blockedUntil: null,
    });

    logger.warn("login failure recorded", {
      userId,
      ipAddress,
      failureCount: 1,
    });
    return;
  }

  const nextFailureCount = currentAttempt.failureCount + 1;
  const nextBlockedUntil = nextFailureCount >= MAX_LOGIN_FAILURES
    ? now + LOGIN_BLOCK_DURATION_MS
    : null;

  loginAttemptStore.set(key, {
    failureCount: nextFailureCount,
    lastFailedAt: now,
    blockedUntil: nextBlockedUntil,
  });

  logger.warn("login failure recorded", {
    userId,
    ipAddress,
    failureCount: nextFailureCount,
    blockedUntil: nextBlockedUntil ? new Date(nextBlockedUntil).toISOString() : null,
  });
}

// 로그인에 성공하면 해당 키의 실패 기록을 즉시 초기화합니다.
function clearLoginFailures(key) {
  loginAttemptStore.delete(key);
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
      sessionVersion: user.sessionVersion,
    },
    config.jwtSecret,
    { expiresIn: "1h" },
  );
}

async function login({ userId, password, ipAddress }) {
  logger.info("login attempt received", {
    userId,
    ipAddress,
  });

  // DB 조회나 비밀번호 검증 전에 현재 userId + IP 차단 여부를 먼저 확인합니다.
  const loginAttemptKey = assertLoginAttemptAllowed(userId, ipAddress);

  if (!userId || !password) {
    logger.warn("login failed: missing credentials", {
      userId,
      ipAddress,
    });
    // 자격 증명이 비어 있는 경우도 로그인 실패로 간주합니다.
    recordLoginFailure(loginAttemptKey, { userId, ipAddress });
    throw createHttpError(401, INVALID_LOGIN_MESSAGE);
  }

  logger.info("login user lookup started", {
    userId,
    ipAddress,
  });

  const user = await prisma.user.findUnique({
    where: { userId },
  });

  if (!user) {
    logger.warn("login failed: user not found", {
      userId,
      ipAddress,
    });
    recordLoginFailure(loginAttemptKey, { userId, ipAddress });
    throw createHttpError(401, INVALID_LOGIN_MESSAGE);
  }

  if (!user.isActive) {
    logger.warn("login failed: inactive user", {
      userId,
      ipAddress,
      userDbId: user.id,
    });
    recordLoginFailure(loginAttemptKey, { userId, ipAddress });
    throw createHttpError(401, INVALID_LOGIN_MESSAGE);
  }

  logger.info("login password verification started", {
    userId,
    ipAddress,
    userDbId: user.id,
  });

  const isPasswordMatched = await bcrypt.compare(password, user.passwordHash);

  if (!isPasswordMatched) {
    logger.warn("login failed: password mismatch", {
      userId,
      ipAddress,
      userDbId: user.id,
    });
    recordLoginFailure(loginAttemptKey, { userId, ipAddress });
    throw createHttpError(401, INVALID_LOGIN_MESSAGE);
  }

  // 로그인 성공 시 이 키의 메모리 기반 제한 상태를 초기화합니다.
  clearLoginFailures(loginAttemptKey);

  const refreshToken = jwt.sign(
    {
      id: user.id,
      jti: crypto.randomUUID(),
    },
    config.jwtRefreshSecret,
    { expiresIn: REFRESH_TOKEN_EXPIRES_IN },
  );
  const refreshTokenHash = hashRefreshToken(refreshToken);
  const refreshTokenExpiresAt = new Date(Date.now() + REFRESH_TOKEN_EXPIRES_IN_MS);
  const loginAt = new Date();

  const updatedUser = await prisma.$transaction(async (tx) => {
    await tx.refreshToken.updateMany({
      where: {
        userId: user.id,
        revokedAt: null,
      },
      data: {
        revokedAt: loginAt,
      },
    });

    const nextUser = await tx.user.update({
      where: { id: user.id },
      data: {
        lastLoginAt: loginAt,
        sessionVersion: {
          increment: 1,
        },
      },
    });

    await tx.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash: refreshTokenHash,
        expiresAt: refreshTokenExpiresAt,
        revokedAt: null,
      },
    });

    return nextUser;
  });

  logger.info("login refresh tokens rotated", {
    userId: updatedUser.userId,
    userDbId: updatedUser.id,
    ipAddress,
    sessionVersion: updatedUser.sessionVersion,
    refreshTokenExpiresAt: refreshTokenExpiresAt.toISOString(),
  });

  const accessToken = createAccessToken(updatedUser);

  logger.info("login token issuance completed", {
    userId: updatedUser.userId,
    userDbId: updatedUser.id,
    ipAddress,
    role: normalizeRole(updatedUser.role),
    sessionVersion: updatedUser.sessionVersion,
  });

  logger.info("login completed successfully", {
    userId: updatedUser.userId,
    userDbId: updatedUser.id,
    ipAddress,
    role: normalizeRole(updatedUser.role),
    sessionVersion: updatedUser.sessionVersion,
  });

  return {
    ok: true,
    accessToken,
    refreshToken,
    user: {
      id: updatedUser.id,
      userId: updatedUser.userId,
      name: updatedUser.name,
      role: normalizeRole(updatedUser.role),
    },
  };
}

async function refreshAccessToken({ refreshToken }) {
  logger.info("refresh token request received");

  if (!refreshToken) {
    logger.warn("refresh token request failed: missing cookie token");
    throw createHttpError(401, INVALID_REFRESH_TOKEN_MESSAGE);
  }

  try {
    jwt.verify(refreshToken, config.jwtRefreshSecret);
  } catch (error) {
    logger.warn("refresh token request failed: invalid jwt", {
      message: error.message,
    });
    throw createHttpError(401, INVALID_REFRESH_TOKEN_MESSAGE);
  }

  const refreshTokenHash = hashRefreshToken(refreshToken);
  const now = new Date();

  const storedToken = await prisma.refreshToken.findFirst({
    where: {
      tokenHash: refreshTokenHash,
      revokedAt: null,
      expiresAt: {
        gt: now,
      },
    },
    include: {
      user: true,
    },
  });

  if (!storedToken) {
    logger.warn("refresh token request failed: token row not found or inactive");
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
    sessionVersion: storedToken.user.sessionVersion,
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
  let decoded = null;

  try {
    decoded = jwt.verify(refreshToken, config.jwtRefreshSecret);
  } catch (error) {
    logger.warn("logout request skipped: invalid refresh jwt", {
      message: error.message,
    });
  }

  const logoutAt = new Date();

  await prisma.$transaction(async (tx) => {
    await tx.refreshToken.updateMany({
      where: {
        tokenHash: refreshTokenHash,
        revokedAt: null,
      },
      data: {
        revokedAt: logoutAt,
      },
    });

    if (decoded?.id) {
      await tx.user.updateMany({
        where: {
          id: decoded.id,
        },
        data: {
          sessionVersion: {
            increment: 1,
          },
        },
      });
    }
  });

  logger.info("logout request completed successfully", {
    userDbId: decoded?.id,
  });

  return { ok: true };
}

module.exports = { login, refreshAccessToken, logout, hashRefreshToken };

