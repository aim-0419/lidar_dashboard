const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { test } = require("node:test");
const vm = require("node:vm");

class PrismaClientKnownRequestError extends Error {}

function clone(value) {
  return value ? { ...value, reviewedBy: value.reviewedBy || null } : null;
}

function matchesWhere(row, where = {}) {
  return Object.entries(where).every(([key, condition]) => {
    const value = row[key];

    if (condition && typeof condition === "object" && !(condition instanceof Date)) {
      if (Array.isArray(condition.in)) return condition.in.includes(value);
      if (Object.hasOwn(condition, "gt")) return value > condition.gt;
      if (Object.hasOwn(condition, "lte")) return value <= condition.lte;
    }

    return value === condition;
  });
}

function createFakePrisma({ requests = [], users = [], createSignupRequestError = null } = {}) {
  const state = {
    requests: requests.map((request) => ({ ...request })),
    users: users.map((user) => ({ ...user })),
    eventLogs: [],
  };
  let requestSequence = state.requests.length + 1;
  let userSequence = state.users.length + 1;

  function updateRows(rows, where, data) {
    const matchedRows = rows.filter((row) => matchesWhere(row, where));

    matchedRows.forEach((row) => {
      Object.assign(row, data, { updatedAt: new Date() });
    });

    return { count: matchedRows.length };
  }

  const prisma = {
    signupRequest: {
      findFirst: async ({ where }) => clone(state.requests.find((request) => matchesWhere(request, where))),
      findUnique: async ({ where }) => clone(state.requests.find((request) => request.id === where.id)),
      create: async ({ data }) => {
        if (createSignupRequestError) {
          throw createSignupRequestError;
        }

        const request = {
          id: `request-${requestSequence++}`,
          reviewedByUserId: null,
          reviewedAt: null,
          rejectReason: null,
          anonymizedAt: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          ...data,
        };
        state.requests.push(request);
        return clone(request);
      },
      updateMany: async ({ where, data }) => updateRows(state.requests, where, data),
      count: async ({ where }) => state.requests.filter((request) => matchesWhere(request, where)).length,
      findMany: async ({ where }) => state.requests.filter((request) => matchesWhere(request, where)).map(clone),
    },
    user: {
      findUnique: async ({ where }) => clone(state.users.find((user) => user.userId === where.userId)),
      findFirst: async ({ where }) => clone(state.users.find((user) => matchesWhere(user, where))),
      create: async ({ data }) => {
        const user = { id: `user-${userSequence++}`, ...data };
        state.users.push(user);
        return clone(user);
      },
    },
    eventLog: {
      create: async ({ data }) => {
        state.eventLogs.push(data);
        return data;
      },
    },
    $executeRaw: async () => 0,
    $transaction: async (callback) => callback(prisma),
  };

  return { prisma, state };
}

function loadSignupRequestsService(prisma) {
  const filename = path.resolve(__dirname, "../src/domains/signup-requests/signupRequests.service.js");
  const loaded = { exports: {} };

  vm.runInNewContext(fs.readFileSync(filename, "utf8"), {
    module: loaded,
    exports: loaded.exports,
    require(name) {
      if (name === "bcrypt") return { hash: async (password) => `hash:${password}` };
        if (name === "@prisma/client") return { Prisma: { PrismaClientKnownRequestError } };
      if (name === "../../prisma/client") return { prisma };
      if (name === "../../utils/credential-policy") {
        return {
          MIN_PASSWORD_LENGTH: 8,
          MAX_PASSWORD_BYTES: 72,
          MIN_USER_ID_LENGTH: 4,
          MAX_USER_ID_LENGTH: 30,
          getPasswordValidationError: (password) => (password.length >= 8 ? null : "TOO_SHORT"),
          isValidPassword: (password) => typeof password === "string" && password.length >= 8,
          isValidUserId: (userId) => /^[A-Za-z0-9]{4,30}$/.test(userId),
          normalizePhoneNumber: (phoneNumber) => String(phoneNumber).replace(/\D/g, ""),
          isValidPhoneNumber: (phoneNumber) => /^01[016789]\d{7,8}$/.test(phoneNumber),
        };
      }
      throw new Error(`Unexpected dependency: ${name}`);
    },
  }, { filename });

  return loaded.exports;
}

