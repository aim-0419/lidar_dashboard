-- Keep completed application history, but allow the applicant to submit again.
DROP INDEX IF EXISTS "signup_requests_user_id_key";
DROP INDEX IF EXISTS "signup_requests_email_key";
DROP INDEX IF EXISTS "signup_requests_phone_number_key";

-- A single identity can have only one application awaiting review at a time.
CREATE UNIQUE INDEX "signup_requests_pending_user_id_key"
ON "signup_requests"("user_id")
WHERE "status" = 'PENDING';

CREATE UNIQUE INDEX "signup_requests_pending_email_key"
ON "signup_requests"("email")
WHERE "status" = 'PENDING';

CREATE UNIQUE INDEX "signup_requests_pending_phone_number_key"
ON "signup_requests"("phone_number")
WHERE "status" = 'PENDING';
