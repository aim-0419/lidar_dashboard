const crypto = require("crypto");
const bcrypt = require("bcrypt");
const { Prisma } = require("@prisma/client");
const { prisma } = require("../../prisma/client");
const { config } = require("../../config");
const { logger } = require("../../utils/logger");
const { getUniqueConstraintTarget } = require("../../utils/prisma-error");
const { sendEmail } = require("../../utils/mailer");
const { renderLayout, escapeHtml } = require("../../emails/renderLayout");
const {
  MIN_PASSWORD_LENGTH,
  MAX_PASSWORD_BYTES,
  MIN_USER_ID_LENGTH,
  MAX_USER_ID_LENGTH,
  getPasswordValidationError,
  isValidPassword,
  isValidUserId,
  normalizePhoneNumber,
  isValidPhoneNumber,
} = require("../../utils/credential-policy");

const REQUESTED_ROLE = "MANAGER";
const DEFAULT_LIST_LIMIT = 20;
const MAX_LIST_LIMIT = 100;
const SIGNUP_REQUEST_EXPIRATION_DAYS = 30;
const SIGNUP_REQUEST_RETENTION_DAYS = 90;
const SIGNUP_REQUEST_MAINTENANCE_INTERVAL_MS = 60 * 60 * 1000;
const MAX_NAME_LENGTH = 50;
const MAX_EMAIL_LENGTH = 254;
const MAX_REJECT_REASON_LENGTH = 500;
const SIGNUP_REQUEST_STATUS = {
  PENDING: "PENDING",
  APPROVED: "APPROVED",
  REJECTED: "REJECTED",
  EXPIRED: "EXPIRED",
};
const SIGNUP_REQUEST_STATUS_VALUES = new Set(Object.values(SIGNUP_REQUEST_STATUS));

const EMAIL_VERIFICATION_PURPOSE_SIGNUP = "SIGNUP";
const EMAIL_CODE_LENGTH = 6;
const EMAIL_CODE_TTL_MINUTES = 10;
const EMAIL_CODE_MAX_ATTEMPTS = 5;
const EMAIL_CODE_RESEND_COOLDOWN_SECONDS = 60;
// 이메일 인증 완료 후 이 시간 안에 가입 신청까지 마쳐야 인증이 유효하다.
const EMAIL_VERIFIED_WINDOW_MINUTES = 30;

function createHttpError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function isBlank(value) {
  return typeof value !== "string" || value.trim() === "";
}

function parsePositiveInteger(value, fallback, fieldName) {
  if (value === undefined || value === null || value === "") {
    return fallback;
  }

  const normalizedValue = String(value).trim();

  if (!/^[1-9]\d*$/.test(normalizedValue)) {
    throw createHttpError(400, `${fieldName} must be a positive integer.`);
  }

  return Number(normalizedValue);
}

function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

function validateEmail(email) {
  const normalizedEmail = normalizeEmail(email);

  if (normalizedEmail.length > MAX_EMAIL_LENGTH || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
    throw createHttpError(400, "올바른 이메일 형식이 필요합니다.");
  }

  return normalizedEmail;
}

function validatePhoneNumber(phoneNumber) {
  const normalizedPhoneNumber = normalizePhoneNumber(phoneNumber);

  if (!isValidPhoneNumber(normalizedPhoneNumber)) {
    throw createHttpError(400, "올바른 전화번호 형식이 필요합니다.");
  }

  return normalizedPhoneNumber;
}

function validateUserId(userId) {
  const normalizedUserId = String(userId || "").trim();

  if (!isValidUserId(normalizedUserId)) {
    throw createHttpError(400, `사용자 ID는 영문과 숫자만 사용해 ${MIN_USER_ID_LENGTH}~${MAX_USER_ID_LENGTH}자로 입력해야 합니다.`);
  }

  return normalizedUserId;
}

function validateName(name) {
  const normalizedName = String(name || "").trim();

  if (!normalizedName || normalizedName.length > MAX_NAME_LENGTH) {
    throw createHttpError(400, `이름은 1~${MAX_NAME_LENGTH}자로 입력해야 합니다.`);
  }

  return normalizedName;
}

