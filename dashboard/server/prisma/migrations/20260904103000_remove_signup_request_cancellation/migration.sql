-- 가입 신청 취소 기능 제거 전, 기존 취소 이력은 반려 처리 이력으로 정리한다.
UPDATE "signup_requests"
SET
  "status" = 'REJECTED',
  "reject_reason" = COALESCE("reject_reason", '기존 가입 신청 취소 이력'),
  "reviewed_at" = COALESCE("reviewed_at", "cancelled_at", "updated_at")
WHERE "status" = 'CANCELLED';

ALTER TABLE "signup_requests"
DROP COLUMN "cancelled_at";
