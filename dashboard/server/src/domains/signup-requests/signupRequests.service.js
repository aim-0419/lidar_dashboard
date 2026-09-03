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
const SIGNUP_REQUEST_STATUS = {
  PENDING: "PENDING",
  APPROVED: "APPROVED",
  REJECTED: "REJECTED",
  CANCELLED: "CANCELLED",
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

function serializeSignupRequest(request) {
  return {
    id: request.id,
    userId: request.userId,
    name: request.name,
    email: request.email,
    phoneNumber: request.phoneNumber,
    requestedRole: request.requestedRole,
    status: request.status,
    reviewedByUserId: request.reviewedByUserId,
    reviewedAt: request.reviewedAt,
    rejectReason: request.rejectReason,
    cancelledAt: request.cancelledAt,
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
    reviewedByUserId: true,
    reviewedAt: true,
    rejectReason: true,
    cancelledAt: true,
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
    prisma.signupRequest.findUnique({
      where: { userId: trimmedUserId },
      select: { id: true },
    }),
  ]);

  if (existingUser || existingRequest) {
    throw createHttpError(409, "이미 사용 중이거나 신청 이력이 있는 사용자 ID입니다.");
  }

  return trimmedUserId;
}

async function checkUserIdAvailability(userId) {
  const trimmedUserId = String(userId || "").trim();

  if (!trimmedUserId) {
    throw createHttpError(400, "사용자 ID를 입력해주세요.");
  }

  const [existingUser, existingRequest] = await Promise.all([
    prisma.user.findUnique({
      where: { userId: trimmedUserId },
      select: { id: true },
    }),
    prisma.signupRequest.findUnique({
      where: { userId: trimmedUserId },
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
    prisma.signupRequest.findUnique({
      where: { email: normalizedEmail },
      select: { id: true },
    }),
  ]);

  if (existingUser || existingRequest) {
    throw createHttpError(409, "이미 사용 중이거나 신청 이력이 있는 이메일입니다.");
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
    prisma.signupRequest.findUnique({
      where: { phoneNumber: normalizedPhoneNumber },
      select: { id: true },
    }),
  ]);

  if (existingUser || existingRequest) {
    throw createHttpError(409, "이미 사용 중이거나 신청 이력이 있는 전화번호입니다.");
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
      },
      select: getSignupRequestSelect(),
    });

    return serializeSignupRequest(request);
  } catch (error) {
    handlePrismaError(error);
  }
}

async function listSignupRequests({ status, page, limit }) {
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
  const request = await findSignupRequestById(id);
  ensurePendingStatus(request);

  if (!request.passwordHash) {
    throw createHttpError(409, "Approval requires a pending password hash.");
  }

  try {
    const [, approvedRequest] = await prisma.$transaction([
      prisma.user.create({
        data: {
          userId: request.userId,
          name: request.name,
          passwordHash: request.passwordHash,
          email: request.email,
          phoneNumber: request.phoneNumber,
          role: request.requestedRole,
          isActive: true,
        },
      }),
      prisma.signupRequest.update({
        where: { id },
        data: {
          status: SIGNUP_REQUEST_STATUS.APPROVED,
          reviewedByUserId: reviewerId,
          reviewedAt: new Date(),
          rejectReason: null,
          passwordHash: null,
        },
        select: getSignupRequestSelect(),
      }),
      prisma.eventLog.create({
        data: {
          userId: reviewerId,
          action: "SIGNUP_REQUEST_APPROVED",
          message: "Signup request approved.",
          metadata: {
            signupRequestId: id,
            requestedUserId: request.userId,
          },
        },
      }),
    ]);

    return serializeSignupRequest(approvedRequest);
  } catch (error) {
    handlePrismaError(error);
  }
}

async function rejectSignupRequest({ id, reviewerId, rejectReason }) {
  const request = await findSignupRequestById(id);
  ensurePendingStatus(request);

  const normalizedRejectReason =
    typeof rejectReason === "string" && rejectReason.trim() !== "" ? rejectReason.trim() : null;

  const [rejectedRequest] = await prisma.$transaction([
    prisma.signupRequest.update({
      where: { id },
      data: {
        status: SIGNUP_REQUEST_STATUS.REJECTED,
        reviewedByUserId: reviewerId,
        reviewedAt: new Date(),
        rejectReason: normalizedRejectReason,
        passwordHash: null,
      },
      select: getSignupRequestSelect(),
    }),
    prisma.eventLog.create({
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
    }),
  ]);

  return serializeSignupRequest(rejectedRequest);
}

async function cancelSignupRequest({ id, userId, phoneNumber }) {
  if (isBlank(userId) || isBlank(phoneNumber)) {
    throw createHttpError(400, "userId와 phoneNumber를 모두 입력해야 합니다.");
  }

  const request = await findSignupRequestById(id);
  ensurePendingStatus(request);

  if (request.userId !== String(userId).trim()) {
    throw createHttpError(403, "본인 가입 신청만 취소할 수 있습니다.");
  }

  if (request.phoneNumber !== normalizePhoneNumber(phoneNumber)) {
    throw createHttpError(403, "본인 가입 신청만 취소할 수 있습니다.");
  }

  const cancelledRequest = await prisma.signupRequest.update({
    where: { id },
    data: {
      status: SIGNUP_REQUEST_STATUS.CANCELLED,
      cancelledAt: new Date(),
      passwordHash: null,
    },
    select: getSignupRequestSelect(),
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
};
