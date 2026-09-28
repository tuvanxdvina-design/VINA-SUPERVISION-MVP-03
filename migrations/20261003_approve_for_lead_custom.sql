-- ============================================================================
-- 20261003 — Quyền "Duyệt" cho TVGS trưởng đang dùng quyền TÙY CHỈNH
--   Quyền tùy chỉnh lưu trước bản 2026-10-02 chưa có ô "Duyệt" (chưa tồn tại lúc lưu), nên TVGS trưởng
--   đang bị coi như GS viên (không có mục Việc cần duyệt). Bổ sung APPROVE cho các phân công:
--   đang hoạt động + quyền tùy chỉnh + chức danh tại công trình là TVGS trưởng / Trưởng TVGS /
--   Tư vấn giám sát trưởng / Giám sát trưởng (không tính "Phó ..."). Không đụng các quyền khác.
-- ============================================================================
BEGIN;

WITH t AS (
  SELECT pma.project_member_id,
         lower(normalize(COALESCE(NULLIF((
           SELECT pp.assignment_title FROM project_personnel pp
           WHERE pp.project_id = pm.project_id AND pp.user_id = pm.user_id AND pp.status = 'ACTIVE'
           ORDER BY pp.updated_at DESC NULLS LAST LIMIT 1), ''), pm.assignment_title, ''), NFC)) AS title
  FROM project_member_access pma
  JOIN project_members pm ON pm.id = pma.project_member_id
  WHERE pm.status = 'ACTIVE'
    AND pma.access_permissions IS NOT NULL
    AND NOT (pma.access_permissions ? 'APPROVE')
), fixed AS (
  UPDATE project_member_access a
  SET access_permissions = a.access_permissions || '["APPROVE"]'::jsonb, updated_at = NOW()
  FROM t
  WHERE a.project_member_id = t.project_member_id
    AND t.title LIKE '%trưởng%'
    AND (t.title LIKE '%tvgs%' OR t.title LIKE '%giám sát%')
    AND t.title NOT LIKE '%phó%'
  RETURNING a.project_member_id
)
SELECT COUNT(*) AS so_phan_cong_duoc_cap_quyen_duyet FROM fixed;

COMMIT;