function getPasswordValidationMessage(validationError) {
  if (validationError === "TOO_LONG") {
    return `비밀번호는 UTF-8 기준 ${MAX_PASSWORD_BYTES}바이트 이하여야 합니다.`;
  }

  return `비밀번호는 ${MIN_PASSWORD_LENGTH}자 이상이어야 합니다.`;
}

function addDays(date, days) {
  const nextDate = new Date(date);
  nextDate.setDate(nextDate.getDate() + days);
  return nextDate;
}

function serializeSignupRequest(request) {
  return {
    id: request.id,
    userId: request.userId,
    name: request.name,
    email: request.email,
    phoneNumber: request.phoneNumber,
    requestedRole: request.requestedRole,
    status: request.status,
    expiresAt: request.expiresAt,
    reviewedByUserId: request.reviewedByUserId,
    reviewedAt: request.reviewedAt,
    rejectReason: request.rejectReason,
    anonymizedAt: request.anonymizedAt,
    createdAt: request.createdAt,
    updatedAt: request.updatedAt,
    reviewedBy: request.reviewedBy
      ? {
          id: request.reviewedBy.id,
          userId: request.reviewedBy.userId,
          name: request.reviewedBy.name,
          role: String(request.reviewedBy.role || "").toLowerCase(),
        }
      : null,
  };
}

function getSignupRequestSelect() {
  return {
    id: true,
    userId: true,
    name: true,
    email: true,
    phoneNumber: true,
    requestedRole: true,
    status: true,
    expiresAt: true,
    reviewedByUserId: true,
    reviewedAt: true,
    rejectReason: true,
    anonymizedAt: true,
    createdAt: true,
    updatedAt: true,
    reviewedBy: {
      select: {
        id: true,
        userId: true,
        name: true,
        role: true,
      },
    },
  };
}

function getSignupRequestInternalSelect() {
  return {
    ...getSignupRequestSelect(),
    passwordHash: true,
  };
}

async function ensureUserIdAvailable(userId) {
  const trimmedUserId = validateUserId(userId);
  const now = new Date();

  const [existingUser, existingRequest] = await Promise.all([
    prisma.user.findUnique({
      where: { userId: trimmedUserId },
      select: { id: true },
    }),
    prisma.signupRequest.findFirst({
      where: {
        userId: trimmedUserId,
        status: SIGNUP_REQUEST_STATUS.PENDING,
        expiresAt: { gt: now },
      },
      select: { id: true },
    }),
  ]);

  if (existingUser || existingRequest) {
    throw createHttpError(409, "이미 사용 중이거나 대기 중인 가입 신청이 있는 사용자 ID입니다.");
  }

  return trimmedUserId;
}

async function checkUserIdAvailability(userId) {
  const trimmedUserId = validateUserId(userId);
  const now = new Date();

  const [existingUser, existingRequest] = await Promise.all([
    prisma.user.findUnique({
      where: { userId: trimmedUserId },
      select: { id: true },
    }),
    prisma.signupRequest.findFirst({
      where: {
        userId: trimmedUserId,
        status: SIGNUP_REQUEST_STATUS.PENDING,
        expiresAt: { gt: now },
      },
      select: { id: true },
    }),
  ]);

  return {
    userId: trimmedUserId,
    available: !existingUser && !existingRequest,
  };
}

async function ensureEmailAvailable(email) {
  const normalizedEmail = normalizeEmail(email);
  const now = new Date();

  const [existingUser, existingRequest] = await Promise.all([
    prisma.user.findFirst({
      where: { email: normalizedEmail },
      select: { id: true },
    }),
    prisma.signupRequest.findFirst({
      where: {
        email: normalizedEmail,
        status: SIGNUP_REQUEST_STATUS.PENDING,
        expiresAt: { gt: now },
      },
      select: { id: true },
    }),
  ]);

  if (existingUser || existingRequest) {
    throw createHttpError(409, "이미 사용 중이거나 대기 중인 가입 신청이 있는 이메일입니다.");
  }

  return normalizedEmail;
}

