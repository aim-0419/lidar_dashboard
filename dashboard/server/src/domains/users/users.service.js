const bcrypt = require("bcrypt");
const { Prisma } = require("@prisma/client");
const { prisma } = require("../../prisma/client");

function createHttpError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function normalizeRole(role) {
  return String(role || "").toLowerCase();
}

function normalizeRoleInput(role) {
  return String(role || "SUPER_ADMIN").trim().toUpperCase();
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

function isBlank(value) {
  return typeof value !== "string" || value.trim() === "";
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

async function createUser({ userId, name, password, role, isActive }) {
  if (isBlank(userId) || isBlank(name) || isBlank(password)) {
    throw createHttpError(400, "userId, name, and password are required.");
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const userData = {
    userId: userId.trim(),
    name: name.trim(),
    passwordHash,
    role: normalizeRoleInput(role),
    isActive: typeof isActive === "boolean" ? isActive : true,
  };

  try {
    const user = await prisma.user.create({
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

    return serializeUser(user);
  } catch (error) {
    handlePrismaError(error);
  }
}

async function updateUser({ id, userId, name, role, isActive }) {
  await findUserRecordById(id);

  const data = {};

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
    data.role = normalizeRoleInput(role);
  }

  const nextIsActive = parseOptionalBoolean(isActive);
  if (typeof nextIsActive === "boolean") {
    data.isActive = nextIsActive;
  }

  if (Object.keys(data).length === 0) {
    throw createHttpError(400, "At least one field is required to update the user.");
  }

  try {
    const user = await prisma.user.update({
      where: { id },
      data,
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

    return serializeUser(user);
  } catch (error) {
    handlePrismaError(error);
  }
}

async function deactivateUser({ id }) {
  await findUserRecordById(id);

  const [, user] = await prisma.$transaction([
    prisma.refreshToken.updateMany({
      where: {
        userId: id,
        revokedAt: null,
      },
      data: {
        revokedAt: new Date(),
      },
    }),
    prisma.user.update({
      where: { id },
      data: {
        isActive: false,
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
    }),
  ]);

  return serializeUser(user);
}

async function updateUserPassword({ id, password }) {
  await findUserRecordById(id);

  if (isBlank(password)) {
    throw createHttpError(400, "password is required.");
  }

  const passwordHash = await bcrypt.hash(password, 10);

  const [, user] = await prisma.$transaction([
    prisma.refreshToken.updateMany({
      where: {
        userId: id,
        revokedAt: null,
      },
      data: {
        revokedAt: new Date(),
      },
    }),
    prisma.user.update({
      where: { id },
      data: {
        passwordHash,
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
    }),
  ]);

  return serializeUser(user);
}

module.exports = {
  getMyProfile,
  listUsers,
  getUserDetail,
  createUser,
  updateUser,
  deactivateUser,
  updateUserPassword,
};
