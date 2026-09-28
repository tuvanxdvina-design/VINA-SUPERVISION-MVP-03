ALTER TABLE project_members
  ADD COLUMN IF NOT EXISTS assignment_title text;

COMMENT ON COLUMN project_members.assignment_title IS 'Chức danh của người dùng tại riêng công trình này';
