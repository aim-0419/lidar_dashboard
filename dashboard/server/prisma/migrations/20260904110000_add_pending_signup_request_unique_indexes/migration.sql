-- 대기 중인 가입 신청에 대해서만 중복을 DB 수준에서 차단한다.
-- 반려 또는 만료된 신청은 새 신청을 만들 수 있도록 제약 대상에서 제외한다.
CREATE UNIQUE INDEX "signup_requests_pending_user_id_key"
ON "signup_requests" ("user_id")
WHERE "status" = 'PENDING' AND "user_id" IS NOT NULL;

CREATE UNIQUE INDEX "signup_requests_pending_email_key"
ON "signup_requests" ("email")
WHERE "status" = 'PENDING' AND "email" IS NOT NULL;

CREATE UNIQUE INDEX "signup_requests_pending_phone_number_key"
ON "signup_requests" ("phone_number")
WHERE "status" = 'PENDING' AND "phone_number" IS NOT NULL;
