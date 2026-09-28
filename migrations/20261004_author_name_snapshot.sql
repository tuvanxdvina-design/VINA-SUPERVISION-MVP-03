-- ============================================================================
-- 20261004 — Giữ tên người lập trên bản ghi cũ khi tài khoản được chuyển cho người khác
--   Tên người lập hiển thị = author_name (nếu có) hoặc họ tên hiện tại của tài khoản.
--   Khi Admin xác nhận "tài khoản này nay thuộc người khác" và đổi họ tên tài khoản,
--   hệ thống ghi họ tên cũ vào author_name của các nhật ký / hồ sơ / vấn đề đã lập trước đó,
--   để lịch sử không bị gán nhầm cho người mới.
-- ============================================================================
BEGIN;

ALTER TABLE daily_logs ADD COLUMN IF NOT EXISTS author_name varchar(255);
ALTER TABLE documents  ADD COLUMN IF NOT EXISTS author_name varchar(255);
ALTER TABLE issues     ADD COLUMN IF NOT EXISTS author_name varchar(255);

COMMIT;
