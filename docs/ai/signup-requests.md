# 가입 신청 운영 정책

## 역할과 상태

- 가입 신청은 로그인하지 않은 사용자도 제출할 수 있으며, 신청 권한은 항상 `MANAGER`다.
- 가입 신청 목록 조회, 승인, 반려는 `SUPER_ADMIN`만 수행할 수 있다.
- 신청 상태는 `PENDING`에서 `APPROVED`, `REJECTED`, `CANCELLED`, `EXPIRED` 중 하나로만 변경한다.
- 처리 완료된 신청은 다시 승인하거나 반려할 수 없다.
- `PENDING` 신청은 생성 시점부터 30일 후 자동으로 `EXPIRED` 처리한다.

## 중복 방지와 보안

- `users.user_id`, `email`, `phone_number`에 이미 존재하는 값은 가입 신청에 사용할 수 없다.
- `signup_requests`에서는 `PENDING` 상태인 신청에만 동일한 `user_id`, `email`, `phone_number`를 허용하지 않는다.
- `REJECTED`, `CANCELLED` 신청은 이력으로 보관하고 같은 정보로 재신청할 수 있다.
- 가입 신청 API는 IP 기준 10분 동안 최대 5회 요청할 수 있다.
- 비밀번호는 bcrypt 해시로만 저장한다.
- 승인 시 해시는 `users.password_hash`로 복사하고 `signup_requests.password_hash`에서는 제거한다.
- 승인·반려·취소 처리 시 신청 ID를 `event_logs`에 감사 로그로 남긴다.
- `REJECTED`, `CANCELLED`, `EXPIRED` 상태 신청의 이름·이메일·전화번호·반려 사유는 완료 후 90일이 지나면 익명화한다.

## 후속 결정 항목

- 이메일 및 전화번호 소유 확인 절차
- 가입 신청 취소 시 신청 번호와 신청 당시의 사용자 ID·비밀번호를 함께 확인한다.
- 가입 신청 목록의 페이지네이션 정책
