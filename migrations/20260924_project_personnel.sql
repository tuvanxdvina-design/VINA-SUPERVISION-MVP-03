CREATE TABLE IF NOT EXISTS project_personnel (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  full_name varchar(255) NOT NULL,
  assignment_title varchar(120) NOT NULL,
  certificate text,
  status varchar(20) NOT NULL DEFAULT 'ACTIVE',
  created_by uuid REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW(),
  UNIQUE(project_id, full_name)
);

CREATE INDEX IF NOT EXISTS idx_project_personnel_project_id ON project_personnel(project_id);
