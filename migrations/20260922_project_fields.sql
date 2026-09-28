BEGIN;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS project_code varchar(100);
ALTER TABLE projects ADD COLUMN IF NOT EXISTS province varchar(255);
ALTER TABLE projects ADD COLUMN IF NOT EXISTS address varchar(255);
ALTER TABLE projects ADD COLUMN IF NOT EXISTS contract_date date;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS contract_content text;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS progress numeric(5,2) DEFAULT 0;
UPDATE projects SET
  project_code = COALESCE(project_code, contract_no),
  province = COALESCE(province, location),
  address = COALESCE(address, location),
  contract_date = COALESCE(contract_date, start_date),
  contract_content = COALESCE(contract_content, description),
  progress = COALESCE(progress, 0);
COMMIT;