async function ensurePhoneNumberAvailable(phoneNumber) {
  const normalizedPhoneNumber = normalizePhoneNumber(phoneNumber);
  const now = new Date();

  const [existingUser, existingRequest] = await Promise.all([
    prisma.user.findFirst({
      where: { phoneNumber: normalizedPhoneNumber },
      select: { id: true },
    }),
    prisma.signupRequest.findFirst({
      where: {
        phoneNumber: normalizedPhoneNumber,
        status: SIGNUP_REQUEST_STATUS.PENDING,
        expiresAt: { gt: now },
      },
      select: { id: true },
    }),
  ]);

  if (existingUser || existingRequest) {
    throw createHttpError(409, "이미 사용 중이거나 대기 중인 가입 신청이 있는 전화번호입니다.");
  }

  return normalizedPhoneNumber;
}

function generateSignupEmailCode() {
  const value = crypto.randomInt(0, 10 ** EMAIL_CODE_LENGTH);
  return String(value).padStart(EMAIL_CODE_LENGTH, "0");
}

// 가입 신청 폼에 입력한 이메일로 6자리 인증코드를 발송한다.
async function sendSignupEmailCode({ email }) {
  const normalizedEmail = validateEmail(email);
  const now = new Date();

  // 이미 사용 중이거나 대기 중인 이메일이면 코드를 보낼 필요가 없다.
  await ensureEmailAvailable(normalizedEmail);

  const latest = await prisma.emailVerification.findFirst({
    where: { email: normalizedEmail, purpose: EMAIL_VERIFICATION_PURPOSE_SIGNUP },
    orderBy: { createdAt: "desc" },
  });

  if (latest && now.getTime() - latest.createdAt.getTime() < EMAIL_CODE_RESEND_COOLDOWN_SECONDS * 1000) {
    throw createHttpError(429, "인증코드는 60초마다 재요청할 수 있습니다. 잠시 후 다시 시도해 주세요.");
  }

  const code = generateSignupEmailCode();
  const codeHash = await bcrypt.hash(code, 10);
  const expiresAt = new Date(now.getTime() + EMAIL_CODE_TTL_MINUTES * 60 * 1000);

  const html = renderLayout({
    heading: "이메일 인증코드",
    contentHtml:
      `<p>가입 신청을 위한 인증코드입니다.</p>` +
      `<p style="font-size:28px;font-weight:800;letter-spacing:6px;">${code}</p>` +
      `<p>이 코드는 ${EMAIL_CODE_TTL_MINUTES}분간 유효합니다.</p>`,
    footerNote: "본인이 요청하지 않았다면 이 메일을 무시하셔도 됩니다.",
  });

  const result = await sendEmail({
    to: normalizedEmail,
    subject: "[라이다 관제] 이메일 인증코드",
    html,
    text: `인증코드: ${code} (${EMAIL_CODE_TTL_MINUTES}분간 유효)`,
  });

  // 실제 발송에 실패하면(개발 환경 skip 모드는 예외) 코드 레코드를 남기지 않는다.
  // "메일은 못 갔는데 DB엔 보낸 것처럼 남는" 상태를 피하기 위함이다.
  if (!result.delivered && !result.skipped) {
    throw createHttpError(502, "인증코드 메일 발송에 실패했습니다. 잠시 후 다시 시도해 주세요.");
  }

  await prisma.emailVerification.create({
    data: {
      email: normalizedEmail,
      purpose: EMAIL_VERIFICATION_PURPOSE_SIGNUP,
      codeHash,
      expiresAt,
    },
  });

  return { ok: true, cooldownSeconds: EMAIL_CODE_RESEND_COOLDOWN_SECONDS };
}

