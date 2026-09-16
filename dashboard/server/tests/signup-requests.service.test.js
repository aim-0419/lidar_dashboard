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
  if (Array.isArray(where.OR)) {
    return where.OR.some((condition) => matchesWhere(row, condition));
  }

  return Object.entries(where).every(([key, condition]) => {
    const value = row[key];

    if (condition && typeof condition === "object" && !(condition instanceof Date)) {
      if (Array.isArray(condition.in)) return condition.in.includes(value);

      // gt/lte/not은 같은 필드에 함께 올 수 있어(예: {not:null, lte:cutoff}) AND로 합친다.
      let matches = true;
      if (Object.hasOwn(condition, "gt")) matches = matches && value > condition.gt;
      if (Object.hasOwn(condition, "lte")) matches = matches && value <= condition.lte;
      if (Object.hasOwn(condition, "not")) {
        matches = matches && (condition.not === null ? value !== null && value !== undefined : value !== condition.not);
      }
      return matches;
    }

    return value === condition;
  });
}

// update()의 { increment: n } 같은 Prisma 연산자를 흉내낸다.
function applyUpdateData(row, data) {
  for (const [key, value] of Object.entries(data)) {
    if (value && typeof value === "object" && !(value instanceof Date) && Object.hasOwn(value, "increment")) {
      row[key] = (row[key] || 0) + value.increment;
      continue;
    }

    row[key] = value;
  }
}

