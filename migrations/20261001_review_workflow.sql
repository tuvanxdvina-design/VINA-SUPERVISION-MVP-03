-- ============================================================================
-- 20261001 — Quy trình duyệt có ý kiến + tài khoản mới phải đổi mật khẩu lần đầu
--   * review_notes: lịch sử Gửi duyệt / Duyệt / Yêu cầu chỉnh sửa, bổ sung / Khóa kèm ý kiến
--     cho báo cáo, hồ sơ (documents) và nhật ký (daily_logs). Người lập xem được lý do bị trả lại.
--   * users.must_change_password: tài khoản do Admin/Giám đốc tạo hoặc đặt lại mật khẩu
--     phải tự đổi mật khẩu ở lần đăng nhập đầu tiên.
-- ============================================================================
BEGIN;

CREATE TABLE IF NOT EXISTS review_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type varchar(30) NOT NULL CHECK (entity_type IN ('documents', 'daily_logs')),
  entity_id uuid NOT NULL,
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  action varchar(20) NOT NULL CHECK (action IN ('SUBMIT', 'APPROVE', 'REJECT', 'LOCK', 'REOPEN')),
  comment text,
  actor_id uuid REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_review_notes_entity ON review_notes(entity_type, entity_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_documents_status ON documents(status);
CREATE INDEX IF NOT EXISTS idx_daily_logs_status ON daily_logs(status);

ALTER TABLE users ADD COLUMN IF NOT EXISTS must_change_password boolean NOT NULL DEFAULT false;

COMMIT;
