const authService = require("./auth.service");
const { logger } = require("../../utils/logger");

async function login(req, res) {
  try {
    logger.info("컨트롤러에서 로그인 요청 수신", {
      userId: req.body?.userId,
    });

    const result = await authService.login({
      userId: req.body?.userId,
      password: req.body?.password,
    });

    res.status(200).json(result);
  } catch (error) {
    logger.warn("컨트롤러에서 로그인 요청 실패", {
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