function createFakePrisma({
  requests = [],
  users = [],
  emailVerifications = [],
  createSignupRequestError = null,
} = {}) {
  const state = {
    requests: requests.map((request) => ({ ...request })),
    users: users.map((user) => ({ ...user })),
    emailVerifications: emailVerifications.map((row) => ({ ...row })),
    eventLogs: [],
  };
  let requestSequence = state.requests.length + 1;
  let userSequence = state.users.length + 1;
  let emailVerificationSequence = state.emailVerifications.length + 1;

  function updateRows(rows, where, data) {
    const matchedRows = rows.filter((row) => matchesWhere(row, where));

    matchedRows.forEach((row) => {
      Object.assign(row, data, { updatedAt: new Date() });
    });

    return { count: matchedRows.length };
  }

  function sortByCreatedAtDesc(rows) {
    return [...rows].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
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
    emailVerification: {
      findFirst: async ({ where, orderBy }) => {
        let rows = state.emailVerifications.filter((row) => matchesWhere(row, where));

        if (orderBy?.createdAt === "desc") {
          rows = sortByCreatedAtDesc(rows);
        }

        return rows[0] ? clone(rows[0]) : null;
      },
      create: async ({ data }) => {
        const row = {
          id: `email-verification-${emailVerificationSequence++}`,
          attempts: 0,
          consumedAt: null,
          createdAt: new Date(),
          ...data,
        };
        state.emailVerifications.push(row);
        return clone(row);
      },
      update: async ({ where, data }) => {
        const row = state.emailVerifications.find((candidate) => candidate.id === where.id);

        if (!row) {
          throw new Error(`emailVerification not found: ${where.id}`);
        }

        applyUpdateData(row, data);
        return clone(row);
      },
      delete: async ({ where }) => {
        const index = state.emailVerifications.findIndex((candidate) => candidate.id === where.id);

        if (index === -1) {
          throw new Error(`emailVerification not found: ${where.id}`);
        }

        const [removed] = state.emailVerifications.splice(index, 1);
        return clone(removed);
      },
      deleteMany: async ({ where }) => {
        const matched = state.emailVerifications.filter((row) => matchesWhere(row, where));
        state.emailVerifications = state.emailVerifications.filter((row) => !matchesWhere(row, where));
        return { count: matched.length };
      },
      updateMany: async ({ where, data }) => {
        const matched = state.emailVerifications.filter((row) => matchesWhere(row, where));
        matched.forEach((row) => applyUpdateData(row, data));
        return { count: matched.length };
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

function loadSignupRequestsService(prisma, { sendEmailImpl, sendEmailCalls } = {}) {
  const filename = path.resolve(__dirname, "../src/domains/signup-requests/signupRequests.service.js");
  const loaded = { exports: {} };

  vm.runInNewContext(fs.readFileSync(filename, "utf8"), {
    module: loaded,
    exports: loaded.exports,
    require(name) {
      if (name === "crypto") return require("crypto");
      if (name === "bcrypt") {
        return {
          hash: async (password) => `hash:${password}`,
          compare: async (plain, hashed) => hashed === `hash:${plain}`,
        };
      }
      if (name === "@prisma/client") return { Prisma: { PrismaClientKnownRequestError } };
      if (name === "../../prisma/client") return { prisma };
      if (name === "../../config") {
        return { config: { mail: { appBaseUrl: "http://localhost:5173" } } };
      }
      if (name === "../../utils/logger") {
        return { logger: { info() {}, warn() {}, error() {} } };
      }
      if (name === "../../utils/prisma-error") {
        return require(path.resolve(__dirname, "../src/utils/prisma-error"));
      }
      if (name === "../../utils/mailer") {
        return {
          sendEmail: async (params) => {
            sendEmailCalls?.push(params);
            return (sendEmailImpl || (async () => ({ delivered: false, skipped: true })))(params);
          },
        };
      }
      if (name === "../../emails/renderLayout") {
        return require(path.resolve(__dirname, "../src/emails/renderLayout"));
      }
      if (name === "../../utils/email-verification-maintenance") {
        return require(path.resolve(__dirname, "../src/utils/email-verification-maintenance"));
      }
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

function createConsumedEmailVerification(email, overrides = {}) {
  return {
    id: `email-verification-seed-${email}`,
    email,
    purpose: "SIGNUP",
    codeHash: "hash:123456",
    expiresAt: new Date(Date.now() + 10 * 60 * 1000),
    attempts: 0,
    consumedAt: new Date(),
    createdAt: new Date(Date.now() - 60 * 1000),
    ...overrides,
  };
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
  const { prisma, state } = createFakePrisma({
    emailVerifications: [createConsumedEmailVerification("manager01@example.com")],
  });
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
  // 이메일 인증 레코드는 가입 신청 저장과 함께 1회용으로 소비(삭제)된다.
  assert.equal(state.emailVerifications.length, 0);

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

test("이메일 인증을 완료하지 않으면 가입 신청이 거부된다", async () => {
  const { prisma } = createFakePrisma();
  const service = loadSignupRequestsService(prisma);

  await assert.rejects(
    service.createSignupRequest({
      userId: "manager09",
      name: "이관리",
      password: "password123!",
      email: "unverified@example.com",
      phoneNumber: "010-1111-2222",
    }),
    { statusCode: 400, message: "이메일 인증을 먼저 완료해 주세요." },
  );
});

test("이메일 인증 후 30분이 지나면 다시 인증해야 한다", async () => {
  const { prisma } = createFakePrisma({
    emailVerifications: [
      createConsumedEmailVerification("expired-verify@example.com", {
        consumedAt: new Date(Date.now() - 31 * 60 * 1000),
      }),
    ],
  });
  const service = loadSignupRequestsService(prisma);

  await assert.rejects(
    service.createSignupRequest({
      userId: "manager10",
      name: "박관리",
      password: "password123!",
      email: "expired-verify@example.com",
      phoneNumber: "010-3333-4444",
    }),
    { statusCode: 400, message: "이메일 인증을 먼저 완료해 주세요." },
  );
});

test("DB 부분 고유 인덱스 충돌은 가입 신청 중복 오류로 반환한다", async () => {
  const constraintError = new PrismaClientKnownRequestError("unique constraint failed");
  constraintError.code = "P2002";
  constraintError.meta = { target: ["signup_requests_pending_user_id_key"] };

  const { prisma } = createFakePrisma({
    createSignupRequestError: constraintError,
    emailVerifications: [createConsumedEmailVerification("manager02@example.com")],
  });
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

test("승인하면 신청자에게 승인 안내 메일을 보낸다", async () => {
  const { prisma } = createFakePrisma({ requests: [createPendingRequest()] });
  const sendEmailCalls = [];
  const service = loadSignupRequestsService(prisma, {
    sendEmailCalls,
    sendEmailImpl: async () => ({ delivered: true, id: "email-1" }),
  });

  await service.approveSignupRequest({ id: "request-1", reviewerId: "admin-1" });

  assert.equal(sendEmailCalls.length, 1);
  assert.equal(sendEmailCalls[0].to, "manager01@example.com");
  assert.match(sendEmailCalls[0].subject, /승인/);
  assert.match(sendEmailCalls[0].html, /manager01/);
});

test("승인 안내 메일 발송이 실패해도 승인 자체는 성공한다", async () => {
  const { prisma, state } = createFakePrisma({ requests: [createPendingRequest()] });
  const service = loadSignupRequestsService(prisma, {
    sendEmailImpl: async () => ({ delivered: false, error: "타임아웃" }),
  });

  const request = await service.approveSignupRequest({ id: "request-1", reviewerId: "admin-1" });

  assert.equal(request.status, "APPROVED");
  assert.equal(state.users.length, 1);
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

test("이메일 인증코드를 발송하면 레코드가 생성되고 60초 이내 재발송은 막힌다", async () => {
  const sendEmailCalls = [];
  const { prisma, state } = createFakePrisma();
  const service = loadSignupRequestsService(prisma, {
    sendEmailImpl: async () => ({ delivered: true, id: "email-1" }),
    sendEmailCalls,
  });

  const result = await service.sendSignupEmailCode({ email: "new-signup@example.com" });

  assert.equal(result.ok, true);
  assert.equal(result.cooldownSeconds, 60);
  assert.equal(state.emailVerifications.length, 1);
  assert.equal(state.emailVerifications[0].email, "new-signup@example.com");
  assert.equal(state.emailVerifications[0].purpose, "SIGNUP");
  assert.equal(sendEmailCalls.length, 1);
  assert.equal(sendEmailCalls[0].to, "new-signup@example.com");
  assert.match(sendEmailCalls[0].text, /인증코드: \d{6}/);

  await assert.rejects(
    service.sendSignupEmailCode({ email: "new-signup@example.com" }),
    { statusCode: 429 },
  );
});

test("이미 가입에 사용 중인 이메일에는 인증코드를 보내지 않는다", async () => {
  const { prisma } = createFakePrisma({
    users: [{ id: "user-1", userId: "existing", email: "taken@example.com" }],
  });
  const service = loadSignupRequestsService(prisma);

  await assert.rejects(
    service.sendSignupEmailCode({ email: "taken@example.com" }),
    { statusCode: 409 },
  );
});

test("메일 발송에 실패하면 인증코드 레코드를 남기지 않는다", async () => {
  const { prisma, state } = createFakePrisma();
  const service = loadSignupRequestsService(prisma, {
    sendEmailImpl: async () => ({ delivered: false, error: "network down" }),
  });

  await assert.rejects(
    service.sendSignupEmailCode({ email: "fail-send@example.com" }),
    { statusCode: 502 },
  );
  assert.equal(state.emailVerifications.length, 0);
});

test("올바른 인증코드를 입력하면 인증이 완료된다", async () => {
  const sendEmailCalls = [];
  const { prisma, state } = createFakePrisma();
  const service = loadSignupRequestsService(prisma, {
    sendEmailImpl: async () => ({ delivered: true }),
    sendEmailCalls,
  });

  await service.sendSignupEmailCode({ email: "verify-ok@example.com" });
  const [, code] = sendEmailCalls[0].text.match(/인증코드: (\d{6})/);

  const result = await service.verifySignupEmailCode({ email: "verify-ok@example.com", code });

  assert.equal(result.ok, true);
  assert.ok(state.emailVerifications[0].consumedAt);
});

test("틀린 인증코드는 시도 횟수를 늘리고 오류를 반환한다", async () => {
  const { prisma, state } = createFakePrisma({
    emailVerifications: [
      {
        id: "ev-wrong",
        email: "wrong-code@example.com",
        purpose: "SIGNUP",
        codeHash: "hash:123456",
        expiresAt: new Date(Date.now() + 10 * 60 * 1000),
        attempts: 0,
        consumedAt: null,
        createdAt: new Date(),
      },
    ],
  });
  const service = loadSignupRequestsService(prisma);

  await assert.rejects(
    service.verifySignupEmailCode({ email: "wrong-code@example.com", code: "000000" }),
    { statusCode: 400, message: "인증코드가 올바르지 않습니다." },
  );

  assert.equal(state.emailVerifications[0].attempts, 1);
});

test("시도 횟수를 초과하면 재요청을 안내한다", async () => {
  const { prisma } = createFakePrisma({
    emailVerifications: [
      {
        id: "ev-maxed",
        email: "maxed@example.com",
        purpose: "SIGNUP",
        codeHash: "hash:123456",
        expiresAt: new Date(Date.now() + 10 * 60 * 1000),
        attempts: 5,
        consumedAt: null,
        createdAt: new Date(),
      },
    ],
  });
  const service = loadSignupRequestsService(prisma);

  await assert.rejects(
    service.verifySignupEmailCode({ email: "maxed@example.com", code: "123456" }),
    { statusCode: 429 },
  );
});

test("만료된 인증코드는 거부된다", async () => {
  const { prisma } = createFakePrisma({
    emailVerifications: [
      {
        id: "ev-expired",
        email: "expired-code@example.com",
        purpose: "SIGNUP",
        codeHash: "hash:123456",
        expiresAt: new Date(Date.now() - 1000),
        attempts: 0,
        consumedAt: null,
        createdAt: new Date(Date.now() - 11 * 60 * 1000),
      },
    ],
  });
  const service = loadSignupRequestsService(prisma);

  await assert.rejects(
    service.verifySignupEmailCode({ email: "expired-code@example.com", code: "123456" }),
    { statusCode: 400, message: "인증코드가 만료되었습니다. 다시 요청해 주세요." },
  );
});

test("이미 사용된 인증코드는 다시 확인할 수 없다", async () => {
  const { prisma } = createFakePrisma({
    emailVerifications: [
      {
        id: "ev-consumed",
        email: "consumed@example.com",
        purpose: "SIGNUP",
        codeHash: "hash:123456",
        expiresAt: new Date(Date.now() + 10 * 60 * 1000),
        attempts: 0,
        consumedAt: new Date(),
        createdAt: new Date(),
      },
    ],
  });
  const service = loadSignupRequestsService(prisma);

  await assert.rejects(
    service.verifySignupEmailCode({ email: "consumed@example.com", code: "123456" }),
    { statusCode: 400, message: "이미 사용된 인증코드입니다. 다시 요청해 주세요." },
  );
});

test("가장 최근에 발송된 코드만 유효하고 이전 코드는 자동으로 무효화된다", async () => {
  const { prisma } = createFakePrisma({
    emailVerifications: [
      {
        id: "ev-old",
        email: "multi@example.com",
        purpose: "SIGNUP",
        codeHash: "hash:111111",
        expiresAt: new Date(Date.now() + 10 * 60 * 1000),
        attempts: 0,
        consumedAt: null,
        createdAt: new Date(Date.now() - 5 * 60 * 1000),
      },
      {
        id: "ev-new",
        email: "multi@example.com",
        purpose: "SIGNUP",
        codeHash: "hash:222222",
        expiresAt: new Date(Date.now() + 10 * 60 * 1000),
        attempts: 0,
        consumedAt: null,
        createdAt: new Date(),
      },
    ],
  });
  const service = loadSignupRequestsService(prisma);

  await assert.rejects(
    service.verifySignupEmailCode({ email: "multi@example.com", code: "111111" }),
    { statusCode: 400, message: "인증코드가 올바르지 않습니다." },
  );

  const result = await service.verifySignupEmailCode({ email: "multi@example.com", code: "222222" });
  assert.equal(result.ok, true);
});

test("정리 작업은 방치된 이메일 인증 레코드를 삭제한다", async () => {
  const now = new Date();
  const { prisma, state } = createFakePrisma({
    emailVerifications: [
      // 미사용 + 만료됨 → 삭제 대상
      {
        id: "ev-unused-expired",
        email: "unused-expired@example.com",
        purpose: "SIGNUP",
        codeHash: "hash:111111",
        expiresAt: new Date(now.getTime() - 1000),
        attempts: 0,
        consumedAt: null,
        createdAt: new Date(now.getTime() - 11 * 60 * 1000),
      },
      // 미사용이지만 아직 안 만료 → 보존
      {
        id: "ev-unused-active",
        email: "unused-active@example.com",
        purpose: "SIGNUP",
        codeHash: "hash:222222",
        expiresAt: new Date(now.getTime() + 5 * 60 * 1000),
        attempts: 0,
        consumedAt: null,
        createdAt: now,
      },
      // 인증 완료했지만 가입 신청까지 이어지지 않고 인증 유효 창(30분)이 지남 → 삭제 대상
      {
        id: "ev-consumed-stale",
        email: "consumed-stale@example.com",
        purpose: "SIGNUP",
        codeHash: "hash:333333",
        expiresAt: new Date(now.getTime() - 20 * 60 * 1000),
        attempts: 0,
        consumedAt: new Date(now.getTime() - 31 * 60 * 1000),
        createdAt: new Date(now.getTime() - 41 * 60 * 1000),
      },
      // 인증 완료했고 아직 30분 이내 → 가입 신청에서 아직 쓸 수 있으므로 보존
      {
        id: "ev-consumed-recent",
        email: "consumed-recent@example.com",
        purpose: "SIGNUP",
        codeHash: "hash:444444",
        expiresAt: new Date(now.getTime() - 5 * 60 * 1000),
        attempts: 0,
        consumedAt: new Date(now.getTime() - 10 * 60 * 1000),
        createdAt: new Date(now.getTime() - 20 * 60 * 1000),
      },
    ],
  });
  const service = loadSignupRequestsService(prisma);

  const result = await service.runSignupRequestMaintenance(now);

  assert.equal(result.expiredEmailVerificationCount, 2);
  const remainingIds = state.emailVerifications.map((row) => row.id).sort();
  assert.deepEqual(remainingIds, ["ev-consumed-recent", "ev-unused-active"]);
});