// 사용자가 입력한 인증코드가 방금 발송된 코드와 일치하는지 확인한다.
async function verifySignupEmailCode({ email, code }) {
  const normalizedEmail = validateEmail(email);
  const normalizedCode = String(code || "").trim();

  if (!/^\d{6}$/.test(normalizedCode)) {
    throw createHttpError(400, "인증코드는 숫자 6자리로 입력해야 합니다.");
  }

  const now = new Date();
  // 이메일당 가장 최근에 발송된 코드만 유효하다 — 재발송하면 이전 코드는 자동으로 무효화된다.
  const verification = await prisma.emailVerification.findFirst({
    where: { email: normalizedEmail, purpose: EMAIL_VERIFICATION_PURPOSE_SIGNUP },
    orderBy: { createdAt: "desc" },
  });

  if (!verification) {
    throw createHttpError(400, "인증코드를 먼저 요청해 주세요.");
  }

  if (verification.consumedAt) {
    throw createHttpError(400, "이미 사용된 인증코드입니다. 다시 요청해 주세요.");
  }

  if (verification.expiresAt <= now) {
    throw createHttpError(400, "인증코드가 만료되었습니다. 다시 요청해 주세요.");
  }

  if (verification.attempts >= EMAIL_CODE_MAX_ATTEMPTS) {
    throw createHttpError(429, "시도 횟수를 초과했습니다. 인증코드를 다시 요청해 주세요.");
  }

  const isMatch = await bcrypt.compare(normalizedCode, verification.codeHash);

  if (!isMatch) {
    await prisma.emailVerification.update({
      where: { id: verification.id },
      data: { attempts: { increment: 1 } },
    });
    throw createHttpError(400, "인증코드가 올바르지 않습니다.");
  }

  await prisma.emailVerification.update({
    where: { id: verification.id },
    data: { consumedAt: now },
  });

  return { ok: true };
}

async function findSignupRequestById(id) {
  const request = await prisma.signupRequest.findUnique({
    where: { id },
    select: getSignupRequestInternalSelect(),
  });

  if (!request) {
    throw createHttpError(404, "가입 신청 정보를 찾을 수 없습니다.");
  }

  return request;
}

function ensurePendingStatus(request) {
  if (request.status !== SIGNUP_REQUEST_STATUS.PENDING) {
    throw createHttpError(409, "대기 중인 가입 신청만 처리할 수 있습니다.");
  }
}

function expirePendingSignupRequests(client, now = new Date()) {
  return client.signupRequest.updateMany({
    where: {
      status: SIGNUP_REQUEST_STATUS.PENDING,
      expiresAt: { lte: now },
    },
    data: {
      status: SIGNUP_REQUEST_STATUS.EXPIRED,
      passwordHash: null,
    },
  });
}

// 인증에 쓰이지 않고 방치된 이메일 인증 레코드를 정리한다. createSignupRequest가 정상적으로
// 소비(삭제)하지 않은 레코드만 대상이라, 정상 흐름에는 영향이 없다.
// - 미사용(consumedAt 없음) 코드: 코드 만료 시각(expiresAt)이 지나면 삭제
// - 인증은 했지만(consumedAt 있음) 가입 신청까지 이어지지 않은 레코드: 인증 유효 창
//   (EMAIL_VERIFIED_WINDOW_MINUTES)이 지나면 삭제 — 그 전까지는 createSignupRequest가 아직 쓸 수 있으므로 보존
function cleanupExpiredEmailVerifications(client, now = new Date()) {
  const verifiedWindowCutoff = new Date(now.getTime() - EMAIL_VERIFIED_WINDOW_MINUTES * 60 * 1000);

  return client.emailVerification.deleteMany({
    where: {
      OR: [
        { consumedAt: null, expiresAt: { lte: now } },
        { consumedAt: { not: null, lte: verifiedWindowCutoff } },
      ],
    },
  });
}

