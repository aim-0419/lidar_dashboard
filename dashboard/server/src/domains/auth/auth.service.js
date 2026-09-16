const crypto = require("crypto");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const { config } = require("../../config");
const { prisma } = require("../../prisma/client");
const { logger } = require("../../utils/logger");
const { sendEmail } = require("../../utils/mailer");
const { renderLayout } = require("../../emails/renderLayout");
const { getPasswordValidationError, isValidPassword, MIN_PASSWORD_LENGTH, MAX_PASSWORD_BYTES } = require(
  "../../utils/credential-policy",
);
const { cleanupExpiredEmailVerifications } = require("../../utils/email-verification-maintenance");

const INVALID_LOGIN_MESSAGE = "아이디 또는 비밀번호가 올바르지 않습니다.";
const INVALID_REFRESH_TOKEN_MESSAGE = "유효하지 않은 refresh token입니다.";
const INVALID_WS_TICKET_MESSAGE = "유효하지 않은 WebSocket 티켓입니다.";
const REFRESH_TOKEN_EXPIRES_IN = "7d";
const REFRESH_TOKEN_EXPIRES_IN_MS = 7 * 24 * 60 * 60 * 1000;
const WS_TICKET_EXPIRES_IN = "30s";
const WS_TICKET_EXPIRES_IN_SECONDS = 30;

// 비밀번호 재설정도 가입 인증과 같은 EmailVerification 테이블을 purpose로 구분해 재사용한다.
const PASSWORD_RESET_PURPOSE = "PASSWORD_RESET";
const PASSWORD_RESET_CODE_LENGTH = 6;
const PASSWORD_RESET_CODE_TTL_MINUTES = 10;
const PASSWORD_RESET_CODE_MAX_ATTEMPTS = 5;
const PASSWORD_RESET_CODE_RESEND_COOLDOWN_SECONDS = 60;
const PASSWORD_RESET_TOKEN_TTL_MINUTES = 15;
const PASSWORD_RESET_TOKEN_TYPE = "password_reset";
// 계정 존재 여부가 노출되지 않도록 실제 발송 성공/실패, 쿨다운 여부와 무관하게 항상 같은 응답을 준다.
const PASSWORD_RESET_GENERIC_RESPONSE = {
  ok: true,
  message: "입력하신 이메일로 가입된 계정이 있다면 인증코드를 보냈습니다.",
};
const INVALID_PASSWORD_RESET_CODE_MESSAGE = "인증코드가 올바르지 않습니다.";
// 계정이 없거나 쿨다운으로 실제 발송을 건너뛸 때도, 존재하는 계정과 비슷한 시간이 걸리도록
// 더미로 해싱해 응답 시간 차이로 계정 존재 여부가 새는 것을 줄인다. 실제 코드로 쓰이지 않는다.
const DUMMY_PASSWORD_RESET_CODE = "000000";

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

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function generatePasswordResetCode() {
  const value = crypto.randomInt(0, 10 ** PASSWORD_RESET_CODE_LENGTH);
  return String(value).padStart(PASSWORD_RESET_CODE_LENGTH, "0");
}

function validateNewPassword(password) {
  if (!isValidPassword(password)) {
    const errorCode = getPasswordValidationError(password);
    const message =
      errorCode === "TOO_LONG"
        ? `비밀번호는 ${MAX_PASSWORD_BYTES}바이트 이하로 입력해 주세요.`
        : `비밀번호는 ${MIN_PASSWORD_LENGTH}자 이상 입력해 주세요.`;
    throw createHttpError(400, message);
  }
}

