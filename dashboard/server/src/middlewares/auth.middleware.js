const jwt = require("jsonwebtoken");

const { config } = require("../config");
const { logger } = require("../utils/logger");

/**
 * JWT Access Token 인증 미들웨어
 * 
 * 요청 헤더의 Authorization 값을 확인하고,
 * Bearer Token이 유효한 경우 사용자 정보를 req.user에 저장한 뒤 
 * 다음 미들웨어 또는 컨트롤러로 요청을 전달한다.  
 * 
 * Authorization 헤더 형식:
 * Authorization: Bearer <accessToken>
 */

function authenticateToken(req, res, next) {
  // 요청 헤더에서 Authorization 값을 가져온다.
  // Authorization 헤더가 없는 경우 빈 문자열("")을 사용한다.
  const authorizationHeader = req.headers.authorization || "";

  // Authorization 헤더가 "Bearer" 형식으로 시작하는지 확인한다. 
  // 토큰이 없거나 Bearer 인증 형식이 아닌 경우 인증 실패 처리한다.
  if (!authorizationHeader.startsWith("Bearer ")) {
    logger.warn("인증 실패: Bearer 토큰 없음", {
      path: req.originalUrl,
      method: req.method,
    });

    return res.status(401).json({
      ok: false,
      message: "인증이 요청됨.",
    });
  }

  // "Bearer " 문자열(7글자)을 제거하여 실제 Access Token만 추출한다.
  // trim()으로 앞뒤 불필요한 공백도 제거한다.
  const accessToken = authorizationHeader.slice(7).trim();

  // "Bearer " 형식은 존재하지만 실제 토큰 값이 비어 있는 경우
  // 인증 실패 처리한다.
  if (!accessToken) {
    logger.warn("인증 실패: Bearer 토큰 값이 비어 있음", {
      path: req.originalUrl,
      method: req.method,
    });

    return res.status(401).json({
      ok: false,
      message: "인증이 요청됨.",
    });
  }

  try {
    // Access Token의 서명과 만료 여부를 검증한다.
    // 토큰이 유효하면 JWT Payload(decoded)를 반환한다.
    // 토큰이 만료되었거나 변조된 경우 예외가 발생하여 catch 블록으로 이동한다.
    const decoded = jwt.verify(accessToken, config.jwtSecret);

    // 검증된 JWT Payload에서 사용자 정보를 추출하여 req.user에 저장한다. 
    // 이후 컨트롤러나 다른 미들웨어에서 req.user로 로그인 사용자 정보를 사용할 수 있다.
    req.user = {
      id: decoded.id,
      userId: decoded.userId,
      role: decoded.role,
    };

    logger.info("인증 성공", {
      path: req.originalUrl,
      method: req.method,
      userId: req.user.userId,
      role: req.user.role,
    });

    // 인증에 성공했으므로 다음 미들웨어 또는 컨트롤러로 요청을 전달한다.
    next();
  } catch (error) {
    // JWT 검증 실패 처리
    // 예: 만료된 토큰, 변조된 토큰, 잘못된 서명 등
    logger.warn("인증 실패: 유효하지 않은 토큰", {
      path: req.originalUrl,
      method: req.method,
      error,
    });

    return res.status(401).json({
      ok: false,
      message: "유효하지 않은 토큰.",
    });
  }
}

module.exports = { authenticateToken };
