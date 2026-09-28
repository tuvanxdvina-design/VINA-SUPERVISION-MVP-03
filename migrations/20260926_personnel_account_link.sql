-- ============================================================================
-- 20260926 — Hợp nhất "Nhân sự công trình" với "Tài khoản được phân công"
-- Mục tiêu:
--   1) Mỗi người chỉ xuất hiện MỘT lần trong danh sách nhân sự công trình.
--   2) Nhân sự có tài khoản được liên kết bằng user_id (không ghép theo tên).
--   3) Chức danh (công việc được giao) lấy từ một nguồn thống nhất.
-- Chạy được nhiều lần (idempotent). Nên sao lưu trước khi chạy.
-- ============================================================================
BEGIN;

-- Bảng quyền chi tiết (trước đây được tạo ngầm khi chạy API) — đưa vào migration.
CREATE TABLE IF NOT EXISTS project_member_access (
  project_member_id uuid PRIMARY KEY REFERENCES project_members(id) ON DELETE CASCADE,
  access_permissions jsonb NOT NULL DEFAULT '["VIEW"]'::jsonb,
  work_scope text,
  updated_at timestamptz NOT NULL DEFAULT NOW()
);
-- NULL = dùng quyền mặc định theo vai trò; có giá trị = Admin/Giám đốc đã tùy chỉnh.
ALTER TABLE project_member_access ALTER COLUMN access_permissions DROP NOT NULL;
ALTER TABLE project_member_access ALTER COLUMN access_permissions DROP DEFAULT;

-- Cột mà API vấn đề/chất lượng đang ghi nhưng chưa có trong schema/migration.
ALTER TABLE issues ADD COLUMN IF NOT EXISTS source_type varchar(80);

-- 1. Liên kết nhân sự ↔ tài khoản
ALTER TABLE project_personnel
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES users(id) ON DELETE SET NULL;

-- 2. Chuẩn hóa họ tên: Unicode NFC, bỏ khoảng trắng thừa.
--    (Nguyên nhân chính gây trùng: cùng một tên nhưng gõ dựng sẵn/tổ hợp khác nhau
--     hoặc thừa khoảng trắng → hệ thống coi là 2 người.)
ALTER TABLE project_personnel DROP CONSTRAINT IF EXISTS project_personnel_project_id_full_name_key;

UPDATE project_personnel
SET full_name = regexp_replace(btrim(normalize(full_name, NFC)), '\s+', ' ', 'g')
WHERE full_name IS DISTINCT FROM regexp_replace(btrim(normalize(full_name, NFC)), '\s+', ' ', 'g');

UPDATE users
SET full_name = regexp_replace(btrim(normalize(full_name, NFC)), '\s+', ' ', 'g')
WHERE full_name IS DISTINCT FROM regexp_replace(btrim(normalize(full_name, NFC)), '\s+', ' ', 'g');

-- 3a. Thông báo các nhóm trùng có chức danh khác nhau để Admin rà soát lại sau khi gộp.
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT p.name AS project_name, lower(pp.full_name) AS k,
           string_agg(pp.assignment_title || ' (cập nhật ' || to_char(pp.updated_at, 'YYYY-MM-DD HH24:MI') || ')', ' | ' ORDER BY pp.updated_at DESC) AS titles
    FROM project_personnel pp JOIN projects p ON p.id = pp.project_id
    WHERE pp.status = 'ACTIVE'
    GROUP BY p.name, pp.project_id, lower(pp.full_name)
    HAVING COUNT(*) > 1 AND COUNT(DISTINCT pp.assignment_title) > 1
  LOOP
    RAISE NOTICE 'GỘP NHÂN SỰ TRÙNG [%] %: giữ chức danh mới nhất → %', r.project_name, r.k, r.titles;
  END LOOP;
END $$;

