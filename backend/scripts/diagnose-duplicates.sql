-- Chẩn đoán dữ liệu trùng/không nhất quán. Chỉ ĐỌC, không sửa dữ liệu.
-- Lay container bang `docker compose ps -q postgres`, sau do chay psql trong container do.

\echo '== 1. Công trình trùng tên (khác ID) =='
SELECT lower(btrim(name)) AS ten, COUNT(*) AS so_ban_ghi, string_agg(project_code || ' / HĐ ' || contract_no || ' / ' || id::text, E'\n') AS chi_tiet
FROM projects GROUP BY 1 HAVING COUNT(*) > 1;

\echo '== 2. Nhân sự công trình trùng tên sau chuẩn hóa (NFC, khoảng trắng, hoa/thường) =='
SELECT p.name AS cong_trinh, lower(regexp_replace(btrim(normalize(pp.full_name, NFC)), '\s+', ' ', 'g')) AS ho_ten, COUNT(*)
FROM project_personnel pp JOIN projects p ON p.id = pp.project_id
WHERE pp.status = 'ACTIVE' GROUP BY 1, 2 HAVING COUNT(*) > 1;

\echo '== 3. Tên có ký tự tổ hợp (NFD) hoặc khoảng trắng thừa =='
SELECT 'users' AS bang, username AS ma, full_name FROM users
WHERE full_name <> regexp_replace(btrim(normalize(full_name, NFC)), '\s+', ' ', 'g')
UNION ALL
SELECT 'project_personnel', id::text, full_name FROM project_personnel
WHERE full_name <> regexp_replace(btrim(normalize(full_name, NFC)), '\s+', ' ', 'g');

\echo '== 4. Tài khoản trùng họ tên =='
SELECT lower(full_name) AS ho_ten, string_agg(username, ', ') FROM users GROUP BY 1 HAVING COUNT(*) > 1;

\echo '== 5. Một người vừa là "nhân sự" vừa là "tài khoản phân công" nhưng chưa liên kết (nguồn gây lặp) =='
SELECT p.name AS cong_trinh, pp.full_name, u.username, pm.assignment_title AS chuc_danh_tai_khoan, pp.assignment_title AS chuc_danh_nhan_su
FROM project_personnel pp
JOIN projects p ON p.id = pp.project_id
JOIN project_members pm ON pm.project_id = pp.project_id AND pm.status = 'ACTIVE'
JOIN users u ON u.id = pm.user_id
  AND lower(regexp_replace(btrim(normalize(u.full_name, NFC)), '\s+', ' ', 'g')) = lower(regexp_replace(btrim(normalize(pp.full_name, NFC)), '\s+', ' ', 'g'))
WHERE pp.status = 'ACTIVE' AND (pp.user_id IS NULL OR pp.user_id <> pm.user_id);

\echo '== 6. Phân công ADMIN/GIÁM ĐỐC tự sinh khi tạo công trình (không có chức danh) =='
SELECT p.name AS cong_trinh, u.username, r.name AS vai_tro
FROM project_members pm JOIN users u ON u.id = pm.user_id JOIN roles r ON r.id = u.role_id JOIN projects p ON p.id = pm.project_id
WHERE pm.status = 'ACTIVE' AND r.name IN ('ADMIN','DIRECTOR') AND (pm.assignment_title IS NULL OR pm.assignment_title = '');

\echo '== 7. Tài khoản còn mật khẩu demo (không đăng nhập được ở production) =='
SELECT username, full_name FROM users WHERE is_active AND (password_hash = 'demo_hash' OR password_hash LIKE '$2a$10$demo_hash_%');

\echo '== 8. Bất thường phân công và quyền chi tiết =='
SELECT 'Phân công ACTIVE trùng tài khoản/công trình' AS loai, COUNT(*) AS so_luong
FROM (SELECT project_id, user_id FROM project_members WHERE status = 'ACTIVE' GROUP BY 1, 2 HAVING COUNT(*) > 1) x
UNION ALL
SELECT 'Quyền tùy chỉnh không còn phân công', COUNT(*)
FROM project_member_access pma LEFT JOIN project_members pm ON pm.id = pma.project_member_id WHERE pm.id IS NULL
UNION ALL
SELECT 'Tài khoản khóa nhưng còn phân công ACTIVE', COUNT(*)
FROM project_members pm JOIN users u ON u.id = pm.user_id WHERE pm.status = 'ACTIVE' AND NOT u.is_active
UNION ALL
SELECT 'Phân công ACTIVE ngoài thời hạn', COUNT(*)
FROM project_members WHERE status = 'ACTIVE'
  AND ((start_date IS NOT NULL AND start_date > CURRENT_DATE) OR (end_date IS NOT NULL AND end_date < CURRENT_DATE));

\echo '== 9. Công trình chưa có tài khoản nghiệp vụ đang hoạt động =='
SELECT p.contract_no, p.name
FROM projects p
LEFT JOIN project_members pm ON pm.project_id = p.id AND pm.status = 'ACTIVE'
  AND (pm.start_date IS NULL OR pm.start_date <= CURRENT_DATE)
  AND (pm.end_date IS NULL OR pm.end_date >= CURRENT_DATE)
LEFT JOIN users u ON u.id = pm.user_id AND u.is_active
GROUP BY p.id, p.contract_no, p.name
HAVING COUNT(u.id) = 0
ORDER BY p.contract_no;

\echo '== 10. Tài khoản nghiệp vụ chưa được giao công trình =='
SELECT u.username, u.full_name, r.name AS vai_tro
FROM users u
JOIN roles r ON r.id = u.role_id
LEFT JOIN project_members pm ON pm.user_id = u.id AND pm.status = 'ACTIVE'
  AND (pm.start_date IS NULL OR pm.start_date <= CURRENT_DATE)
  AND (pm.end_date IS NULL OR pm.end_date >= CURRENT_DATE)
WHERE u.is_active AND r.name NOT IN ('ADMIN', 'DIRECTOR')
GROUP BY u.id, u.username, u.full_name, r.name
HAVING COUNT(pm.id) = 0
ORDER BY u.username;
