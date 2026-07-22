const authService = require("./auth.service");
const { logger } = require("../../utils/logger");

const REFRESH_TOKEN_COOKIE_NAME = "refreshToken";
const REFRESH_TOKEN_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

async function login(req, res) {
  try {
    logger.info("login request accepted by controller", {
      userId: req.body?.userId,
    });

    const result = await authService.login({
      userId: req.body?.userId,
      password: req.body?.password,
    });

    res.cookie(REFRESH_TOKEN_COOKIE_NAME, result.refreshToken, {
      httpOnly: true,
      secure: false,
      sameSite: "lax",
      maxAge: REFRESH_TOKEN_MAX_AGE_MS,
      path: "/",
    });

    res.status(200).json({
      ok: result.ok,
      accessToken: result.accessToken,
      user: result.user,
    });
  } catch (error) {
    logger.warn("login request failed in controller", {
      userId: req.body?.userId,
      statusCode: error.statusCode,
      message: error.message,
    });

    res.status(error.statusCode || 500).json({
      ok: false,
      message: error.message || "로그인 처리 중 오류가 발생했습니다.",
    });
  }
}

module.exports = { login };