-- 3. Gộp các dòng nhân sự trùng tên (không phân biệt hoa/thường) trong cùng công trình.
--    Giữ dòng cập nhật gần nhất, bổ sung chứng chỉ còn thiếu, các dòng còn lại chuyển INACTIVE.
WITH ranked AS (
  SELECT id, project_id, lower(full_name) AS k, certificate,
         ROW_NUMBER() OVER (PARTITION BY project_id, lower(full_name) ORDER BY updated_at DESC, created_at DESC) AS rn
  FROM project_personnel WHERE status = 'ACTIVE'
), keeper AS (
  SELECT r.id, r.project_id, r.k,
         (SELECT string_agg(DISTINCT x.certificate, '; ') FROM ranked x
           WHERE x.project_id = r.project_id AND x.k = r.k AND x.certificate IS NOT NULL AND x.certificate <> '') AS certs
  FROM ranked r WHERE r.rn = 1
)
UPDATE project_personnel p SET certificate = COALESCE(NULLIF(p.certificate, ''), k.certs), updated_at = NOW()
FROM keeper k WHERE p.id = k.id AND (p.certificate IS NULL OR p.certificate = '') AND k.certs IS NOT NULL;

WITH ranked AS (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY project_id, lower(full_name) ORDER BY updated_at DESC, created_at DESC) AS rn
  FROM project_personnel WHERE status = 'ACTIVE'
)
UPDATE project_personnel p SET status = 'INACTIVE', updated_at = NOW()
FROM ranked r WHERE p.id = r.id AND r.rn > 1;

-- 4. Tự liên kết: nhân sự chưa liên kết mà tên trùng DUY NHẤT một tài khoản
--    đang được phân công vào chính công trình đó.
WITH candidates AS (
  SELECT pp.id AS personnel_id, pm.user_id,
         COUNT(*) OVER (PARTITION BY pp.id) AS n_users
  FROM project_personnel pp
  JOIN project_members pm ON pm.project_id = pp.project_id AND pm.status = 'ACTIVE'
  JOIN users u ON u.id = pm.user_id
  WHERE pp.status = 'ACTIVE' AND pp.user_id IS NULL
    AND lower(u.full_name) = lower(pp.full_name)
)
UPDATE project_personnel pp SET user_id = c.user_id, updated_at = NOW()
FROM candidates c
WHERE pp.id = c.personnel_id AND c.n_users = 1
  AND NOT EXISTS (SELECT 1 FROM project_personnel x
                  WHERE x.project_id = pp.project_id AND x.user_id = c.user_id AND x.status = 'ACTIVE');

-- 5. Ràng buộc chống trùng từ nay về sau
CREATE UNIQUE INDEX IF NOT EXISTS uq_project_personnel_active_name
  ON project_personnel(project_id, lower(full_name)) WHERE status = 'ACTIVE';
CREATE UNIQUE INDEX IF NOT EXISTS uq_project_personnel_active_user
  ON project_personnel(project_id, user_id) WHERE status = 'ACTIVE' AND user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_project_personnel_user_id ON project_personnel(user_id);

-- 6. Đồng bộ chức danh: phân công tài khoản chưa có chức danh lấy theo nhân sự đã liên kết.
UPDATE project_members pm SET assignment_title = pp.assignment_title, updated_at = NOW()
FROM project_personnel pp
WHERE pp.project_id = pm.project_id AND pp.user_id = pm.user_id AND pp.status = 'ACTIVE'
  AND pm.status = 'ACTIVE' AND (pm.assignment_title IS NULL OR pm.assignment_title = '');

-- 7. Bỏ phân công tự sinh cho ADMIN/GIÁM ĐỐC khi họ tạo công trình.
--    Hai vai trò này đã có quyền trên mọi công trình nên dòng phân công này chỉ
--    làm họ hiện thành "nhân sự" của công trình (không có chức danh).
--    Chỉ áp dụng cho dòng: tự phân công hoặc dữ liệu mẫu (assigned_by = user_id/NULL), chưa có chức danh,
--    chưa liên kết nhân sự, chưa có quyền chi tiết.
UPDATE project_members pm
SET status = 'INACTIVE', end_date = CURRENT_DATE, updated_at = NOW()
FROM users u JOIN roles r ON r.id = u.role_id
WHERE u.id = pm.user_id AND r.name IN ('ADMIN', 'DIRECTOR')
  AND pm.status = 'ACTIVE' AND (pm.assigned_by = pm.user_id OR pm.assigned_by IS NULL)
  AND (pm.assignment_title IS NULL OR pm.assignment_title = '')
  AND NOT EXISTS (SELECT 1 FROM project_personnel pp WHERE pp.project_id = pm.project_id AND pp.user_id = pm.user_id AND pp.status = 'ACTIVE')
  AND NOT EXISTS (SELECT 1 FROM project_member_access a WHERE a.project_member_id = pm.id);

COMMIT;
