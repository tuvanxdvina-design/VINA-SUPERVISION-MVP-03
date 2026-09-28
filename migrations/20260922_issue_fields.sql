ALTER TABLE issues ADD COLUMN IF NOT EXISTS issue_code varchar(80);
ALTER TABLE issues ADD COLUMN IF NOT EXISTS due_date date;
CREATE UNIQUE INDEX IF NOT EXISTS idx_issues_project_code
  ON issues(project_id, issue_code) WHERE issue_code IS NOT NULL;
