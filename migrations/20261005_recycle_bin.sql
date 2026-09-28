-- ============================================================================
-- 20261005 — Thùng rác (xóa có lý do, khôi phục được)
--   Xóa nhật ký / hồ sơ – báo cáo / văn bản chất lượng / bảng tiến độ: bản ghi và toàn bộ dữ liệu con
--   (ảnh, tệp, hạng mục, số liệu thực tế) được lưu nguyên vẹn vào deleted_records (JSONB) rồi mới gỡ khỏi
--   bảng chính. Khôi phục = ghi lại đúng như cũ. "Xóa vĩnh viễn" (chỉ Admin) xóa nội dung, giữ dòng vết
--   (ai xóa, lúc nào, lý do) để truy vết.
-- ============================================================================
BEGIN;

CREATE TABLE IF NOT EXISTS deleted_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type varchar(40) NOT NULL CHECK (entity_type IN ('daily_logs', 'documents', 'issues', 'project_progress_plans')),
  entity_id uuid NOT NULL,
  project_id uuid REFERENCES projects(id) ON DELETE CASCADE,
  title text,
  snapshot jsonb,
  reason text NOT NULL,
  deleted_by uuid REFERENCES users(id),
  deleted_at timestamptz NOT NULL DEFAULT NOW(),
  restored_by uuid REFERENCES users(id),
  restored_at timestamptz,
  purged_by uuid REFERENCES users(id),
  purged_at timestamptz
);
CREATE INDEX IF NOT EXISTS idx_deleted_records_project ON deleted_records(project_id, deleted_at DESC);
CREATE INDEX IF NOT EXISTS idx_deleted_records_entity ON deleted_records(entity_type, entity_id);

COMMIT;
