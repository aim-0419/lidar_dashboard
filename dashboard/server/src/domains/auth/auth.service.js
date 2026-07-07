
// 비밀번호 해시 비교를 위해 bcrypt 가져오기
const bcrypt = require("bcrypt");

// JWT accessToken, refreshToken 생성을 위해 jsonwebtoken 가져오기 
const jwt = require("jsonwebtoken");

// 환경변수 기반 설정값 가져오기 
const { config } = require("../../config");

// Prisma Client 가져오기
const { prisma } = require("../../prisma/client");

// 로그인 실패 시 공통으로 사용할 메시지 
const INVALID_LOGIN_MESSAGE = "아이디 또는 비밀번호가 올바르지 않습니다.";

// HTTP 상태코드를 포함한 에러 객체 생성 함수 
function createHttpError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

// DB의 role 값을 응답용으로 소문자 변환 
function normalizeRole(role) {
  return String(role || "").toLowerCase();
}

// 실제 로그인 처리 함수 
async function login({ userId, password }) {
  // userId 또는 password가 없으면 로그인 실패 처리 
  if (!userId || !password) {
    throw createHttpError(401, INVALID_LOGIN_MESSAGE);
  }

  // users 테이블에서 userId가 일치하는 사용자 조회 
  const user = await prisma.user.findUnique({
    where: { userId },
  });

  // 사용자가 없거나 비활성화 계정이면 로그인 실패 처리 
  if (!user || !user.isActive) {
    throw createHttpError(401, INVALID_LOGIN_MESSAGE);
  }

  //  입력한 비밀번호와 DB의 passwordHash 비교 
  const isPasswordMatched = await bcrypt.compare(password, user.passwordHash);
  // 비밀번호가 일치하지 않으면 로그인 실패 처리 
  if (!isPasswordMatched) {
    throw createHttpError(401, INVALID_LOGIN_MESSAGE);
  }

  // accessToken 생성
  const accessToken = jwt.sign(
    {
      id: user.id,
      userId: user.userId,
      role: user.role,
    },
    config.jwtSecret,
    { expiresIn: "1h" },
  );

  // refreshToken 생성
  const refreshToken = jwt.sign(
    {
      id: user.id,
    },
    config.jwtRefreshSecret,
    { expiresIn: "7d" },
  );

  // 로그인 성공 시 마지막 로그인 시간 업데이트
  await prisma.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() },
  });

  // 클라이언트에 반환할 로그인 성공 응답
  return {
    ok: true,
    accessToken,
    refreshToken,
    user: {
      id: user.id,
      userId: user.userId,
      name: user.name,
      role: normalizeRole(user.role),
    },
  };
}

// login 함수를 다른 파일에서 사용할 수 있도록 내보내기
module.exports = { login };
