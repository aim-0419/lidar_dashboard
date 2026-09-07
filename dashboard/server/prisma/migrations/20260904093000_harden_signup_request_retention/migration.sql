-- Terminal signup requests keep their audit state, not applicant PII.
UPDATE "signup_requests"
SET "expires_at" = "created_at" + INTERVAL '30 days'
WHERE "expires_at" IS NULL;

ALTER TABLE "signup_requests"
ALTER COLUMN "user_id" DROP NOT NULL,
ALTER COLUMN "name" DROP NOT NULL,
ALTER COLUMN "expires_at" SET NOT NULL;