function createPendingRequest(overrides = {}) {
  return {
    id: "request-1",
    userId: "manager01",
    name: "홍길동",
    passwordHash: "hash:password123!",
    email: "manager01@example.com",
    phoneNumber: "01012345678",
    requestedRole: "MANAGER",
    status: "PENDING",
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    reviewedByUserId: null,
    reviewedAt: null,
    rejectReason: null,
    anonymizedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

test("가입 신청은 대기 상태로 저장되고 같은 대기 ID는 차단한다", async () => {
  const { prisma, state } = createFakePrisma();
  const service = loadSignupRequestsService(prisma);

  const request = await service.createSignupRequest({
    userId: "manager01",
    name: "홍길동",
    password: "password123!",
    email: "manager01@example.com",
    phoneNumber: "010-1234-5678",
  });

  assert.equal(request.status, "PENDING");
  assert.equal(state.requests[0].passwordHash, "hash:password123!");
  await assert.rejects(
    service.createSignupRequest({
      userId: "manager01",
      name: "다른 사용자",
      password: "password123!",
      email: "other@example.com",
      phoneNumber: "010-9876-5432",
    }),
    { statusCode: 409 },
  );
});

test("DB 부분 고유 인덱스 충돌은 가입 신청 중복 오류로 반환한다", async () => {
  const constraintError = new PrismaClientKnownRequestError("unique constraint failed");
  constraintError.code = "P2002";
  constraintError.meta = { target: ["signup_requests_pending_user_id_key"] };

  const { prisma } = createFakePrisma({ createSignupRequestError: constraintError });
  const service = loadSignupRequestsService(prisma);

  await assert.rejects(
    service.createSignupRequest({
      userId: "manager02",
      name: "김관리",
      password: "password123!",
      email: "manager02@example.com",
      phoneNumber: "010-2345-6789",
    }),
    { statusCode: 409, message: "이미 사용 중인 사용자 ID입니다." },
  );
});

test("승인 시 사용자 계정을 만들고 가입 신청 비밀번호 해시를 제거한다", async () => {
  const { prisma, state } = createFakePrisma({ requests: [createPendingRequest()] });
  const service = loadSignupRequestsService(prisma);

  const request = await service.approveSignupRequest({ id: "request-1", reviewerId: "admin-1" });

  assert.equal(request.status, "APPROVED");
  assert.equal(state.users.length, 1);
  assert.equal(state.users[0].userId, "manager01");
  assert.equal(state.users[0].passwordHash, "hash:password123!");
  assert.equal(state.users[0].email, "manager01@example.com");
  assert.equal(state.users[0].phoneNumber, "01012345678");
  assert.equal(state.users[0].role, "MANAGER");
  assert.equal(state.users[0].isActive, true);
  assert.equal(state.requests[0].passwordHash, null);
  assert.equal(state.eventLogs[0].action, "SIGNUP_REQUEST_APPROVED");
});

test("반려와 보관 기간 만료 시 비밀번호 해시 및 개인정보를 정리한다", async () => {
  const oldDate = new Date(Date.now() - 91 * 24 * 60 * 60 * 1000);
  const { prisma, state } = createFakePrisma({
    requests: [
      createPendingRequest({ id: "request-reject" }),
      createPendingRequest({
        id: "request-retention",
        status: "REJECTED",
        passwordHash: null,
        rejectReason: "중복 신청",
        updatedAt: oldDate,
        createdAt: oldDate,
      }),
    ],
  });
  const service = loadSignupRequestsService(prisma);

  const rejected = await service.rejectSignupRequest({
    id: "request-reject",
    reviewerId: "admin-1",
    rejectReason: "정보 확인 필요",
  });
  await service.runSignupRequestMaintenance();

  assert.equal(rejected.status, "REJECTED");
  assert.equal(state.requests[0].passwordHash, null);
  assert.equal(state.requests[1].userId, null);
  assert.equal(state.requests[1].email, null);
  assert.equal(state.requests[1].phoneNumber, null);
  assert.equal(state.requests[1].rejectReason, null);
  assert.ok(state.requests[1].anonymizedAt);
});
