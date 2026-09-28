-- ============================================================================
-- VINA-SUPERVISION DATABASE SCHEMA v1.0 (Production)
-- Quyết định: B (nhật ký sửa được) + C (hybrid hồ sơ) + A (auto code)
-- Created: 2025-09-17
-- ============================================================================

-- ============================================================================
-- 1. ROLES & PERMISSIONS
-- ============================================================================

CREATE TABLE roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name varchar(50) NOT NULL UNIQUE,
  description text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Insert base roles
INSERT INTO roles (name, description) VALUES
  ('ADMIN', 'Quản trị viên hệ thống'),
  ('DIRECTOR', 'Giám đốc công ty'),
  ('TVGS_LEAD', 'Trưởng TVGS công trình'),
  ('ENGINEER', 'Kỹ sư TVGS');

CREATE TABLE permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role_id uuid NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  resource varchar(100) NOT NULL,
  action varchar(50) NOT NULL,
  scope varchar(50) DEFAULT 'ALL',
  created_at timestamptz DEFAULT now(),
  UNIQUE(role_id, resource, action, scope)
);

-- ============================================================================
-- 2. USERS & ACCOUNTS
-- ============================================================================

CREATE TABLE users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  username varchar(100) NOT NULL UNIQUE,
  email varchar(255) NOT NULL UNIQUE,
  password_hash varchar(255) NOT NULL,
  auth_version integer NOT NULL DEFAULT 0,
  full_name varchar(255) NOT NULL,
  phone varchar(20),
  role_id uuid NOT NULL REFERENCES roles(id),
  is_active bool DEFAULT true,
  last_login_at timestamptz,
  device_id uuid,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role_id ON users(role_id);

-- ============================================================================
-- 3. PROJECTS (CÔNG TRÌNH)
-- ============================================================================

CREATE TABLE projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_code varchar(100),
  contract_no varchar(100) NOT NULL UNIQUE,
  name varchar(255) NOT NULL,
  location varchar(255),
  province varchar(255),
  address varchar(255),
  owner_name varchar(255),
  start_date date,
  contract_date date,
  end_date date,
  contract_value bigint,
  contract_content text,
  progress numeric(5,2) DEFAULT 0,
  status varchar(50) DEFAULT 'ACTIVE',
  description text,
  created_by uuid REFERENCES users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX idx_projects_contract_no ON projects(contract_no);
CREATE INDEX idx_projects_status ON projects(status);

-- ============================================================================
-- 4. PROJECT MEMBERS (PHÂN CÔNG)
-- ============================================================================

CREATE TABLE project_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role_id uuid NOT NULL REFERENCES roles(id),
  start_date date NOT NULL DEFAULT CURRENT_DATE,
  end_date date,
  status varchar(50) DEFAULT 'ACTIVE',
  assigned_by uuid REFERENCES users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(project_id, user_id)
);

CREATE INDEX idx_project_members_project_id ON project_members(project_id);
CREATE INDEX idx_project_members_user_id ON project_members(user_id);

-- ============================================================================
-- 5. DAILY LOGS (NHẬT KÝ) — QUY ĐỊNH B
-- ============================================================================

CREATE TABLE daily_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  log_date date NOT NULL,
  shift varchar(20),
  
  work_summary text,
  weather varchar(100),
  worker_count int,
  machine_count int,
  progress decimal(5, 2),
  note text,
  
  status varchar(50) DEFAULT 'DRAFT',
  version int DEFAULT 1,
  
  created_by uuid NOT NULL REFERENCES users(id),
  created_at timestamptz DEFAULT now(),
  submitted_at timestamptz,
  approved_by uuid REFERENCES users(id),
  approved_at timestamptz,
  locked_at timestamptz,
  
  updated_at timestamptz DEFAULT now(),
  
  UNIQUE(project_id, log_date, shift)
);

CREATE INDEX idx_daily_logs_project_id ON daily_logs(project_id);
CREATE INDEX idx_daily_logs_log_date ON daily_logs(log_date);
CREATE INDEX idx_daily_logs_status ON daily_logs(status);
CREATE INDEX idx_daily_logs_created_by ON daily_logs(created_by);

-- ============================================================================
-- 6. DAILY LOG ITEMS
-- ============================================================================

CREATE TABLE daily_log_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  daily_log_id uuid NOT NULL REFERENCES daily_logs(id) ON DELETE CASCADE,
  
  item_type varchar(50),
  description text NOT NULL,
  quantity decimal(10, 2),
  unit varchar(50),
  
  contractor_work bool DEFAULT false,
  supervision_check bool DEFAULT false,
  
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX idx_daily_log_items_daily_log_id ON daily_log_items(daily_log_id);

