const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { test } = require("node:test");
const vm = require("node:vm");
const jsonwebtoken = require("jsonwebtoken");

const JWT_SECRET = "test-jwt-secret";

function matchesWhere(row, where = {}) {
  if (Array.isArray(where.OR)) {
    return where.OR.some((condition) => matchesWhere(row, condition));
  }

  return Object.entries(where).every(([key, condition]) => {
    const value = row[key];

    if (condition && typeof condition === "object" && !(condition instanceof Date)) {
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

function createFakePrisma({ users = [], emailVerifications = [] } = {}) {
  const state = {
    users: users.map((user) => ({ ...user })),
    emailVerifications: emailVerifications.map((row) => ({ ...row })),
    refreshTokens: [],
    userAuditLogs: [],
  };
  let emailVerificationSequence = state.emailVerifications.length + 1;

  function sortByCreatedAtDesc(rows) {
    return [...rows].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  const prisma = {
    user: {
      findUnique: async ({ where }) => {
        if (where.email !== undefined) {
          return state.users.find((user) => user.email === where.email) || null;
        }
        return state.users.find((user) => user.id === where.id) || null;
      },
      update: async ({ where, data }) => {
        const user = state.users.find((candidate) => candidate.id === where.id);
        if (!user) throw new Error(`user not found: ${where.id}`);
        for (const [key, value] of Object.entries(data)) {
          if (value && typeof value === "object" && Object.hasOwn(value, "increment")) {
            user[key] = (user[key] || 0) + value.increment;
            continue;
          }
          user[key] = value;
        }
        return { ...user };
      },
    },
    emailVerification: {
      findFirst: async ({ where, orderBy }) => {
        let rows = state.emailVerifications.filter((row) => matchesWhere(row, where));
        if (orderBy?.createdAt === "desc") rows = sortByCreatedAtDesc(rows);
        return rows[0] ? { ...rows[0] } : null;
      },
      findUnique: async ({ where }) => {
        const row = state.emailVerifications.find((candidate) => candidate.id === where.id);
        return row ? { ...row } : null;
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
        return { ...row };
      },
      update: async ({ where, data }) => {
        const row = state.emailVerifications.find((candidate) => candidate.id === where.id);
        if (!row) throw new Error(`emailVerification not found: ${where.id}`);
        for (const [key, value] of Object.entries(data)) {
          if (value && typeof value === "object" && !(value instanceof Date) && Object.hasOwn(value, "increment")) {
            row[key] = (row[key] || 0) + value.increment;
            continue;
          }
          row[key] = value;
        }
        return { ...row };
      },
      deleteMany: async ({ where }) => {
        const matched = state.emailVerifications.filter((row) => matchesWhere(row, where));
        state.emailVerifications = state.emailVerifications.filter((row) => !matchesWhere(row, where));
        return { count: matched.length };
      },
      updateMany: async ({ where, data }) => {
        const matched = state.emailVerifications.filter((row) => matchesWhere(row, where));
        matched.forEach((row) => {
          for (const [key, value] of Object.entries(data)) {
            if (value && typeof value === "object" && !(value instanceof Date) && Object.hasOwn(value, "increment")) {
              row[key] = (row[key] || 0) + value.increment;
              continue;
            }
            row[key] = value;
          }
        });
        return { count: matched.length };
      },
    },
    refreshToken: {
      updateMany: async ({ where, data }) => {
        const matched = state.refreshTokens.filter((row) => matchesWhere(row, where));
        matched.forEach((row) => Object.assign(row, data));
        return { count: matched.length };
      },
    },
    userAuditLog: {
      create: async ({ data }) => {
        state.userAuditLogs.push(data);
        return data;
      },
    },
    $executeRaw: async () => 0,
    $transaction: async (callback) => callback(prisma),
  };

  return { prisma, state };
}

function loadAuthService(prisma, { sendEmailImpl, sendEmailCalls } = {}) {
  const filename = path.resolve(__dirname, "../src/domains/auth/auth.service.js");
  const loaded = { exports: {} };

  vm.runInNewContext(fs.readFileSync(filename, "utf8"), {
    module: loaded,
    exports: loaded.exports,
    require(name) {
      if (name === "crypto") return require("crypto");
      if (name === "jsonwebtoken") return jsonwebtoken;
      if (name === "bcrypt") {
        return {
          hash: async (password) => `hash:${password}`,
          compare: async (plain, hashed) => hashed === `hash:${plain}`,
        };
      }
      if (name === "../../config") {
        return { config: { jwtSecret: JWT_SECRET, jwtRefreshSecret: "test-refresh-secret", mail: { appBaseUrl: "http://localhost:5173" } } };
      }
      if (name === "../../prisma/client") return { prisma };
      if (name === "../../utils/logger") {
        return { logger: { info() {}, warn() {}, error() {} } };
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
          getPasswordValidationError: (password) =>
            typeof password === "string" && password.length >= 8 ? null : "TOO_SHORT",
          isValidPassword: (password) => typeof password === "string" && password.length >= 8,
        };
      }
      throw new Error(`Unexpected dependency: ${name}`);
    },
  }, { filename });

  return loaded.exports;
}

function createActiveUser(overrides = {}) {
  return {
    id: "user-1",
    userId: "manager01",
    email: "manager01@example.com",
    isActive: true,
    passwordHash: "hash:oldpassword1",
    sessionVersion: 3,
    ...overrides,
  };
}

test("존재하지 않는 이메일도 존재하는 이메일과 동일한 응답을 준다", async () => {
  const { prisma, state } = createFakePrisma({ users: [] });
  const sendEmailCalls = [];
  const authService = loadAuthService(prisma, { sendEmailCalls });

  const result = await authService.requestPasswordResetCode({ email: "nobody@example.com" });

  assert.equal(result.ok, true);
  assert.equal(sendEmailCalls.length, 0);
  assert.equal(state.emailVerifications.length, 0);
});

test("가입된 이메일이면 인증코드를 발송하고 레코드를 남긴다", async () => {
  const { prisma, state } = createFakePrisma({ users: [createActiveUser()] });
  const sendEmailCalls = [];
  const authService = loadAuthService(prisma, {
    sendEmailCalls,
    sendEmailImpl: async () => ({ delivered: true, id: "email-1" }),
  });

  const result = await authService.requestPasswordResetCode({ email: "manager01@example.com" });

  assert.equal(result.ok, true);
  assert.equal(sendEmailCalls.length, 1);
  assert.equal(sendEmailCalls[0].to, "manager01@example.com");
  assert.equal(state.emailVerifications.length, 1);
  assert.equal(state.emailVerifications[0].purpose, "PASSWORD_RESET");
});

test("쿨다운 중에는 재발송하지 않지만 동일한 응답을 준다", async () => {
  const existing = {
    id: "existing-1",
    email: "manager01@example.com",
    purpose: "PASSWORD_RESET",
    codeHash: "hash:123456",
    expiresAt: new Date(Date.now() + 10 * 60 * 1000),
    attempts: 0,
    consumedAt: null,
    createdAt: new Date(),
  };
  const { prisma, state } = createFakePrisma({
    users: [createActiveUser()],
    emailVerifications: [existing],
  });
  const sendEmailCalls = [];
  const authService = loadAuthService(prisma, { sendEmailCalls });

  const result = await authService.requestPasswordResetCode({ email: "manager01@example.com" });

  assert.equal(result.ok, true);
  assert.equal(sendEmailCalls.length, 0);
  assert.equal(state.emailVerifications.length, 1);
});

test("올바른 인증코드를 확인하면 resetToken을 발급한다", async () => {
  const verification = {
    id: "verification-1",
    email: "manager01@example.com",
    purpose: "PASSWORD_RESET",
    codeHash: "hash:123456",
    expiresAt: new Date(Date.now() + 10 * 60 * 1000),
    attempts: 0,
    consumedAt: null,
    createdAt: new Date(),
  };
  const { prisma, state } = createFakePrisma({ emailVerifications: [verification] });
  const authService = loadAuthService(prisma);

  const result = await authService.verifyPasswordResetCode({ email: "manager01@example.com", code: "123456" });

  assert.equal(result.ok, true);
  assert.ok(result.resetToken);
  const decoded = jsonwebtoken.verify(result.resetToken, JWT_SECRET);
  assert.equal(decoded.type, "password_reset");
  assert.equal(decoded.email, "manager01@example.com");
  assert.ok(state.emailVerifications[0].consumedAt);
});

test("코드를 요청한 적 없어도 코드가 틀렸을 때와 같은 오류를 준다", async () => {
  const { prisma } = createFakePrisma({ emailVerifications: [] });
  const authService = loadAuthService(prisma);

  await assert.rejects(
    () => authService.verifyPasswordResetCode({ email: "nobody@example.com", code: "123456" }),
    (error) => {
      assert.equal(error.statusCode, 400);
      assert.equal(error.message, "인증코드가 올바르지 않습니다.");
      return true;
    },
  );
});

test("틀린 코드는 시도 횟수를 늘리고 같은 오류를 준다", async () => {
  const verification = {
    id: "verification-1",
    email: "manager01@example.com",
    purpose: "PASSWORD_RESET",
    codeHash: "hash:123456",
    expiresAt: new Date(Date.now() + 10 * 60 * 1000),
    attempts: 0,
    consumedAt: null,
    createdAt: new Date(),
  };
  const { prisma, state } = createFakePrisma({ emailVerifications: [verification] });
  const authService = loadAuthService(prisma);

  await assert.rejects(() =>
    authService.verifyPasswordResetCode({ email: "manager01@example.com", code: "000000" }),
  );

  assert.equal(state.emailVerifications[0].attempts, 1);
});

test("resetToken으로 비밀번호를 변경하고 세션을 모두 무효화한다", async () => {
  const user = createActiveUser();
  const verification = {
    id: "verification-1",
    email: user.email,
    purpose: "PASSWORD_RESET",
    codeHash: "hash:123456",
    expiresAt: new Date(Date.now() + 10 * 60 * 1000),
    attempts: 0,
    consumedAt: new Date(),
    createdAt: new Date(),
  };
  const { prisma, state } = createFakePrisma({
    users: [user],
    emailVerifications: [verification],
  });
  state.refreshTokens.push({ id: "rt-1", userId: user.id, revokedAt: null });
  const authService = loadAuthService(prisma);

  const resetToken = jsonwebtoken.sign(
    { type: "password_reset", email: user.email, verificationId: verification.id },
    JWT_SECRET,
    { expiresIn: "15m" },
  );

  const result = await authService.confirmPasswordReset({ resetToken, newPassword: "newpassword1" });

  assert.equal(result.ok, true);
  assert.equal(state.users[0].passwordHash, "hash:newpassword1");
  assert.equal(state.users[0].sessionVersion, 4);
  assert.equal(state.refreshTokens[0].revokedAt !== null, true);
  assert.equal(state.emailVerifications.length, 0);
  assert.equal(state.userAuditLogs.length, 1);
  assert.equal(state.userAuditLogs[0].action, "USER_PASSWORD_RESET_VIA_EMAIL");
});

test("이미 사용된(삭제된) resetToken은 재사용할 수 없다", async () => {
  const user = createActiveUser();
  const { prisma } = createFakePrisma({ users: [user], emailVerifications: [] });
  const authService = loadAuthService(prisma);

  const resetToken = jsonwebtoken.sign(
    { type: "password_reset", email: user.email, verificationId: "already-consumed-and-removed" },
    JWT_SECRET,
    { expiresIn: "15m" },
  );

  await assert.rejects(() =>
    authService.confirmPasswordReset({ resetToken, newPassword: "newpassword1" }),
  );
});

test("너무 짧은 새 비밀번호는 거부한다", async () => {
  const user = createActiveUser();
  const verification = {
    id: "verification-1",
    email: user.email,
    purpose: "PASSWORD_RESET",
    consumedAt: new Date(),
    createdAt: new Date(),
  };
  const { prisma } = createFakePrisma({ users: [user], emailVerifications: [verification] });
  const authService = loadAuthService(prisma);

  const resetToken = jsonwebtoken.sign(
    { type: "password_reset", email: user.email, verificationId: verification.id },
    JWT_SECRET,
    { expiresIn: "15m" },
  );

  await assert.rejects(
    () => authService.confirmPasswordReset({ resetToken, newPassword: "short" }),
    (error) => {
      assert.equal(error.statusCode, 400);
      return true;
    },
  );
});
