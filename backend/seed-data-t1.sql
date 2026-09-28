-- Seed T1 test data - simplified version

-- Add more users (simple INSERT, no UNION)
INSERT INTO users (username, email, password_hash, full_name, role_id, phone, is_active)
SELECT 'khanh', 'khanh@vina.vn', 'demo_hash', 'Khánh', id, '0987654321', true
FROM roles WHERE name = 'ENGINEER' AND NOT EXISTS (SELECT 1 FROM users WHERE username = 'khanh');

INSERT INTO users (username, email, password_hash, full_name, role_id, phone, is_active)
SELECT 'linh', 'linh@vina.vn', 'demo_hash', 'Linh', id, '0987654322', true
FROM roles WHERE name = 'ENGINEER' AND NOT EXISTS (SELECT 1 FROM users WHERE username = 'linh');

INSERT INTO users (username, email, password_hash, full_name, role_id, phone, is_active)
SELECT 'nam', 'nam@vina.vn', 'demo_hash', 'Nam', id, '0987654323', true
FROM roles WHERE name = 'TVGS_LEAD' AND NOT EXISTS (SELECT 1 FROM users WHERE username = 'nam');

-- Add daily logs for project 001
INSERT INTO daily_logs (project_id, log_date, shift, work_summary, weather, worker_count, machine_count, progress, status, created_by, created_at)
SELECT p.id, '2026-09-18'::date, 'MORNING', 'Thi công móng', 'Nắng', 15, 3, 25.0, 'APPROVED', u.id, NOW()
FROM projects p, users u WHERE p.contract_no = '001' AND u.username = 'hung';

INSERT INTO daily_logs (project_id, log_date, shift, work_summary, weather, worker_count, machine_count, progress, status, created_by, created_at)
SELECT p.id, '2026-09-19'::date, 'MORNING', 'Thi công cột', 'Nắng', 18, 4, 35.0, 'SUBMITTED', u.id, NOW()
FROM projects p, users u WHERE p.contract_no = '001' AND u.username = 'son';

INSERT INTO daily_logs (project_id, log_date, shift, work_summary, weather, worker_count, machine_count, progress, status, created_by, created_at)
SELECT p.id, '2026-09-20'::date, 'MORNING', 'Thi công sàn', 'Mây', 20, 5, 45.0, 'DRAFT', u.id, NOW()
FROM projects p, users u WHERE p.contract_no = '001' AND u.username = 'tuan';

-- Add documents for project 001 (with different auto codes to avoid duplicates)
INSERT INTO documents (project_id, type, auto_code, name, status, version, created_by, created_at)
SELECT p.id, 'BB', 'BB-001-002', 'Biên bản kiểm tra chất lượng', 'APPROVED', 1, u.id, NOW()
FROM projects p, users u WHERE p.contract_no = '001' AND u.username = 'hung' 
AND NOT EXISTS (SELECT 1 FROM documents WHERE auto_code = 'BB-001-002');

INSERT INTO documents (project_id, type, auto_code, name, status, version, created_by, created_at)
SELECT p.id, 'TKT', 'TKT-001-002', 'Tiêu chuẩn kỹ thuật cập nhật', 'SUBMITTED', 1, u.id, NOW()
FROM projects p, users u WHERE p.contract_no = '001' AND u.username = 'son'
AND NOT EXISTS (SELECT 1 FROM documents WHERE auto_code = 'TKT-001-002');

INSERT INTO documents (project_id, type, auto_code, name, status, version, created_by, created_at)
SELECT p.id, 'BC', 'BC-001-002', 'Báo cáo tiến độ tháng 9', 'DRAFT', 1, u.id, NOW()
FROM projects p, users u WHERE p.contract_no = '001' AND u.username = 'tuan'
AND NOT EXISTS (SELECT 1 FROM documents WHERE auto_code = 'BC-001-002');

-- Add issues
INSERT INTO issues (project_id, title, description, severity, status, created_by, created_at)
SELECT p.id, 'Thiếu vật liệu Xi măng', 'Xi măng chưa đủ cho khối lượng dự kiến', 'HIGH', 'OPEN', u.id, NOW()
FROM projects p, users u WHERE p.contract_no = '001' AND u.username = 'son';

INSERT INTO issues (project_id, title, description, severity, status, created_by, created_at)
SELECT p.id, 'Kỹ thuật thi công không đúng quy cách', 'Cần sửa lại phương pháp rèn thép', 'MEDIUM', 'OPEN', u.id, NOW()
FROM projects p, users u WHERE p.contract_no = '002' AND u.username = 'tuan';

-- Add project members for project 003 (new project, no conflicts)
INSERT INTO project_members (project_id, user_id, role_id, start_date, status, assigned_by, created_at)
SELECT p.id, u.id, r.id, CURRENT_DATE, 'ACTIVE', (SELECT id FROM users WHERE username = 'duong'), NOW()
FROM projects p, users u, roles r
WHERE p.contract_no = '003' AND u.username = 'khanh' AND r.name = 'ENGINEER'
AND NOT EXISTS (SELECT 1 FROM project_members WHERE project_id = p.id AND user_id = u.id);

INSERT INTO project_members (project_id, user_id, role_id, start_date, status, assigned_by, created_at)
SELECT p.id, u.id, r.id, CURRENT_DATE, 'ACTIVE', (SELECT id FROM users WHERE username = 'duong'), NOW()
FROM projects p, users u, roles r
WHERE p.contract_no = '003' AND u.username = 'linh' AND r.name = 'ENGINEER'
AND NOT EXISTS (SELECT 1 FROM project_members WHERE project_id = p.id AND user_id = u.id);

INSERT INTO project_members (project_id, user_id, role_id, start_date, status, assigned_by, created_at)
SELECT p.id, u.id, r.id, CURRENT_DATE, 'ACTIVE', (SELECT id FROM users WHERE username = 'duong'), NOW()
FROM projects p, users u, roles r
WHERE p.contract_no = '003' AND u.username = 'nam' AND r.name = 'TVGS_LEAD'
AND NOT EXISTS (SELECT 1 FROM project_members WHERE project_id = p.id AND user_id = u.id);
