-- CreateTable
CREATE TABLE "signup_requests" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone_number" TEXT NOT NULL,
    "requested_role" TEXT NOT NULL DEFAULT 'MANAGER',
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "reviewed_by_user_id" TEXT,
    "reviewed_at" TIMESTAMP(3),
    "reject_reason" TEXT,
    "cancelled_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "signup_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "signup_requests_user_id_idx" ON "signup_requests"("user_id");

-- CreateIndex
CREATE INDEX "signup_requests_status_idx" ON "signup_requests"("status");

-- CreateIndex
CREATE INDEX "signup_requests_created_at_idx" ON "signup_requests"("created_at");

-- CreateIndex
CREATE INDEX "signup_requests_reviewed_by_user_id_idx" ON "signup_requests"("reviewed_by_user_id");

-- AddForeignKey
ALTER TABLE "signup_requests" ADD CONSTRAINT "signup_requests_reviewed_by_user_id_fkey" FOREIGN KEY ("reviewed_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
