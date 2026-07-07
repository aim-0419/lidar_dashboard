// 로그인 요청을 받아서 서비스에 넘기고, 결과를 클라이언트에 응답한다. 

// 실제 로그인 비즈니스 로직이 들어있는 auth.service 가져오기
const authService = require("./auth.service");
// 서버 로그를 기록하기 위한 logger 가져오기 
const { logger } = require("../../utils/logger");

// 로그인 요청을 처리하는 비동기 컨트롤러 함수 
async function login(req, res) {
  try {
    // 클라이언트가 보낸 userId와 password를 service의 login 함수로 전달
    // await를 사용해 로그인 처리가 끝날 때까지 기다림
    const result = await authService.login({
      userId: req.body?.userId,
      password: req.body?.password,
    });

    // 로그인 성공 시 HTTP 200 상태코드와 로그인 결과를 JSON으로 응답
    res.status(200).json(result);
  } catch (error) {
    // 로그인 실패 시 서버 로그에 경고 수준으로 실패 정보 기록
    logger.warn("login failed", {
      userId: req.body?.userId,
      statusCode: error.statusCode,
      message: error.message,
    });

    // 로그인 실패 시 에러의 상태코드를 사용하고,
    // 상태코드가 없으면 기본값으로 500 Internal Server Error 사용
    res.status(error.statusCode || 500).json({
      ok: false,
      // 에러 메시지가 있으면 해당 메시지를 사용하고,
      // 없으면 기본 오류 메시지 반환 
      message: error.message || "로그인 처리 중 오류가 발생했습니다.",
    });
  }
}

// 다른 파일에서 login 컨트롤러 함수를 사용할 수 있도록 내보내기 
module.exports = { login };
