// 로그인 API 주소를 만들고, 그 요청을 로그인 처리 함수로 넘겨준다. 

const express = require("express");

// 실제 로그인 요청을 처리하는 login 함수 가져오기
const { login } = require("./auth.controller");

// 인증(Auth)관련 API 경로를 등록하기 위한 라우터 생성
const router = express.Router();

// /auth/login 요청이 들어오면 login 컨트롤러로 전달
router.post("/auth/login", login);

// 생성한 auth 라우터를 외부에서 사용할 수 있도록 내보내기 
module.exports = router;
