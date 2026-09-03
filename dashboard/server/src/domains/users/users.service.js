const bcrypt = require("bcrypt");
const { Prisma } = require("@prisma/client");
const { prisma } = require("../../prisma/client");

const ALLOWED_ROLES = ["SUPER_ADMIN", "MANAGER"];
const MIN_PASSWORD_LENGTH = 8;
const MAX_PASSWORD_BYTES = 72;

function createHttpError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function normalizeRole(role) {
  return String(role || "").toLowerCase();
}

function normalizeRoleInput(role) {
  const normalizedRole = String(role || "MANAGER").trim().toUpperCase();

  if (!ALLOWED_ROLES.includes(normalizedRole)) {
    throw createHttpError(400, `role must be one of: ${ALLOWED_ROLES.join(", ")}.`);
  }

  return normalizedRole;
}

function serializeUser(user) {
  return {
    id: user.id,
    userId: user.userId,
    name: user.name,
    role: normalizeRole(user.role),
    isActive: user.isActive,
    lastLoginAt: user.lastLoginAt,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

function createUserAuditSnapshot(user) {
  return {
    userId: user.userId,
    name: user.name,
    role: user.role,
    isActive: user.isActive,
  };
}

async function createUserAuditLog(tx, { actorUserId, targetUserId, action, beforeData, afterData }) {
  await tx.userAuditLog.create({
    data: {
      actorUserId: actorUserId || null,
      targetUserId,
      action,
      beforeData,
      afterData,
    },
  });
}

function isBlank(value) {
  return typeof value !== "string" || value.trim() === "";
}

function validatePasswordPolicy(password) {
  if (isBlank(password)) {
    throw createHttpError(400, "비밀번호를 입력해 주세요.");
  }

  if (password.length < MIN_PASSWORD_LENGTH) {
    throw createHttpError(400, `비밀번호는 ${MIN_PASSWORD_LENGTH}자 이상 입력해 주세요.`);
  }

  // bcrypt는 72바이트 이후 문자열을 해시에 반영하지 않는다.
  if (Buffer.byteLength(password, "utf8") > MAX_PASSWORD_BYTES) {
    throw createHttpError(400, `비밀번호는 ${MAX_PASSWORD_BYTES}바이트 이하로 입력해 주세요.`);
  }
}

function parseOptionalBoolean(value) {
  if (typeof value === "boolean") {
    return value;
  }

  return undefined;
}

function handlePrismaError(error) {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
    throw createHttpError(409, "User ID already exists.");
  }

  throw error;
}

async function findUserRecordById(id) {
  const user = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      userId: true,
      name: true,
      role: true,
      isActive: true,
      lastLoginAt: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  if (!user) {
    throw createHttpError(404, "User not found.");
  }

  return user;
}

async function findSerializedUserById(id) {
  const user = await findUserRecordById(id);
  return serializeUser(user);
}

async function getMyProfile({ id }) {
  const user = await findSerializedUserById(id);

  if (!user.isActive) {
    throw createHttpError(404, "User not found.");
  }

  return user;
}

async function listUsers() {
  const users = await prisma.user.findMany({
    orderBy: {
      createdAt: "desc",
    },
    select: {
      id: true,
      userId: true,
      name: true,
      role: true,
      isActive: true,
      lastLoginAt: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  return {
    count: users.length,
    users: users.map(serializeUser),
  };
}

async function getUserDetail({ id }) {
  return findSerializedUserById(id);
}

async function createUser({ userId, name, password, role, isActive, requesterId }) {
  if (isBlank(userId) || isBlank(name) || isBlank(password)) {
    throw createHttpError(400, "userId, name, and password are required.");
  }

  validatePasswordPolicy(password);

  const passwordHash = await bcrypt.hash(password, 10);
  const userData = {
    userId: userId.trim(),
    name: name.trim(),
    passwordHash,
    role: normalizeRoleInput(role),
    isActive: typeof isActive === "boolean" ? isActive : true,
  };

  try {
    const user = await prisma.$transaction(async (tx) => {
      const createdUser = await tx.user.create({
        data: userData,
        select: {
          id: true,
          userId: true,
          name: true,
          role: true,
          isActive: true,
          lastLoginAt: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      await createUserAuditLog(tx, {
        actorUserId: requesterId,
        targetUserId: createdUser.id,
        action: "USER_CREATED",
        afterData: createUserAuditSnapshot(createdUser),
      });

      return createdUser;
    });

    return serializeUser(user);
  } catch (error) {
    handlePrismaError(error);
  }
}

async function updateUser({ id, userId, name, role, isActive, requesterId, requesterRole }) {
  const existingUser = await findUserRecordById(id);
  const isSelfUpdate = requesterId === id;
  const isRequesterSuperAdmin = normalizeRole(requesterRole) === "super_admin";
  const data = {};

  if (!isSelfUpdate && !isRequesterSuperAdmin) {
    throw createHttpError(403, "You do not have permission to update this user.");
  }

  if (typeof userId === "string") {
    if (userId.trim() === "") {
      throw createHttpError(400, "userId cannot be empty.");
    }
    data.userId = userId.trim();
  }

  if (typeof name === "string") {
    if (name.trim() === "") {
      throw createHttpError(400, "name cannot be empty.");
    }
    data.name = name.trim();
  }

  if (typeof role === "string") {
    if (role.trim() === "") {
      throw createHttpError(400, "role cannot be empty.");
    }

    const nextRole = normalizeRoleInput(role);

    if (isSelfUpdate && nextRole !== existingUser.role) {
      throw createHttpError(403, "You cannot change your own role.");
    }

    data.role = nextRole;
  }

  const nextIsActive = parseOptionalBoolean(isActive);
  if (typeof nextIsActive === "boolean") {
    if (isSelfUpdate && nextIsActive !== existingUser.isActive) {
      throw createHttpError(403, "You cannot change your own active status.");
    }

    data.isActive = nextIsActive;
  }

  if (Object.keys(data).length === 0) {
    throw createHttpError(400, "At least one field is required to update the user.");
  }

  const shouldDeactivateUser = existingUser.isActive && nextIsActive === false;

  try {
    const user = await prisma.$transaction(async (tx) => {
      if (shouldDeactivateUser) {
        await tx.refreshToken.updateMany({
          where: {
            userId: id,
            revokedAt: null,
          },
          data: {
            revokedAt: new Date(),
          },
        });
      }

      const updatedUser = await tx.user.update({
        where: { id },
        data: shouldDeactivateUser
          ? {
              ...data,
              isActive: false,
              sessionVersion: {
                increment: 1,
              },
            }
          : data,
        select: {
          id: true,
          userId: true,
          name: true,
          role: true,
          isActive: true,
          lastLoginAt: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      await createUserAuditLog(tx, {
        actorUserId: requesterId,
        targetUserId: updatedUser.id,
        action: shouldDeactivateUser ? "USER_DEACTIVATED" : "USER_UPDATED",
        beforeData: createUserAuditSnapshot(existingUser),
        afterData: createUserAuditSnapshot(updatedUser),
      });

      return updatedUser;
    });

    return serializeUser(user);
  } catch (error) {
    handlePrismaError(error);
  }
}

async function deactivateUser({ id, requesterId }) {
  const existingUser = await findUserRecordById(id);

  if (requesterId === id) {
    throw createHttpError(403, "You cannot deactivate your own account.");
  }

  const user = await prisma.$transaction(async (tx) => {
    await tx.refreshToken.updateMany({
      where: {
        userId: id,
        revokedAt: null,
      },
      data: {
        revokedAt: new Date(),
      },
    });

    const updatedUser = await tx.user.update({
      where: { id },
      data: {
        isActive: false,
        sessionVersion: {
          increment: 1,
        },
      },
      select: {
        id: true,
        userId: true,
        name: true,
        role: true,
        isActive: true,
        lastLoginAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    await createUserAuditLog(tx, {
      actorUserId: requesterId,
      targetUserId: updatedUser.id,
      action: "USER_DEACTIVATED",
      beforeData: createUserAuditSnapshot(existingUser),
      afterData: createUserAuditSnapshot(updatedUser),
    });

    return updatedUser;
  });

  return serializeUser(user);
}

async function verifyUserPassword({ id, requesterId, currentPassword }) {
  if (requesterId !== id) {
    throw createHttpError(403, "You can only verify your own password.");
  }

  if (isBlank(currentPassword)) {
    throw createHttpError(400, "currentPassword is required.");
  }

  const userRecord = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      passwordHash: true,
    },
  });

  if (!userRecord) {
    throw createHttpError(404, "User not found.");
  }

  const isPasswordMatched = await bcrypt.compare(currentPassword, userRecord.passwordHash);
  if (!isPasswordMatched) {
    throw createHttpError(401, "Current password is incorrect.");
  }

  return { verified: true };
}

async function updateUserPassword({ id, requesterId, currentPassword, newPassword }) {
  if (requesterId !== id) {
    throw createHttpError(403, "You can only change your own password.");
  }

  if (isBlank(currentPassword) || isBlank(newPassword)) {
    throw createHttpError(400, "currentPassword and newPassword are required.");
  }

  if (currentPassword === newPassword) {
    throw createHttpError(400, "New password must be different from current password.");
  }

  validatePasswordPolicy(newPassword);

  const userRecord = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      passwordHash: true,
    },
  });

  if (!userRecord) {
    throw createHttpError(404, "User not found.");
  }

  const isPasswordMatched = await bcrypt.compare(currentPassword, userRecord.passwordHash);
  if (!isPasswordMatched) {
    throw createHttpError(401, "Current password is incorrect.");
  }

  const passwordHash = await bcrypt.hash(newPassword, 10);

  const user = await prisma.$transaction(async (tx) => {
    await tx.refreshToken.updateMany({
      where: {
        userId: id,
        revokedAt: null,
      },
      data: {
        revokedAt: new Date(),
      },
    });

    const updatedUser = await tx.user.update({
      where: { id },
      data: {
        passwordHash,
        sessionVersion: {
          increment: 1,
        },
      },
      select: {
        id: true,
        userId: true,
        name: true,
        role: true,
        isActive: true,
        lastLoginAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    await createUserAuditLog(tx, {
      actorUserId: requesterId,
      targetUserId: updatedUser.id,
      action: "USER_PASSWORD_CHANGED",
      afterData: { sessionInvalidated: true },
    });

    return updatedUser;
  });

  return serializeUser(user);
}

async function resetUserPassword({ id, requesterId, newPassword }) {
  if (requesterId === id) {
    throw createHttpError(400, "본인 비밀번호는 비밀번호 변경 기능을 사용해 주세요.");
  }

  validatePasswordPolicy(newPassword);

  const userRecord = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      passwordHash: true,
    },
  });

  if (!userRecord) {
    throw createHttpError(404, "사용자를 찾을 수 없습니다.");
  }

  const isSamePassword = await bcrypt.compare(newPassword, userRecord.passwordHash);
  if (isSamePassword) {
    throw createHttpError(400, "기존 비밀번호와 같은 비밀번호로 초기화할 수 없습니다.");
  }

  const passwordHash = await bcrypt.hash(newPassword, 10);

  // 초기화한 계정의 기존 로그인 세션을 모두 무효화한다.
  const user = await prisma.$transaction(async (tx) => {
    await tx.refreshToken.updateMany({
      where: {
        userId: id,
        revokedAt: null,
      },
      data: {
        revokedAt: new Date(),
      },
    });

    const updatedUser = await tx.user.update({
      where: { id },
      data: {
        passwordHash,
        sessionVersion: {
          increment: 1,
        },
      },
      select: {
        id: true,
        userId: true,
        name: true,
        role: true,
        isActive: true,
        lastLoginAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    await createUserAuditLog(tx, {
      actorUserId: requesterId,
      targetUserId: updatedUser.id,
      action: "USER_PASSWORD_RESET",
      afterData: { sessionInvalidated: true },
    });

    return updatedUser;
  });

  return serializeUser(user);
}

module.exports = {
  getMyProfile,
  listUsers,
  getUserDetail,
  createUser,
  updateUser,
  deactivateUser,
  verifyUserPassword,
  updateUserPassword,
  resetUserPassword,
};
