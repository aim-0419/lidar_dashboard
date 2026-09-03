const bcrypt = require("bcrypt");
const { Prisma } = require("@prisma/client");
const { prisma } = require("../../prisma/client");
const {
  MIN_PASSWORD_LENGTH,
  isValidPassword,
  normalizePhoneNumber,
  isValidPhoneNumber,
} = require("../../utils/credential-policy");

const REQUESTED_ROLE = "MANAGER";
const DEFAULT_LIST_LIMIT = 20;
const MAX_LIST_LIMIT = 100;
const SIGNUP_REQUEST_EXPIRATION_DAYS = 30;
const SIGNUP_REQUEST_RETENTION_DAYS = 90;
const SIGNUP_REQUEST_MAINTENANCE_INTERVAL_MS = 60 * 60 * 1000;
const SIGNUP_REQUEST_STATUS = {
  PENDING: "PENDING",
  APPROVED: "APPROVED",
  REJECTED: "REJECTED",
  CANCELLED: "CANCELLED",
  EXPIRED: "EXPIRED",
};

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

  const parsed = Number.parseInt(value, 10);

  if (!Number.isInteger(parsed) || parsed < 1) {
    throw createHttpError(400, `${fieldName} must be a positive integer.`);
  }

  return parsed;
}

function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

