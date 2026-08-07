const authService = require("./auth.service");
const usersService = require("../users/users.service");
const { logger } = require("../../utils/logger");

const REFRESH_TOKEN_COOKIE_NAME = "refreshToken";
const REFRESH_TOKEN_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

function getCookieValue(cookieHeader, cookieName) {
  if (!cookieHeader) {
    return "";
  }

  const cookies = cookieHeader.split(";");
  const matchedCookie = cookies.find((cookie) => cookie.trim().startsWith(cookieName + "="));

  if (!matchedCookie) {
    return "";
  }

  return decodeURIComponent(matchedCookie.trim().slice(cookieName.length + 1));
}

function setRefreshTokenCookie(res, refreshToken) {
  res.cookie(REFRESH_TOKEN_COOKIE_NAME, refreshToken, {
    httpOnly: true,
    secure: false,
    sameSite: "lax",
    maxAge: REFRESH_TOKEN_MAX_AGE_MS,
    path: "/",
  });
}

function clearRefreshTokenCookie(res) {
  res.clearCookie(REFRESH_TOKEN_COOKIE_NAME, {
    httpOnly: true,
    secure: false,
    sameSite: "lax",
    path: "/",
  });
}

function getPublicMessage(error, fallbackMessage) {
  return error?.statusCode && error.statusCode < 500
    ? error.message
    : fallbackMessage;
}

async function login(req, res) {
  try {
    logger.info("login request accepted by controller", {
      userId: req.body?.userId,
      ipAddress: req.ip,
    });

    const result = await authService.login({
      userId: req.body?.userId,
      password: req.body?.password,
      ipAddress: req.ip,
    });

    setRefreshTokenCookie(res, result.refreshToken);

    res.status(200).json({
      ok: result.ok,
      accessToken: result.accessToken,
      user: result.user,
    });
  } catch (error) {
    logger.warn("login request failed in controller", {
      userId: req.body?.userId,
      ipAddress: req.ip,
      statusCode: error.statusCode,
      message: error.message,
    });

    res.status(error.statusCode || 500).json({
      ok: false,
      message: getPublicMessage(error, "로그인 처리 중 오류가 발생했습니다."),
    });
  }
}

async function refresh(req, res) {
  try {
    const refreshToken = getCookieValue(req.headers.cookie, REFRESH_TOKEN_COOKIE_NAME);
    const result = await authService.refreshAccessToken({ refreshToken });

    res.status(200).json(result);
  } catch (error) {
    logger.warn("refresh request failed in controller", {
      statusCode: error.statusCode,
      message: error.message,
    });

    if (error.statusCode === 401) {
      clearRefreshTokenCookie(res);
    }

    res.status(error.statusCode || 500).json({
      ok: false,
      message: getPublicMessage(error, "토큰 재발급 처리 중 오류가 발생했습니다."),
    });
  }
}

async function logout(req, res) {
  try {
    const refreshToken = getCookieValue(req.headers.cookie, REFRESH_TOKEN_COOKIE_NAME);
    const result = await authService.logout({ refreshToken });

    clearRefreshTokenCookie(res);

    res.status(200).json(result);
  } catch (error) {
    logger.warn("logout request failed in controller", {
      statusCode: error.statusCode,
      message: error.message,
    });

    clearRefreshTokenCookie(res);

    res.status(error.statusCode || 500).json({
      ok: false,
      message: getPublicMessage(error, "로그아웃 처리 중 오류가 발생했습니다."),
    });
  }
}

async function me(req, res) {
  try {
    const user = await usersService.getMyProfile({
      id: req.user.id,
    });

    res.status(200).json({
      ok: true,
      user,
    });
  } catch (error) {
    logger.warn("me request failed in controller", {
      userId: req.user?.userId,
      statusCode: error.statusCode,
      message: error.message,
    });

    res.status(error.statusCode || 500).json({
      ok: false,
      message: getPublicMessage(error, "내 정보 조회 중 오류가 발생했습니다."),
    });
  }
}

module.exports = { login, refresh, logout, me };
