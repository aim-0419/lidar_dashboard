// EmailVerification 테이블은 가입 신청 인증코드(purpose=SIGNUP)와 비밀번호 재설정
// 인증코드(purpose=PASSWORD_RESET)가 함께 쓴다. 이 정리 로직은 두 도메인(signup-requests, auth)이
// 공통으로 호출해야 하므로, 어느 한쪽 도메인에 종속되지 않는 위치에 둔다.

const EMAIL_VERIFIED_WINDOW_MINUTES = 30;

// 인증에 쓰이지 않고 방치된 이메일 인증 레코드를 정리한다. purpose와 무관하게 동작한다.
// - 미사용(consumedAt 없음) 코드: 코드 만료 시각(expiresAt)이 지나면 삭제
// - 인증은 했지만(consumedAt 있음) 다음 단계(가입 신청 제출/비밀번호 변경)까지 이어지지 않은
//   레코드: 인증 유효 창(EMAIL_VERIFIED_WINDOW_MINUTES)이 지나면 삭제 — 그 전까지는 호출부가
//   아직 쓸 수 있으므로 보존
function cleanupExpiredEmailVerifications(client, now = new Date()) {
  const verifiedWindowCutoff = new Date(now.getTime() - EMAIL_VERIFIED_WINDOW_MINUTES * 60 * 1000);

  return client.emailVerification.deleteMany({
    where: {
      OR: [
        { consumedAt: null, expiresAt: { lte: now } },
        { consumedAt: { not: null, lte: verifiedWindowCutoff } },
      ],
    },
  });
}

module.exports = {
  EMAIL_VERIFIED_WINDOW_MINUTES,
  cleanupExpiredEmailVerifications,
};