// 만료된 대기 신청과 보관 기간이 지난 완료 신청의 개인정보를 정리한다.
async function runSignupRequestMaintenance(now = new Date()) {
  const retentionCutoff = addDays(now, -SIGNUP_REQUEST_RETENTION_DAYS);

  return prisma.$transaction(async (tx) => {
    const expiredResult = await expirePendingSignupRequests(tx, now);
    const anonymizedResult = await tx.signupRequest.updateMany({
      where: {
        status: {
          in: [
            SIGNUP_REQUEST_STATUS.APPROVED,
            SIGNUP_REQUEST_STATUS.REJECTED,
            SIGNUP_REQUEST_STATUS.EXPIRED,
          ],
        },
        anonymizedAt: null,
        updatedAt: { lte: retentionCutoff },
      },
      data: {
        userId: null,
        name: null,
        email: null,
        phoneNumber: null,
        rejectReason: null,
        anonymizedAt: now,
      },
    });

    const anonymizedAuditLogCount = await tx.$executeRaw`
      UPDATE "event_logs"
      SET "metadata" = jsonb_build_object(
        'signupRequestId', "metadata" ->> 'signupRequestId'
      )
      WHERE "action" IN (
        'SIGNUP_REQUEST_APPROVED',
        'SIGNUP_REQUEST_REJECTED'
      )
        AND "created_at" <= ${retentionCutoff}
        AND "metadata" IS NOT NULL
        AND (
          "metadata" ? 'requestedUserId'
          OR "metadata" ? 'rejectReason'
        )
    `;

    const expiredEmailVerificationResult = await cleanupExpiredEmailVerifications(tx, now);

    return {
      expiredCount: expiredResult.count,
      anonymizedCount: anonymizedResult.count,
      anonymizedAuditLogCount: Number(anonymizedAuditLogCount),
      expiredEmailVerificationCount: expiredEmailVerificationResult.count,
    };
  });
}

function handlePrismaError(error) {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
    const target = getUniqueConstraintTarget(error);

    if (target.includes("user_id")) {
      throw createHttpError(409, "이미 사용 중인 사용자 ID입니다.");
    }

    if (target.includes("email")) {
      throw createHttpError(409, "이미 사용 중인 이메일입니다.");
    }

    if (target.includes("phone_number")) {
      throw createHttpError(409, "이미 사용 중인 전화번호입니다.");
    }

    throw createHttpError(409, "중복된 값이 이미 존재합니다.");
  }

  throw error;
}

async function createSignupRequest({ userId, name, password, email, phoneNumber }) {
  await expirePendingSignupRequests(prisma);

  if (isBlank(userId) || isBlank(name) || isBlank(password) || isBlank(email) || isBlank(phoneNumber)) {
    throw createHttpError(400, "userId, name, password, email, phoneNumber를 모두 입력해야 합니다.");
  }

  const passwordValidationError = getPasswordValidationError(password);
  if (!isValidPassword(password)) {
    throw createHttpError(400, getPasswordValidationMessage(passwordValidationError));
  }

  const trimmedUserId = await ensureUserIdAvailable(userId);
  const trimmedName = validateName(name);
  const normalizedEmail = await ensureEmailAvailable(validateEmail(email));
  const normalizedPhoneNumber = await ensurePhoneNumberAvailable(validatePhoneNumber(phoneNumber));
  const passwordHash = await bcrypt.hash(password, 10);
  const now = new Date();

  try {
    const request = await prisma.$transaction(async (tx) => {
      // 이메일 인증(send-code/verify-code)이 최근에 완료됐는지 신청 저장과 같은 트랜잭션에서 확인한다.
      // 확인과 소비 사이에 다른 요청이 끼어들 수 없도록, 확인한 인증 레코드는 이 트랜잭션 안에서 바로 삭제(1회용 소비)한다.
      const verification = await tx.emailVerification.findFirst({
        where: {
          email: normalizedEmail,
          purpose: EMAIL_VERIFICATION_PURPOSE_SIGNUP,
          consumedAt: { not: null },
        },
        orderBy: { createdAt: "desc" },
      });

      const verifiedRecently =
        verification &&
        now.getTime() - verification.consumedAt.getTime() < EMAIL_VERIFIED_WINDOW_MINUTES * 60 * 1000;

      if (!verifiedRecently) {
        throw createHttpError(400, "이메일 인증을 먼저 완료해 주세요.");
      }

      const created = await tx.signupRequest.create({
        data: {
          userId: trimmedUserId,
          name: trimmedName,
          passwordHash,
          email: normalizedEmail,
          phoneNumber: normalizedPhoneNumber,
          requestedRole: REQUESTED_ROLE,
          status: SIGNUP_REQUEST_STATUS.PENDING,
          expiresAt: addDays(now, SIGNUP_REQUEST_EXPIRATION_DAYS),
        },
        select: getSignupRequestSelect(),
      });

      await tx.emailVerification.delete({ where: { id: verification.id } });

      return created;
    });

    return serializeSignupRequest(request);
  } catch (error) {
    handlePrismaError(error);
  }
}

