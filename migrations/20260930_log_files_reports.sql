-- ============================================================================
-- 20260930 — Tài liệu kèm theo nhật ký lưu trên máy chủ (trước đây chỉ nằm trong trình duyệt)
--            + chỉ mục phục vụ lập báo cáo ngày/tuần/tháng/hoàn thành
-- ============================================================================
BEGIN;

CREATE TABLE IF NOT EXISTS daily_log_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  daily_log_id uuid NOT NULL REFERENCES daily_logs(id) ON DELETE CASCADE,
  file_name varchar(255) NOT NULL,
  file_type varchar(120),
  file_size bigint NOT NULL,
  sha256 char(64) NOT NULL,
  content bytea NOT NULL,
  uploaded_by uuid REFERENCES users(id),
  uploaded_at timestamptz NOT NULL DEFAULT NOW(),
  UNIQUE (daily_log_id, sha256)
);
CREATE INDEX IF NOT EXISTS idx_daily_log_files_log ON daily_log_files(daily_log_id);
CREATE INDEX IF NOT EXISTS idx_daily_logs_project_date ON daily_logs(project_id, log_date);
CREATE INDEX IF NOT EXISTS idx_documents_project_group ON documents(project_id, doc_group);

COMMIT;
