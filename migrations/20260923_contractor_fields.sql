ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS contractor_name text;

COMMENT ON COLUMN projects.contractor_name IS 'Nhà thầu thực hiện công trình';
