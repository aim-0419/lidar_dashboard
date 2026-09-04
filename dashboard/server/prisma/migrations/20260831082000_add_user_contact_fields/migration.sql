-- AlterTable
ALTER TABLE "users" ADD COLUMN "email" TEXT,
ADD COLUMN "phone_number" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_phone_number_key" ON "users"("phone_number");