// 비밀번호를 잊은 사용자에게 6자리 인증코드를 발송한다.
// 계정 존재 여부, 재발송 쿨다운, 메일 발송 성공 여부와 무관하게 항상 같은 응답을 돌려준다.
async function requestPasswordResetCode({ email }) {
  // 이 테이블은 가입 인증(SIGNUP)과 공유하는데, 비밀번호 찾기 쪽은 가입 신청 관리 화면처럼
  // 주기적으로 열어보는 진입점이 없어 별도로 정리해 주지 않으면 만료 레코드가 계속 쌓인다.
  await cleanupExpiredEmailVerifications(prisma);

  const normalizedEmail = normalizeEmail(email);

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
    return PASSWORD_RESET_GENERIC_RESPONSE;
  }

  const user = await prisma.user.findUnique({
    where: { email: normalizedEmail },
    select: { id: true, isActive: true },
  });

  if (!user || !user.isActive) {
    // 실제 발송 경로(해싱+메일 전송)와 걸리는 시간을 비슷하게 맞춰, 응답 속도로 계정 존재
    // 여부가 새지 않도록 한다. 네트워크 발송 시간까지 완전히 맞출 수는 없지만, 가장 큰
    // 시간차 요인인 bcrypt 해싱 비용은 동일하게 맞춘다.
    await bcrypt.hash(DUMMY_PASSWORD_RESET_CODE, 10);
    logger.info("password reset code request skipped: no matching active user", {
      email: normalizedEmail,
    });
    return PASSWORD_RESET_GENERIC_RESPONSE;
  }

  const now = new Date();
  const code = generatePasswordResetCode();
  const codeHash = await bcrypt.hash(code, 10);
  const expiresAt = new Date(now.getTime() + PASSWORD_RESET_CODE_TTL_MINUTES * 60 * 1000);

  // 쿨다운 확인과 레코드 생성을 이메일 단위 advisory lock으로 묶어 원자적으로 처리한다.
  // (단순 조회 후 생성 방식은, 연속 클릭이나 여러 IP에서 거의 동시에 들어온 요청이 쿨다운
  // 체크를 동시에 통과해 이메일이 중복 발송될 수 있다.)
  const reserved = await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`password_reset:${normalizedEmail}`}))`;

    const latest = await tx.emailVerification.findFirst({
      where: { email: normalizedEmail, purpose: PASSWORD_RESET_PURPOSE },
      orderBy: { createdAt: "desc" },
    });

    if (latest && now.getTime() - latest.createdAt.getTime() < PASSWORD_RESET_CODE_RESEND_COOLDOWN_SECONDS * 1000) {
      return null;
    }

    return tx.emailVerification.create({
      data: { email: normalizedEmail, purpose: PASSWORD_RESET_PURPOSE, codeHash, expiresAt },
    });
  });

  if (!reserved) {
    logger.info("password reset code request skipped: cooldown active", { email: normalizedEmail });
    return PASSWORD_RESET_GENERIC_RESPONSE;
  }

  const html = renderLayout({
    heading: "비밀번호 재설정 인증코드",
    contentHtml:
      `<p>비밀번호 재설정을 위한 인증코드입니다.</p>` +
      `<p style="font-size:28px;font-weight:800;letter-spacing:6px;">${code}</p>` +
      `<p>이 코드는 ${PASSWORD_RESET_CODE_TTL_MINUTES}분간 유효합니다.</p>`,
    footerNote: "본인이 요청하지 않았다면 이 메일을 무시하셔도 됩니다.",
  });

  const result = await sendEmail({
    to: normalizedEmail,
    subject: "[라이다 관제] 비밀번호 재설정 인증코드",
    html,
    text: `인증코드: ${code} (${PASSWORD_RESET_CODE_TTL_MINUTES}분간 유효)`,
  });

  // 발송 실패해도 계정 존재를 노출하지 않도록 동일 응답을 유지하고, 레코드는 남기지 않는다.
  if (!result.delivered && !result.skipped) {
    logger.warn("password reset code email failed", { email: normalizedEmail, error: result.error });
    await prisma.emailVerification.deleteMany({ where: { id: reserved.id } });
  }

  return PASSWORD_RESET_GENERIC_RESPONSE;
}

// 인증코드를 확인하고, 다음 단계(새 비밀번호 설정)에서 쓸 단기 유효 resetToken을 발급한다.
// "코드를 요청한 적 없음"과 "코드가 틀림"을 같은 오류로 응답해 계정 존재 여부가 새지 않게 한다.
async function verifyPasswordResetCode({ email, code }) {
  const normalizedEmail = normalizeEmail(email);
  // code ?? "" (|| 아님): 클라이언트가 "000000"처럼 0으로만 이뤄진 코드를 JSON 숫자로 보내면
  // 값이 숫자 0이 되어 falsy라 code || ""가 빈 문자열로 지워버린다.
  const normalizedCode = String(code ?? "").trim();

  if (!/^\d{6}$/.test(normalizedCode)) {
    throw createHttpError(400, "인증코드는 숫자 6자리로 입력해야 합니다.");
  }

  const now = new Date();
  const verification = await prisma.emailVerification.findFirst({
    where: { email: normalizedEmail, purpose: PASSWORD_RESET_PURPOSE },
    orderBy: { createdAt: "desc" },
  });

  if (!verification || verification.consumedAt || verification.expiresAt <= now) {
    throw createHttpError(400, INVALID_PASSWORD_RESET_CODE_MESSAGE);
  }

  if (verification.attempts >= PASSWORD_RESET_CODE_MAX_ATTEMPTS) {
    throw createHttpError(429, "시도 횟수를 초과했습니다. 인증코드를 다시 요청해 주세요.");
  }

  // 시도 슬롯을 원자적으로 먼저 선점한다(attempts < MAX을 DB에서 다시 확인). 위 확인은
  // 동시 요청 사이의 시차 때문에 완전하지 않으므로, 실제 소비되는 시도 횟수가 MAX를 넘지
  // 못하게 하는 건 이 원자적 업데이트다.
  const claim = await prisma.emailVerification.updateMany({
    where: { id: verification.id, consumedAt: null, attempts: { lte: PASSWORD_RESET_CODE_MAX_ATTEMPTS - 1 } },
    data: { attempts: { increment: 1 } },
  });

  if (claim.count !== 1) {
    throw createHttpError(429, "시도 횟수를 초과했습니다. 인증코드를 다시 요청해 주세요.");
  }

  const isMatch = await bcrypt.compare(normalizedCode, verification.codeHash);

  if (!isMatch) {
    throw createHttpError(400, INVALID_PASSWORD_RESET_CODE_MESSAGE);
  }

  // 일치할 때도 소비 처리를 원자적으로 한다 — 같은(올바른) 코드로 동시에 여러 요청이 와도
  // 딱 하나만 resetToken을 받도록 한다.
  const consumed = await prisma.emailVerification.updateMany({
    where: { id: verification.id, consumedAt: null },
    data: { consumedAt: now },
  });

  if (consumed.count !== 1) {
    throw createHttpError(400, INVALID_PASSWORD_RESET_CODE_MESSAGE);
  }

  const resetToken = jwt.sign(
    { type: PASSWORD_RESET_TOKEN_TYPE, email: normalizedEmail, verificationId: verification.id },
    config.jwtSecret,
    { expiresIn: `${PASSWORD_RESET_TOKEN_TTL_MINUTES}m` },
  );

  logger.info("password reset code verified", { email: normalizedEmail });

  return { ok: true, resetToken };
}

// 인증을 마친 resetToken으로 실제 비밀번호를 변경하고, 기존 로그인 세션을 모두 무효화한다.
async function confirmPasswordReset({ resetToken, newPassword }) {
  if (!resetToken) {
    throw createHttpError(400, "인증이 필요합니다. 처음부터 다시 시도해 주세요.");
  }

  validateNewPassword(newPassword);

  let decoded;

  try {
    decoded = jwt.verify(resetToken, config.jwtSecret);
  } catch (error) {
    throw createHttpError(400, "인증이 만료되었습니다. 처음부터 다시 시도해 주세요.");
  }

  if (decoded?.type !== PASSWORD_RESET_TOKEN_TYPE || !decoded?.email || !decoded?.verificationId) {
    throw createHttpError(400, "유효하지 않은 인증 정보입니다.");
  }

  // resetToken은 JWT라 자체적으로 1회용이 아니므로, 소비된 인증 레코드가 아직 남아있는지로 재사용을 막는다.
  const verification = await prisma.emailVerification.findUnique({ where: { id: decoded.verificationId } });

  if (!verification || verification.email !== decoded.email || !verification.consumedAt) {
    throw createHttpError(400, "인증이 만료되었습니다. 처음부터 다시 시도해 주세요.");
  }

  const user = await prisma.user.findUnique({
    where: { email: decoded.email },
    select: { id: true, userId: true, isActive: true },
  });

  if (!user || !user.isActive) {
    throw createHttpError(400, "계정을 찾을 수 없습니다.");
  }

  const passwordHash = await bcrypt.hash(newPassword, 10);
  const now = new Date();

  await prisma.$transaction(async (tx) => {
    // resetToken 재사용을 막기 위해 소비 기록 자체를 지우는데, 이 삭제를 트랜잭션의 첫
    // 동작이자 유일한 "진짜" 관문으로 삼는다. 같은 resetToken으로 온 동시 요청 중 딱 하나만
    // 이 레코드를 지울 수 있고(count === 1), 나머지는 여기서 걸러져 비밀번호 변경까지
    // 가지 못한다. 위쪽의 findUnique는 빠른 실패용 사전 확인일 뿐, 실제 보장은 이 조건부
    // 삭제가 한다.
    const claimed = await tx.emailVerification.deleteMany({
      where: { id: verification.id, email: decoded.email },
    });

    if (claimed.count !== 1) {
      throw createHttpError(400, "인증이 만료되었습니다. 처음부터 다시 시도해 주세요.");
    }

    await tx.refreshToken.updateMany({
      where: { userId: user.id, revokedAt: null },
      data: { revokedAt: now },
    });

    await tx.user.update({
      where: { id: user.id },
      data: { passwordHash, sessionVersion: { increment: 1 } },
    });

    await tx.userAuditLog.create({
      data: {
        actorUserId: user.id,
        targetUserId: user.id,
        action: "USER_PASSWORD_RESET_VIA_EMAIL",
        afterData: { sessionInvalidated: true },
      },
    });
  });

  logger.info("password reset completed", { userId: user.userId, userDbId: user.id });

  return { ok: true };
}

module.exports = {
  login,
  refreshAccessToken,
  logout,
  hashRefreshToken,
  issueWebSocketTicket,
  verifyAndConsumeWebSocketTicket,
  requestPasswordResetCode,
  verifyPasswordResetCode,
  confirmPasswordReset,
};
