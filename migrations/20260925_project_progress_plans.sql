CREATE TABLE IF NOT EXISTS project_progress_plans (
  id uuid PRIMARY KEY,
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  plan_name varchar(255) NOT NULL,
  report_date date NOT NULL DEFAULT CURRENT_DATE,
  planned_percent numeric(5,2) NOT NULL DEFAULT 0 CHECK (planned_percent >= 0 AND planned_percent <= 100),
  actual_percent numeric(5,2) NOT NULL DEFAULT 0 CHECK (actual_percent >= 0 AND actual_percent <= 100),
  original_end_date date,
  revised_end_date date,
  is_extension boolean NOT NULL DEFAULT false,
  extension_reason text,
  is_current boolean NOT NULL DEFAULT true,
  attachment_name text,
  attachment_type text,
  attachment_size integer,
  attachment_data text,
  created_by uuid REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_project_progress_plans_project_date
  ON project_progress_plans(project_id, report_date DESC, created_at DESC);