-- ============================================================================
-- 7. MATERIALS (VẬT LIỆU)
-- ============================================================================

CREATE TABLE daily_log_materials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  daily_log_id uuid NOT NULL REFERENCES daily_logs(id) ON DELETE CASCADE,
  
  material_name varchar(255) NOT NULL,
  quantity decimal(10, 2) NOT NULL,
  unit varchar(50),
  received_date date,
  storage_location varchar(255),
  approved bool DEFAULT false,
  approved_by uuid REFERENCES users(id),
  approved_at timestamptz,
  
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX idx_daily_log_materials_daily_log_id ON daily_log_materials(daily_log_id);

-- ============================================================================
-- 8. DOCUMENTS (HỒ SƠ) — QUY ĐỊNH C
-- ============================================================================

CREATE TABLE documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  
  type varchar(50) NOT NULL,
  auto_code varchar(100) NOT NULL,
  name varchar(255) NOT NULL,
  
  status varchar(50) DEFAULT 'DRAFT',
  version int DEFAULT 1,
  
  reopened_by uuid REFERENCES users(id),
  reopened_at timestamptz,
  reopened_reason text,
  
  is_adjustment_of uuid REFERENCES documents(id),
  
  created_by uuid NOT NULL REFERENCES users(id),
  created_at timestamptz DEFAULT now(),
  
  submitted_by uuid REFERENCES users(id),
  submitted_at timestamptz,
  
  approved_by uuid REFERENCES users(id),
  approved_at timestamptz,
  
  locked_at timestamptz,
  
  updated_at timestamptz DEFAULT now(),
  
  UNIQUE(project_id, auto_code)
);

CREATE INDEX idx_documents_project_id ON documents(project_id);
CREATE INDEX idx_documents_auto_code ON documents(auto_code);
CREATE INDEX idx_documents_type ON documents(type);
CREATE INDEX idx_documents_status ON documents(status);

-- ============================================================================
-- 9. DOCUMENT SEQUENCES — QUY ĐỊNH A: TỰ ĐỘNG SINH MÃ
-- ============================================================================

CREATE TABLE document_sequences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  type varchar(50) NOT NULL,
  next_sequence int DEFAULT 1,
  
  UNIQUE(project_id, type)
);

CREATE INDEX idx_document_sequences_project_id ON document_sequences(project_id);

-- ============================================================================
-- 10. ATTACHMENTS (ẢNH)
-- ============================================================================

CREATE TABLE attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  daily_log_id uuid REFERENCES daily_logs(id) ON DELETE CASCADE,
  document_id uuid REFERENCES documents(id) ON DELETE CASCADE,
  
  file_name varchar(255) NOT NULL,
  file_type varchar(50),
  file_size bigint,
  file_url varchar(500),
  file_hash varchar(64),
  
  uploaded_by uuid NOT NULL REFERENCES users(id),
  uploaded_at timestamptz DEFAULT now(),
  
  CHECK (daily_log_id IS NOT NULL OR document_id IS NOT NULL)
);

CREATE INDEX idx_attachments_daily_log_id ON attachments(daily_log_id);
CREATE UNIQUE INDEX idx_attachments_daily_log_hash ON attachments(daily_log_id, file_hash)
  WHERE daily_log_id IS NOT NULL AND file_hash IS NOT NULL;
CREATE INDEX idx_attachments_document_id ON attachments(document_id);

-- ============================================================================
-- 11. ISSUES (VẤN ĐỀ)
-- ============================================================================

CREATE TABLE issues (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  issue_code varchar(80),
  due_date date,
  
  title varchar(255) NOT NULL,
  description text,
  severity varchar(50),
  status varchar(50) DEFAULT 'OPEN',
  
  created_by uuid NOT NULL REFERENCES users(id),
  created_at timestamptz DEFAULT now(),
  
  assigned_to uuid REFERENCES users(id),
  assigned_at timestamptz,
  
  resolved_by uuid REFERENCES users(id),
  resolved_at timestamptz,
  resolution_note text,
  
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX idx_issues_project_id ON issues(project_id);
CREATE UNIQUE INDEX idx_issues_project_code ON issues(project_id, issue_code) WHERE issue_code IS NOT NULL;
CREATE INDEX idx_issues_status ON issues(status);
CREATE INDEX idx_issues_created_by ON issues(created_by);

-- ============================================================================
-- 12. ISSUE HISTORY
-- ============================================================================

CREATE TABLE issue_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  issue_id uuid NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
  
  field_name varchar(100),
  old_value text,
  new_value text,
  
  changed_by uuid NOT NULL REFERENCES users(id),
  changed_at timestamptz DEFAULT now()
);

