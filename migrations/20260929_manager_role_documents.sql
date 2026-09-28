-- ============================================================================
-- 20260929 — (1) Vai trò "Quản lý" giúp việc Giám đốc
--            (2) Hồ sơ pháp lý / báo cáo lưu trên máy chủ kèm tệp (dùng chung mọi tài khoản)
-- ============================================================================
BEGIN;

-- (1) Vai trò MANAGER: truy cập công trình theo phân công + mức quyền do Giám đốc/Admin cấp.
INSERT INTO roles (name, description)
SELECT 'MANAGER', 'Quản lý chung (giúp việc Giám đốc) — truy cập công trình theo phân quyền'
WHERE NOT EXISTS (SELECT 1 FROM roles WHERE name = 'MANAGER');
UPDATE roles SET description = 'TVGS (giám sát viên)' WHERE name = 'ENGINEER';

-- (2) Hồ sơ: nhóm, thông tin chi tiết, người cập nhật
ALTER TABLE documents
  ADD COLUMN IF NOT EXISTS doc_group varchar(20) NOT NULL DEFAULT 'LEGAL',
  ADD COLUMN IF NOT EXISTS details jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS updated_by uuid REFERENCES users(id);
UPDATE documents SET doc_group = 'REPORT' WHERE doc_group = 'LEGAL' AND (type = 'BC' OR auto_code LIKE 'BC-%');

-- Tệp đính kèm hồ sơ: lưu ngay trong PostgreSQL để một lần sao lưu là đủ cả dữ liệu lẫn tệp.
CREATE TABLE IF NOT EXISTS document_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  category varchar(120) NOT NULL DEFAULT 'Tài liệu',
  file_name varchar(255) NOT NULL,
  file_type varchar(120),
  file_size bigint NOT NULL,
  sha256 char(64) NOT NULL,
  content bytea NOT NULL,
  uploaded_by uuid REFERENCES users(id),
  uploaded_at timestamptz NOT NULL DEFAULT NOW(),
  UNIQUE (document_id, sha256)
);
CREATE INDEX IF NOT EXISTS idx_document_files_document ON document_files(document_id);

-- Đồng bộ bộ đếm mã hồ sơ với các mã đã có (tránh sinh trùng mã, ví dụ BB-001-001 đã tồn tại)
INSERT INTO document_sequences (project_id, type, next_sequence)
SELECT d.project_id, d.type,
       COALESCE(MAX(NULLIF(substring(d.auto_code from '(\d+)$'), '')::int), 0) + 1
FROM documents d
GROUP BY d.project_id, d.type
ON CONFLICT (project_id, type) DO UPDATE
  SET next_sequence = GREATEST(document_sequences.next_sequence, EXCLUDED.next_sequence);

COMMIT;
