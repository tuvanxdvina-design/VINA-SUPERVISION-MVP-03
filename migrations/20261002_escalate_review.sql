-- ============================================================================
-- 20261002 — Trưởng TVGS quyết định tại công trình; việc vượt thẩm quyền thì "Trình công ty"
--   Thêm thao tác ESCALATE vào lịch sử duyệt. Bản ghi trình công ty vẫn ở trạng thái Chờ duyệt,
--   hiện trong mục Việc cần duyệt của Giám đốc/Admin kèm nội dung Trưởng TVGS trình.
-- ============================================================================
BEGIN;

ALTER TABLE review_notes DROP CONSTRAINT IF EXISTS review_notes_action_check;
ALTER TABLE review_notes ADD CONSTRAINT review_notes_action_check
  CHECK (action IN ('SUBMIT', 'APPROVE', 'REJECT', 'LOCK', 'REOPEN', 'ESCALATE'));

COMMIT;
