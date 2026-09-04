const bcrypt = require("bcrypt");
const { Prisma } = require("@prisma/client");
const { prisma } = require("../../prisma/client");
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

    return {
      expiredCount: expiredResult.count,
      anonymizedCount: anonymizedResult.count,
      anonymizedAuditLogCount: Number(anonymizedAuditLogCount),
    };
  });
}

function handlePrismaError(error) {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
    const target = Array.isArray(error.meta?.target) ? error.meta.target.join(",") : String(error.meta?.target || "");

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

  try {
    const request = await prisma.signupRequest.create({
      data: {
        userId: trimmedUserId,
        name: trimmedName,
        passwordHash,
        email: normalizedEmail,
        phoneNumber: normalizedPhoneNumber,
        requestedRole: REQUESTED_ROLE,
        status: SIGNUP_REQUEST_STATUS.PENDING,
        expiresAt: addDays(new Date(), SIGNUP_REQUEST_EXPIRATION_DAYS),
      },
      select: getSignupRequestSelect(),
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

    return serializeSignupRequest(approvedRequest);
  } catch (error) {
    handlePrismaError(error);
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
  listSignupRequests,
  approveSignupRequest,
  rejectSignupRequest,
  runSignupRequestMaintenance,
  SIGNUP_REQUEST_MAINTENANCE_INTERVAL_MS,
};