async function listSignupRequests({ status, page, limit }) {
  await runSignupRequestMaintenance();

  const normalizedStatus = String(status || "").trim().toUpperCase();
  const where = {};
  const normalizedPage = parsePositiveInteger(page, 1, "page");
  const requestedLimit = parsePositiveInteger(limit, DEFAULT_LIST_LIMIT, "limit");
  const normalizedLimit = Math.min(requestedLimit, MAX_LIST_LIMIT);

  if (normalizedStatus) {
    if (!SIGNUP_REQUEST_STATUS_VALUES.has(normalizedStatus)) {
      throw createHttpError(400, "유효하지 않은 가입 신청 상태입니다.");
    }

    where.status = normalizedStatus;
  }

  const { count, page: effectivePage, requests, totalPages } = await prisma.$transaction(async (tx) => {
    const count = await tx.signupRequest.count({ where });
    const totalPages = Math.max(1, Math.ceil(count / normalizedLimit));
    const page = Math.min(normalizedPage, totalPages);
    const requests = await tx.signupRequest.findMany({
      where,
      orderBy: {
        createdAt: "desc",
      },
      skip: (page - 1) * normalizedLimit,
      take: normalizedLimit,
      select: getSignupRequestSelect(),
    });

    return { count, page, requests, totalPages };
  });

  return {
    count,
    page: effectivePage,
    limit: normalizedLimit,
    totalPages,
    requests: requests.map(serializeSignupRequest),
  };
}

async function approveSignupRequest({ id, reviewerId }) {
  await runSignupRequestMaintenance();

  try {
    const approvedRequest = await prisma.$transaction(async (tx) => {
      const request = await tx.signupRequest.findUnique({
        where: { id },
        select: getSignupRequestInternalSelect(),
      });

      if (!request) {
        throw createHttpError(404, "가입 신청 정보를 찾을 수 없습니다.");
      }

      ensurePendingStatus(request);

      if (!request.userId || !request.name || !request.passwordHash || !request.email || !request.phoneNumber) {
        throw createHttpError(409, "승인할 가입 신청 정보가 없습니다.");
      }

      const reviewedAt = new Date();
      const claimResult = await tx.signupRequest.updateMany({
        where: {
          id,
          status: SIGNUP_REQUEST_STATUS.PENDING,
          expiresAt: { gt: reviewedAt },
        },
        data: {
          status: SIGNUP_REQUEST_STATUS.APPROVED,
          reviewedByUserId: reviewerId,
          reviewedAt,
          rejectReason: null,
          passwordHash: null,
        },
      });

      if (claimResult.count !== 1) {
        throw createHttpError(409, "이미 처리된 가입 신청입니다.");
      }

      await tx.user.create({
        data: {
          userId: request.userId,
          name: request.name,
          passwordHash: request.passwordHash,
          email: request.email,
          phoneNumber: request.phoneNumber,
          // 가입 신청으로 생성되는 계정은 항상 일반 관리자 권한으로 제한한다.
          role: REQUESTED_ROLE,
          isActive: true,
        },
      });

      await tx.eventLog.create({
        data: {
          userId: reviewerId,
          action: "SIGNUP_REQUEST_APPROVED",
          message: "Signup request approved.",
          metadata: {
            signupRequestId: id,
          },
        },
      });

      return tx.signupRequest.findUnique({
        where: { id },
        select: getSignupRequestSelect(),
      });
    });

    await sendApprovalNotificationEmail(approvedRequest);

    return serializeSignupRequest(approvedRequest);
  } catch (error) {
    handlePrismaError(error);
  }
}

