-- ============================================================================
-- 20260928 — Bảng tiến độ có cấu trúc (đọc được, so sánh được với thực tế)
-- - Mỗi "bảng tiến độ" (project_progress_plans) là một phiên bản: cơ sở, điều chỉnh, gia hạn.
-- - Hạng mục của bảng tiến độ (project_schedule_items): tên, ngày bắt đầu/kết thúc, trọng số.
-- - Thực tế theo hạng mục (project_schedule_actuals): % hoàn thành tại một ngày báo cáo.
-- - Tệp gốc (PDF/ảnh/Excel) vẫn lưu làm căn cứ, nhưng số liệu so sánh lấy từ bảng hạng mục.
-- ============================================================================
BEGIN;

ALTER TABLE project_progress_plans
  ADD COLUMN IF NOT EXISTS weight_basis varchar(20) NOT NULL DEFAULT 'DURATION',
  ADD COLUMN IF NOT EXISTS start_date date,
  ADD COLUMN IF NOT EXISTS note text,
  ADD COLUMN IF NOT EXISTS updated_by uuid REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT NOW();

ALTER TABLE project_progress_plans ALTER COLUMN id SET DEFAULT gen_random_uuid();

CREATE TABLE IF NOT EXISTS project_schedule_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id uuid NOT NULL REFERENCES project_progress_plans(id) ON DELETE CASCADE,
  seq integer NOT NULL,
  code varchar(40),
  name varchar(500) NOT NULL,
  unit varchar(40),
  quantity numeric(18,3),
  weight numeric(20,4),
  start_date date NOT NULL,
  end_date date NOT NULL,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  CHECK (end_date >= start_date),
  CHECK (weight IS NULL OR weight >= 0)
);
CREATE INDEX IF NOT EXISTS idx_schedule_items_plan ON project_schedule_items(plan_id, seq);

CREATE TABLE IF NOT EXISTS project_schedule_actuals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id uuid NOT NULL REFERENCES project_schedule_items(id) ON DELETE CASCADE,
  report_date date NOT NULL,
  actual_percent numeric(5,2) NOT NULL CHECK (actual_percent >= 0 AND actual_percent <= 100),
  note text,
  created_by uuid REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT NOW(),
  UNIQUE (item_id, report_date)
);
CREATE INDEX IF NOT EXISTS idx_schedule_actuals_item ON project_schedule_actuals(item_id, report_date DESC);

COMMIT;
