const { prisma } = require("../../prisma/client");

function createHttpError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function normalizeRole(role) {
  return String(role || "").toLowerCase();
}

async function getMyProfile({ id }) {
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

  if (!user || !user.isActive) {
    throw createHttpError(404, "사용자 정보를 찾을 수 없습니다.");
  }

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

module.exports = { getMyProfile };
