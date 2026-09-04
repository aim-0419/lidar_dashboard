-- Keep manager as the safe default for every future user creation path.
ALTER TABLE "users" ALTER COLUMN "role" SET DEFAULT 'MANAGER';

-- Approved requests no longer need to retain a second password hash.
ALTER TABLE "signup_requests" ALTER COLUMN "password_hash" DROP NOT NULL;
UPDATE "signup_requests"
SET "password_hash" = NULL
WHERE "status" = 'APPROVED';

-- Enforce duplicate prevention even when requests arrive concurrently.
CREATE UNIQUE INDEX "signup_requests_user_id_key" ON "signup_requests"("user_id");
CREATE UNIQUE INDEX "signup_requests_email_key" ON "signup_requests"("email");
CREATE UNIQUE INDEX "signup_requests_phone_number_key" ON "signup_requests"("phone_number");
