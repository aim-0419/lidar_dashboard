ALTER TABLE "signup_requests"
ADD COLUMN "expires_at" TIMESTAMP(3),
ADD COLUMN "anonymized_at" TIMESTAMP(3);

ALTER TABLE "signup_requests"
ALTER COLUMN "email" DROP NOT NULL,
ALTER COLUMN "phone_number" DROP NOT NULL;

UPDATE "signup_requests"
SET "expires_at" = "created_at" + INTERVAL '30 days'
WHERE "status" = 'PENDING';

CREATE INDEX "signup_requests_expires_at_idx" ON "signup_requests"("expires_at");
CREATE INDEX "signup_requests_anonymized_at_idx" ON "signup_requests"("anonymized_at");
