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
  logger.info("로그인 시도 수신", {
    userId,
  });

  if (!userId || !password) {
    logger.warn("로그인 실패: 필수 인증 정보 누락", {
      userId,
    });
    throw createHttpError(401, INVALID_LOGIN_MESSAGE);
  }

  logger.info("로그인 사용자 조회 시작", {
    userId,
  });

  const user = await prisma.user.findUnique({
    where: { userId },
  });

  if (!user) {
    logger.warn("로그인 실패: 사용자 없음", {
      userId,
    });
    throw createHttpError(401, INVALID_LOGIN_MESSAGE);
  }

  if (!user.isActive) {
    logger.warn("로그인 실패: 비활성 사용자", {
      userId,
      userDbId: user.id,
    });
    throw createHttpError(401, INVALID_LOGIN_MESSAGE);
  }

  logger.info("로그인 비밀번호 검증 시작", {
    userId,
    userDbId: user.id,
  });

  const isPasswordMatched = await bcrypt.compare(password, user.passwordHash);

  if (!isPasswordMatched) {
    logger.warn("로그인 실패: 비밀번호 불일치", {
      userId,
      userDbId: user.id,
    });
    throw createHttpError(401, INVALID_LOGIN_MESSAGE);
  }

  const accessToken = jwt.sign(
    {
      id: user.id,
      userId: user.userId,
      role: user.role,
    },
    config.jwtSecret,
    { expiresIn: "1h" },
  );

  const refreshToken = jwt.sign(
    {
      id: user.id,
    },
    config.jwtRefreshSecret,
    { expiresIn: "7d" },
  );

  logger.info("로그인 토큰 발급 완료", {
    userId: user.userId,
    userDbId: user.id,
    role: normalizeRole(user.role),
  });

  await prisma.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() },
  });

  logger.info("로그인 lastLoginAt 업데이트 완료", {
    userId: user.userId,
    userDbId: user.id,
  });

  logger.info("로그인 성공", {
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

module.exports = { login };