function validateEmail(email) {
  const normalizedEmail = normalizeEmail(email);

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
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
    cancelledAt: request.cancelledAt,
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
    cancelledAt: true,
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
  const trimmedUserId = String(userId || "").trim();

  if (!trimmedUserId) {
    throw createHttpError(400, "사용자 ID를 입력해주세요.");
  }

  const [existingUser, existingRequest] = await Promise.all([
    prisma.user.findUnique({
      where: { userId: trimmedUserId },
      select: { id: true },
    }),
    prisma.signupRequest.findFirst({
      where: {
        userId: trimmedUserId,
        status: SIGNUP_REQUEST_STATUS.PENDING,
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
  await runSignupRequestMaintenance();

  const trimmedUserId = String(userId || "").trim();

  if (!trimmedUserId) {
    throw createHttpError(400, "사용자 ID를 입력해주세요.");
  }

  const [existingUser, existingRequest] = await Promise.all([
    prisma.user.findUnique({
      where: { userId: trimmedUserId },
      select: { id: true },
    }),
    prisma.signupRequest.findFirst({
      where: {
        userId: trimmedUserId,
        status: SIGNUP_REQUEST_STATUS.PENDING,
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

  const [existingUser, existingRequest] = await Promise.all([
    prisma.user.findFirst({
      where: { email: normalizedEmail },
      select: { id: true },
    }),
    prisma.signupRequest.findFirst({
      where: {
        email: normalizedEmail,
        status: SIGNUP_REQUEST_STATUS.PENDING,
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

  const [existingUser, existingRequest] = await Promise.all([
    prisma.user.findFirst({
      where: { phoneNumber: normalizedPhoneNumber },
      select: { id: true },
    }),
    prisma.signupRequest.findFirst({
      where: {
        phoneNumber: normalizedPhoneNumber,
        status: SIGNUP_REQUEST_STATUS.PENDING,
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

// 만료된 대기 신청과 보관 기간이 지난 완료 신청의 민감 정보를 정리한다.
async function runSignupRequestMaintenance(now = new Date()) {
  const retentionCutoff = addDays(now, -SIGNUP_REQUEST_RETENTION_DAYS);

  const [expiredResult, anonymizedResult] = await prisma.$transaction([
    prisma.signupRequest.updateMany({
      where: {
        status: SIGNUP_REQUEST_STATUS.PENDING,
        expiresAt: { lte: now },
      },
      data: {
        status: SIGNUP_REQUEST_STATUS.EXPIRED,
        passwordHash: null,
      },
    }),
    prisma.signupRequest.updateMany({
      where: {
        status: {
          in: [
            SIGNUP_REQUEST_STATUS.REJECTED,
            SIGNUP_REQUEST_STATUS.CANCELLED,
            SIGNUP_REQUEST_STATUS.EXPIRED,
          ],
        },
        anonymizedAt: null,
        updatedAt: { lte: retentionCutoff },
      },
      data: {
        name: "개인정보 삭제됨",
        email: null,
        phoneNumber: null,
        rejectReason: null,
        anonymizedAt: now,
      },
    }),
  ]);

  return {
    expiredCount: expiredResult.count,
    anonymizedCount: anonymizedResult.count,
  };
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
  await runSignupRequestMaintenance();

  if (isBlank(userId) || isBlank(name) || isBlank(password) || isBlank(email) || isBlank(phoneNumber)) {
    throw createHttpError(400, "userId, name, password, email, phoneNumber를 모두 입력해야 합니다.");
  }

  if (!isValidPassword(password)) {
    throw createHttpError(400, `비밀번호는 ${MIN_PASSWORD_LENGTH}자 이상이어야 합니다.`);
  }

  const trimmedUserId = await ensureUserIdAvailable(userId);
  const trimmedName = String(name).trim();
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
    where.status = normalizedStatus;
  }

  const [count, requests] = await prisma.$transaction([
    prisma.signupRequest.count({ where }),
    prisma.signupRequest.findMany({
      where,
      orderBy: {
        createdAt: "desc",
      },
      skip: (normalizedPage - 1) * normalizedLimit,
      take: normalizedLimit,
      select: getSignupRequestSelect(),
    }),
  ]);

  return {
    count,
    page: normalizedPage,
    limit: normalizedLimit,
    totalPages: Math.max(1, Math.ceil(count / normalizedLimit)),
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

      if (!request.passwordHash) {
        throw createHttpError(409, "승인할 가입 신청 비밀번호 정보가 없습니다.");
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
          role: request.requestedRole,
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
            requestedUserId: request.userId,
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
          requestedUserId: request.userId,
          rejectReason: normalizedRejectReason,
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

async function cancelSignupRequest({ id, userId, password }) {
  await runSignupRequestMaintenance();

  if (isBlank(userId) || isBlank(password)) {
    throw createHttpError(400, "userId와 password를 모두 입력해야 합니다.");
  }

  const cancelledRequest = await prisma.$transaction(async (tx) => {
    const request = await tx.signupRequest.findUnique({
      where: { id },
      select: getSignupRequestInternalSelect(),
    });

    if (!request) {
      throw createHttpError(404, "가입 신청 정보를 찾을 수 없습니다.");
    }

    ensurePendingStatus(request);

    if (request.userId !== String(userId).trim() || !request.passwordHash) {
      throw createHttpError(401, "가입 신청 정보를 확인할 수 없습니다.");
    }

    const isPasswordMatched = await bcrypt.compare(password, request.passwordHash);
    if (!isPasswordMatched) {
      throw createHttpError(401, "가입 신청 정보를 확인할 수 없습니다.");
    }

    const claimResult = await tx.signupRequest.updateMany({
      where: {
        id,
        status: SIGNUP_REQUEST_STATUS.PENDING,
        expiresAt: { gt: new Date() },
      },
      data: {
        status: SIGNUP_REQUEST_STATUS.CANCELLED,
        cancelledAt: new Date(),
        passwordHash: null,
      },
    });

    if (claimResult.count !== 1) {
      throw createHttpError(409, "이미 처리된 가입 신청입니다.");
    }

    await tx.eventLog.create({
      data: {
        action: "SIGNUP_REQUEST_CANCELLED",
        message: "Signup request cancelled.",
        metadata: {
          signupRequestId: id,
          requestedUserId: request.userId,
        },
      },
    });

    return tx.signupRequest.findUnique({
      where: { id },
      select: getSignupRequestSelect(),
    });
  });

  return serializeSignupRequest(cancelledRequest);
}

module.exports = {
  createSignupRequest,
  checkUserIdAvailability,
  listSignupRequests,
  approveSignupRequest,
  rejectSignupRequest,
  cancelSignupRequest,
  runSignupRequestMaintenance,
  SIGNUP_REQUEST_MAINTENANCE_INTERVAL_MS,
};
