CREATE TABLE "user_audit_logs" (
    "id" TEXT NOT NULL,
    "actor_user_id" TEXT,
    "target_user_id" TEXT,
    "action" TEXT NOT NULL,
    "before_data" JSONB,
    "after_data" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_audit_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "user_audit_logs_actor_user_id_idx" ON "user_audit_logs"("actor_user_id");
CREATE INDEX "user_audit_logs_target_user_id_idx" ON "user_audit_logs"("target_user_id");
CREATE INDEX "user_audit_logs_action_idx" ON "user_audit_logs"("action");
CREATE INDEX "user_audit_logs_created_at_idx" ON "user_audit_logs"("created_at");

ALTER TABLE "user_audit_logs"
ADD CONSTRAINT "user_audit_logs_actor_user_id_fkey"
FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "user_audit_logs"
ADD CONSTRAINT "user_audit_logs_target_user_id_fkey"
FOREIGN KEY ("target_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
