# 가입 신청 운영 정책

## 역할과 상태

- 가입 신청은 로그인하지 않은 사용자도 제출할 수 있으며, 신청 권한은 항상 `MANAGER`다.
- 가입 신청 목록 조회, 승인, 반려는 `SUPER_ADMIN`만 수행할 수 있다.
- 신청 상태는 `PENDING`에서 `APPROVED`, `REJECTED`, `CANCELLED` 중 하나로만 변경한다.
- 처리 완료된 신청은 다시 승인하거나 반려할 수 없다.

## 중복 방지와 보안

- `signup_requests.user_id`, `email`, `phone_number`는 각각 중복될 수 없는 DB 값이다.
- 신청 생성 전에는 `users`와 `signup_requests`를 모두 조회해 중복을 안내한다.
- 가입 신청 API는 IP 기준 10분 동안 최대 5회 요청할 수 있다.
- 비밀번호는 bcrypt 해시로만 저장한다.
- 승인 시 해시는 `users.password_hash`로 복사하고 `signup_requests.password_hash`에서는 제거한다.
- 승인·반려 처리 시 검토자와 신청 ID를 `event_logs`에 감사 로그로 남긴다.

## 후속 결정 항목

- 반려 또는 취소된 신청 데이터의 보관 기간
- 이메일 및 전화번호 소유 확인 절차
- 가입 신청 취소 시 신청자를 안전하게 식별하는 방식
- 가입 신청 목록의 페이지네이션 정책
