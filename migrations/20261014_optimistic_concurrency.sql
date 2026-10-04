BEGIN;

ALTER TABLE projects ADD COLUMN IF NOT EXISTS row_version integer NOT NULL DEFAULT 1;
ALTER TABLE daily_logs ADD COLUMN IF NOT EXISTS row_version integer NOT NULL DEFAULT 1;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS row_version integer NOT NULL DEFAULT 1;
ALTER TABLE issues ADD COLUMN IF NOT EXISTS row_version integer NOT NULL DEFAULT 1;

ALTER TABLE projects DROP CONSTRAINT IF EXISTS projects_row_version_positive;
ALTER TABLE projects ADD CONSTRAINT projects_row_version_positive CHECK (row_version > 0);
ALTER TABLE daily_logs DROP CONSTRAINT IF EXISTS daily_logs_row_version_positive;
ALTER TABLE daily_logs ADD CONSTRAINT daily_logs_row_version_positive CHECK (row_version > 0);
ALTER TABLE documents DROP CONSTRAINT IF EXISTS documents_row_version_positive;
ALTER TABLE documents ADD CONSTRAINT documents_row_version_positive CHECK (row_version > 0);
ALTER TABLE issues DROP CONSTRAINT IF EXISTS issues_row_version_positive;
ALTER TABLE issues ADD CONSTRAINT issues_row_version_positive CHECK (row_version > 0);

COMMIT;