CREATE INDEX idx_issue_history_issue_id ON issue_history(issue_id);

-- ============================================================================
-- 13. AUDIT LOGS
-- ============================================================================

CREATE TABLE audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  
  entity_type varchar(50) NOT NULL,
  entity_id uuid NOT NULL,
  
  action varchar(50) NOT NULL,
  
  old_values jsonb,
  new_values jsonb,
  
  performed_by uuid NOT NULL REFERENCES users(id),
  performed_at timestamptz DEFAULT now(),
  
  ip_address varchar(50),
  user_agent text,
  
  reason text
);

CREATE INDEX idx_audit_logs_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX idx_audit_logs_performed_by ON audit_logs(performed_by);
CREATE INDEX idx_audit_logs_performed_at ON audit_logs(performed_at);

-- ============================================================================
-- 14. SYNC OPERATIONS
-- ============================================================================

CREATE TABLE sync_operations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  
  device_id uuid NOT NULL,
  user_id uuid NOT NULL REFERENCES users(id),
  
  entity_type varchar(50) NOT NULL,
  entity_id uuid NOT NULL,
  
  operation varchar(50) NOT NULL,
  payload jsonb NOT NULL,
  
  status varchar(50) DEFAULT 'PENDING',
  client_version int,
  server_version int,
  
  created_at timestamptz DEFAULT now(),
  synced_at timestamptz,
  
  conflict_resolution varchar(50),
  conflict_notes text,
  
  retry_count int DEFAULT 0,
  last_retry_at timestamptz
);

CREATE INDEX idx_sync_operations_device_id ON sync_operations(device_id);
CREATE INDEX idx_sync_operations_user_id ON sync_operations(user_id);
CREATE INDEX idx_sync_operations_status ON sync_operations(status);
CREATE INDEX idx_sync_operations_created_at ON sync_operations(created_at);

-- ============================================================================
-- 15. DEVICES
-- ============================================================================

CREATE TABLE devices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id),
  
  device_name varchar(255),
  device_type varchar(50),
  os_type varchar(50),
  app_version varchar(20),
  
  last_sync_at timestamptz,
  is_online bool DEFAULT true,
  
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX idx_devices_user_id ON devices(user_id);

-- ============================================================================
-- SEED DATA (TEST)
-- ============================================================================

INSERT INTO projects (contract_no, name, location, owner_name, status)
VALUES 
  ('001', 'Công trình A', 'Hà Nội', 'Bộ Quốc Phòng', 'ACTIVE'),
  ('002', 'Công trình B', 'TP.HCM', 'Sở GTVT', 'ACTIVE'),
  ('003', 'Công trình C', 'Đà Nẵng', 'Sở XD', 'ACTIVE');

INSERT INTO users (username, email, password_hash, full_name, role_id, phone)
SELECT 
  'duong', 'duong@vina.vn', '$2a$10$demo_hash_duong', 'Dương', id, '0912345678'
FROM roles WHERE name = 'DIRECTOR'
UNION ALL
SELECT 
  'hung', 'hung@vina.vn', '$2a$10$demo_hash_hung', 'Hùng', id, '0912345679'
FROM roles WHERE name = 'TVGS_LEAD'
UNION ALL
SELECT 
  'son', 'son@vina.vn', '$2a$10$demo_hash_son', 'Sơn', id, '0912345680'
FROM roles WHERE name = 'ENGINEER'
UNION ALL
SELECT 
  'tuan', 'tuan@vina.vn', '$2a$10$demo_hash_tuan', 'Tuấn', id, '0912345681'
FROM roles WHERE name = 'ENGINEER';

INSERT INTO project_members (project_id, user_id, role_id, start_date, status)
SELECT 
  p.id, u.id, r.id, CURRENT_DATE, 'ACTIVE'
FROM projects p
CROSS JOIN users u
JOIN roles r ON r.id = u.role_id
WHERE (p.contract_no = '001' AND u.username IN ('duong', 'hung', 'son'))
   OR (p.contract_no = '002' AND u.username IN ('duong', 'hung', 'tuan'))
   OR (p.contract_no = '003' AND u.username IN ('duong', 'son', 'tuan'));
