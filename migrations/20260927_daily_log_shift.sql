-- ============================================================================
-- 20260927 — Nhật ký nhiều ca/ngày (quyết định 26/09/2026)
-- Trước đây shift để trống (NULL) nên ràng buộc UNIQUE(project_id, log_date, shift)
-- không có tác dụng → tạo được nhiều nhật ký trùng ngày mà không phân biệt ca.
-- Quy ước mã ca: CA1 = Ca 1 (sáng), CA2 = Ca 2 (chiều), CA3 = Ca 3 (tối/đêm).
-- Nhật ký cũ chưa có ca: gán CA1, CA2, CA3... theo thứ tự tạo trong cùng ngày.
-- ============================================================================
BEGIN;

-- Đổi mã ca cũ (dữ liệu mẫu dùng MORNING/AFTERNOON/NIGHT) sang mã thống nhất, nếu không trùng.
UPDATE daily_logs d SET shift = m.new_code
FROM (VALUES ('MORNING','CA1'),('SANG','CA1'),('AFTERNOON','CA2'),('CHIEU','CA2'),
             ('EVENING','CA3'),('NIGHT','CA3'),('TOI','CA3'),('DEM','CA3')) AS m(old_code, new_code)
WHERE upper(btrim(d.shift)) = m.old_code
  AND NOT EXISTS (SELECT 1 FROM daily_logs x WHERE x.project_id = d.project_id AND x.log_date = d.log_date AND x.shift = m.new_code);

DO $$
DECLARE r record; n int;
BEGIN
  FOR r IN SELECT id, project_id, log_date FROM daily_logs
           WHERE shift IS NULL OR btrim(shift) = '' ORDER BY project_id, log_date, created_at, id
  LOOP
    n := 1;
    WHILE EXISTS (SELECT 1 FROM daily_logs WHERE project_id = r.project_id AND log_date = r.log_date AND shift = 'CA' || n) LOOP
      n := n + 1;
    END LOOP;
    UPDATE daily_logs SET shift = 'CA' || n WHERE id = r.id;
    IF n > 1 THEN RAISE NOTICE 'Nhật ký % ngày % được gán ca CA%', r.id, r.log_date, n; END IF;
  END LOOP;
END $$;

ALTER TABLE daily_logs ALTER COLUMN shift SET DEFAULT 'CA1';
ALTER TABLE daily_logs ALTER COLUMN shift SET NOT NULL;

COMMIT;