// 승인 완료 안내 메일. 발송 실패해도 승인 자체는 이미 끝난 뒤라 로그만 남기고 넘어간다.
async function sendApprovalNotificationEmail(approvedRequest) {
  if (!approvedRequest?.email) {
    return;
  }

  const loginUrl = `${config.mail.appBaseUrl}/login`;
  const html = renderLayout({
    heading: "가입 승인 안내",
    contentHtml:
      `<p>안녕하세요, ${escapeHtml(approvedRequest.name)}님.</p>` +
      `<p>가입 신청하신 계정(<strong>${escapeHtml(approvedRequest.userId)}</strong>)이 승인되어 이제 로그인할 수 있습니다.</p>` +
      `<p><a href="${loginUrl}" style="color:#2563eb;">${loginUrl}</a></p>`,
    footerNote: "본인이 신청하지 않았다면 관리자에게 문의해 주세요.",
  });

  const result = await sendEmail({
    to: approvedRequest.email,
    subject: "[라이다 관제] 가입 승인 안내",
    html,
    text: `${approvedRequest.userId}님의 가입 신청이 승인되었습니다. 로그인: ${loginUrl}`,
  });

  if (!result.delivered && !result.skipped) {
    logger.warn("signup approval notification email failed", {
      signupRequestId: approvedRequest.id,
      email: approvedRequest.email,
      error: result.error,
    });
  }
}

async function rejectSignupRequest({ id, reviewerId, rejectReason }) {
  await runSignupRequestMaintenance();

  const normalizedRejectReason =
    typeof rejectReason === "string" && rejectReason.trim() !== "" ? rejectReason.trim() : null;

  if (normalizedRejectReason && normalizedRejectReason.length > MAX_REJECT_REASON_LENGTH) {
    throw createHttpError(400, `반려 사유는 ${MAX_REJECT_REASON_LENGTH}자 이하여야 합니다.`);
  }

  const rejectedRequest = await prisma.$transaction(async (tx) => {
    const request = await tx.signupRequest.findUnique({
      where: { id },
      select: getSignupRequestInternalSelect(),
    });

    if (!request) {
      throw createHttpError(404, "가입 신청 정보를 찾을 수 없습니다.");
    }

    ensurePendingStatus(request);

    const claimResult = await tx.signupRequest.updateMany({
      where: {
        id,
        status: SIGNUP_REQUEST_STATUS.PENDING,
        expiresAt: { gt: new Date() },
      },
      data: {
        status: SIGNUP_REQUEST_STATUS.REJECTED,
        reviewedByUserId: reviewerId,
        reviewedAt: new Date(),
        rejectReason: normalizedRejectReason,
        passwordHash: null,
      },
    });

    if (claimResult.count !== 1) {
      throw createHttpError(409, "이미 처리된 가입 신청입니다.");
    }

    await tx.eventLog.create({
      data: {
        userId: reviewerId,
        action: "SIGNUP_REQUEST_REJECTED",
        message: "Signup request rejected.",
        metadata: {
          signupRequestId: id,
        },
      },
    });

    return tx.signupRequest.findUnique({
      where: { id },
      select: getSignupRequestSelect(),
    });
  });

  return serializeSignupRequest(rejectedRequest);
}

module.exports = {
  createSignupRequest,
  checkUserIdAvailability,
  sendSignupEmailCode,
  verifySignupEmailCode,
  listSignupRequests,
  approveSignupRequest,
  rejectSignupRequest,
  runSignupRequestMaintenance,
  SIGNUP_REQUEST_MAINTENANCE_INTERVAL_MS,
};
