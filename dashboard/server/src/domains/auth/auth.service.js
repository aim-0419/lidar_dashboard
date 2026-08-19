const crypto = require("crypto");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const { config } = require("../../config");
const { prisma } = require("../../prisma/client");
const { logger } = require("../../utils/logger");

const INVALID_LOGIN_MESSAGE = "아이디 또는 비밀번호가 올바르지 않습니다.";
const INVALID_REFRESH_TOKEN_MESSAGE = "유효하지 않은 refresh token입니다.";
const INVALID_WS_TICKET_MESSAGE = "유효하지 않은 WebSocket 티켓입니다.";
const REFRESH_TOKEN_EXPIRES_IN = "7d";
const REFRESH_TOKEN_EXPIRES_IN_MS = 7 * 24 * 60 * 60 * 1000;
const WS_TICKET_EXPIRES_IN = "30s";
const WS_TICKET_EXPIRES_IN_SECONDS = 30;

// 이미 사용한 websocket 티켓을 메모리에 잠시 저장해 재사용을 막는다.
const usedWebSocketTicketStore = new Map();

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

function hashRefreshToken(refreshToken) {
  return crypto.createHash("sha256").update(refreshToken).digest("hex");
}

// 만료된 WebSocket 티켓 기록은 주기적으로 정리한다. 
function cleanupUsedWebSocketTickets(nowInSeconds = Math.floor(Date.now() / 1000)) {
  for (const [ticketId, expiresAt] of usedWebSocketTicketStore.entries()) {
    if (expiresAt <= nowInSeconds) {
      usedWebSocketTicketStore.delete(ticketId);
    }
  }
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

// 로그인된 사용자 전용의 짧은 수명 websocket 접속 티켓을 발급한다. 
function createWebSocketTicket(user) {
  return jwt.sign(
    {
      type: "ws",
      id: user.id,
      userId: user.userId,
      role: user.role,
      sessionVersion: user.sessionVersion,
      jti: crypto.randomUUID(),
    },
    config.jwtSecret,
    { expiresIn: WS_TICKET_EXPIRES_IN },
  );
}

async function login({ userId, password, ipAddress }) {
  logger.info("login attempt received", {
    userId,
    ipAddress,
  });

  if (!userId || !password) {
    logger.warn("login failed: missing credentials", {
      userId,
      ipAddress,
    });
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
    throw createHttpError(401, INVALID_LOGIN_MESSAGE);
  }

  if (!user.isActive) {
    logger.warn("login failed: inactive user", {
      userId,
      ipAddress,
      userDbId: user.id,
    });
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
    throw createHttpError(401, INVALID_LOGIN_MESSAGE);
  }

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
    const revokedResult = await tx.refreshToken.updateMany({
      where: {
        tokenHash: refreshTokenHash,
        revokedAt: null,
      },
      data: {
        revokedAt: logoutAt,
      },
    });

    if (decoded?.id && revokedResult.count > 0) {
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

// HTTP 인증이 완료된 사용자에게 Websocket 연결용 티켓을 내려준다. 
async function issueWebSocketTicket({ user }) {
  if (!user?.id || !user?.userId) {
    throw createHttpError(401, INVALID_WS_TICKET_MESSAGE);
  }

  cleanupUsedWebSocketTickets();

  const ticket = createWebSocketTicket(user);

  logger.info("websocket ticket issued", {
    userId: user.userId,
    userDbId: user.id,
    role: normalizeRole(user.role),
    sessionVersion: user.sessionVersion,
  });

  return {
    ok: true,
    ticket,
    expiresInSeconds: WS_TICKET_EXPIRES_IN_SECONDS,
  };
}

// Websocket 연결 시 전달된 티켓을 검증하고 1회용으로 소모 처리한다. 
async function verifyAndConsumeWebSocketTicket(ticket) {
  if (!ticket) {
    throw createHttpError(401, INVALID_WS_TICKET_MESSAGE);
  }

  cleanupUsedWebSocketTickets();

  let decoded;

  try {
    decoded = jwt.verify(ticket, config.jwtSecret);
  } catch (error) {
    logger.warn("websocket ticket verification failed: invalid jwt", {
      message: error.message,
    });
    throw createHttpError(401, INVALID_WS_TICKET_MESSAGE);
  }

  if (decoded?.type !== "ws" || !decoded?.jti || !decoded?.id) {
    logger.warn("websocket ticket verification failed: malformed payload");
    throw createHttpError(401, INVALID_WS_TICKET_MESSAGE);
  }

  const ticketExpiresAt =
    typeof decoded.exp === "number"
      ? decoded.exp
      : Math.floor(Date.now() / 1000) + WS_TICKET_EXPIRES_IN_SECONDS;

  if (usedWebSocketTicketStore.has(decoded.jti)) {
    logger.warn("websocket ticket verification failed: reused ticket", {
      userDbId: decoded.id,
      userId: decoded.userId,
      ticketId: decoded.jti,
    });
    throw createHttpError(401, INVALID_WS_TICKET_MESSAGE);
  }

  usedWebSocketTicketStore.set(decoded.jti, ticketExpiresAt);

  let user;

  try {
    user = await prisma.user.findUnique({
      where: { id: decoded.id },
      select: {
        id: true,
        userId: true,
        role: true,
        isActive: true,
        sessionVersion: true,
      },
    });

    if (!user || !user.isActive) {
      logger.warn("websocket ticket verification failed: user unavailable", {
        userDbId: decoded.id,
        userId: decoded.userId,
      });
      throw createHttpError(401, INVALID_WS_TICKET_MESSAGE);
    }

    if (typeof decoded.sessionVersion !== "number" || decoded.sessionVersion !== user.sessionVersion) {
      logger.warn("websocket ticket verification failed: session version mismatch", {
        userDbId: decoded.id,
        userId: decoded.userId,
        tokenSessionVersion: decoded.sessionVersion,
        currentSessionVersion: user.sessionVersion,
      });
      throw createHttpError(401, INVALID_WS_TICKET_MESSAGE);
    }
  } catch (error) {
    usedWebSocketTicketStore.delete(decoded.jti);
    throw error;
  }

  logger.info("websocket ticket verified successfully", {
    userDbId: user.id,
    userId: user.userId,
    role: normalizeRole(user.role),
    sessionVersion: user.sessionVersion,
    ticketId: decoded.jti,
  });

  return {
    id: user.id,
    userId: user.userId,
    role: user.role,
    sessionVersion: user.sessionVersion,
  };
}

module.exports = {
  login,
  refreshAccessToken,
  logout,
  hashRefreshToken,
  issueWebSocketTicket,
  verifyAndConsumeWebSocketTicket,
};
