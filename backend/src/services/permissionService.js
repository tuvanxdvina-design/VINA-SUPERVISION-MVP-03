const pool = require('../utils/db');

// Quyền chi tiết theo công trình.
//  VIEW     : xem dữ liệu công trình
//  CREATE   : lập mới (nhật ký, văn bản chất lượng...) và sửa bản nháp của chính mình
//  EDIT     : sửa bản ghi của người khác / mở lại văn bản
//  DOWNLOAD : tải xuống, in, xuất
//  APPROVE  : duyệt / yêu cầu chỉnh sửa / khóa / trình công ty — quyền của Trưởng TVGS TẠI CÔNG TRÌNH ĐÓ
//  DELETE   : xóa nội dung (vào Thùng rác, khôi phục được). Mặc định CHỈ Admin/Giám đốc (tài khoản quản trị);
//             người khác chỉ có khi được cấp "Tùy chỉnh" tại từng công trình. Không bao giờ có sẵn theo chức danh.
const ALL = ['VIEW', 'CREATE', 'EDIT', 'DOWNLOAD', 'APPROVE', 'DELETE'];

// Quyền mặc định khi Admin/Giám đốc CHƯA tùy chỉnh cho phân công đó.
const ROLE_DEFAULTS = {
  ADMIN: ALL,
  DIRECTOR: ALL,
  // Quản lý giúp việc Giám đốc: mặc định theo dõi (Xem, Tải xuống); Giám đốc/Admin nâng quyền theo từng công trình.
  MANAGER: ['VIEW', 'DOWNLOAD'],
  TVGS_LEAD: ['VIEW', 'CREATE', 'EDIT', 'DOWNLOAD'],
  ENGINEER: ['VIEW', 'CREATE', 'DOWNLOAD']
};
const LEAD_DEFAULTS = ['VIEW', 'CREATE', 'EDIT', 'DOWNLOAD', 'APPROVE'];

// Một người có thể làm nhiều công trình với chức danh khác nhau → quyền mặc định theo CHỨC DANH TẠI CÔNG TRÌNH:
// "TVGS trưởng", "Trưởng TVGS", "Tư vấn giám sát trưởng", "Giám sát trưởng", "Trưởng đoàn TVGS"… (không tính "Phó …").
function plain(s) {
  return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase().replace(/\s+/g, ' ').trim();
}
function isLeadTitle(title) {
  const t = plain(title);
  if (!t || /\bpho\b/.test(t)) return false;
  return /\btruong\b/.test(t) && /(tvgs|giam sat)/.test(t);
}

function normalizeList(value) {
  let list = value;
  if (typeof list === 'string') {
    try { list = JSON.parse(list); } catch (_) { list = []; }
  }
  if (!Array.isArray(list)) return [];
  const set = new Set(list.map(v => String(v).toUpperCase()).filter(v => ALL.includes(v)));
  if (set.size) set.add('VIEW');
  // Được "Sửa" bản ghi của người khác thì mặc nhiên được "Thêm" bản ghi của mình.
  if (set.has('EDIT')) set.add('CREATE');
  return ALL.filter(v => set.has(v));
}

// title: chức danh tại công trình (hồ sơ nhân sự, hoặc phân công tài khoản)
function effective(roleName, customPermissions, hasCustom, title) {
  const role = String(roleName || '').toUpperCase();
  if (role === 'ADMIN' || role === 'DIRECTOR') return { permissions: ALL, source: 'GLOBAL_ROLE' };
  if (hasCustom) return { permissions: normalizeList(customPermissions), source: 'CUSTOM' };
  if (role !== 'MANAGER' && String(title || '').trim()) {
    // Có chức danh: TVGS trưởng → đủ quyền + Duyệt; chức danh khác → quyền nhân viên (kể cả tài khoản loại "Trưởng TVGS")
    return { permissions: isLeadTitle(title) ? LEAD_DEFAULTS : ROLE_DEFAULTS.ENGINEER, source: 'ROLE_DEFAULT' };
  }
  // Chưa nhập chức danh: theo loại tài khoản (giữ tương thích dữ liệu cũ)
  if (role === 'TVGS_LEAD') return { permissions: LEAD_DEFAULTS, source: 'ROLE_DEFAULT' };
  return { permissions: ROLE_DEFAULTS[role] || ['VIEW'], source: 'ROLE_DEFAULT' };
}

// Chức danh tại công trình của một phân công: ưu tiên hồ sơ nhân sự
const TITLE_JOIN = `
  LEFT JOIN LATERAL (
    SELECT assignment_title FROM project_personnel pp
    WHERE pp.project_id = pm.project_id AND pp.user_id = pm.user_id AND pp.status = 'ACTIVE'
    ORDER BY pp.updated_at DESC NULLS LAST LIMIT 1
  ) ppt ON true`;
const TITLE_COL = `COALESCE(NULLIF(ppt.assignment_title, ''), pm.assignment_title) AS title`;
const ACTIVE_MEMBER = `pm.status = 'ACTIVE'
      AND (pm.start_date IS NULL OR pm.start_date <= CURRENT_DATE)
      AND (pm.end_date IS NULL OR pm.end_date >= CURRENT_DATE)`;

async function forUser(userId, projectId) {
  const result = await pool.query(`
    SELECT r.name AS role_name, pm.id AS member_id, ${TITLE_COL},
           pma.access_permissions, (pma.access_permissions IS NOT NULL) AS has_custom
    FROM users u
    JOIN roles r ON r.id = u.role_id
    LEFT JOIN project_members pm ON pm.user_id = u.id AND pm.project_id = $2 AND ${ACTIVE_MEMBER}
    ${TITLE_JOIN}
    LEFT JOIN project_member_access pma ON pma.project_member_id = pm.id
    WHERE u.id = $1 AND u.is_active = true
  `, [userId, projectId]);
  const row = result.rows[0];
  if (!row) return { role: '', permissions: [], source: 'NONE', memberId: null, title: '' };
  const role = String(row.role_name || '').toUpperCase();
  if (role !== 'ADMIN' && role !== 'DIRECTOR' && !row.member_id) {
    return { role, permissions: [], source: 'NOT_ASSIGNED', memberId: null, title: '' };
  }
  const eff = effective(role, row.access_permissions, row.has_custom, row.title);
  return { role, permissions: eff.permissions, source: eff.source, memberId: row.member_id, title: row.title || '' };
}

async function allForUser(userId) {
  const result = await pool.query(`
    SELECT r.name AS role_name, p.id AS project_id, pm.id AS member_id, ${TITLE_COL},
           pma.access_permissions, (pma.access_permissions IS NOT NULL) AS has_custom
    FROM users u
    JOIN roles r ON r.id = u.role_id
    JOIN projects p ON true
    LEFT JOIN project_members pm ON pm.user_id = u.id AND pm.project_id = p.id AND ${ACTIVE_MEMBER}
    ${TITLE_JOIN}
    LEFT JOIN project_member_access pma ON pma.project_member_id = pm.id
    WHERE u.id = $1 AND u.is_active = true
      AND (r.name IN ('ADMIN','DIRECTOR') OR pm.id IS NOT NULL)
  `, [userId]);
  const map = {};
  for (const row of result.rows) {
    const eff = effective(row.role_name, row.access_permissions, row.has_custom, row.title);
    map[row.project_id] = { permissions: eff.permissions, source: eff.source, member_id: row.member_id, title: row.title || '' };
  }
  return map;
}

// Các công trình đang có người được quyền Duyệt tại chỗ (Trưởng TVGS). Công trình không có ai → việc duyệt về công ty.
async function approverProjectIds() {
  const rows = (await pool.query(`
    SELECT pm.project_id, r.name AS role_name, ${TITLE_COL},
           pma.access_permissions, (pma.access_permissions IS NOT NULL) AS has_custom
    FROM project_members pm
    JOIN users u ON u.id = pm.user_id AND u.is_active = true
    JOIN roles r ON r.id = u.role_id
    ${TITLE_JOIN}
    LEFT JOIN project_member_access pma ON pma.project_member_id = pm.id
    WHERE ${ACTIVE_MEMBER} AND r.name NOT IN ('ADMIN', 'DIRECTOR')`)).rows;
  return new Set(rows.filter(r => effective(r.role_name, r.access_permissions, r.has_custom, r.title).permissions.includes('APPROVE')).map(r => r.project_id));
}

// Người duyệt tại công trình: Admin/Giám đốc (cấp công ty) hoặc người có quyền Duyệt tại công trình
function canApprove(p) {
  return ['ADMIN', 'DIRECTOR'].includes(p.role) || p.permissions.includes('APPROVE');
}

// Middleware: yêu cầu quyền trên công trình đã xác định ở req.projectId
function requirePermission(permission) {
  return async (req, res, next) => {
    try {
      if (!req.projectId) return res.status(400).json({ error: 'Thiếu ID công trình' });
      const p = await forUser(req.user.userId, req.projectId);
      req.projectPermissions = p;
      if (!p.permissions.includes(permission)) {
        const label = { VIEW: 'Xem', CREATE: 'Thêm', EDIT: 'Sửa', DOWNLOAD: 'Tải xuống', APPROVE: 'Duyệt', DELETE: 'Xóa' }[permission] || permission;
        return res.status(403).json({ error: `Tài khoản chưa được cấp quyền "${label}" tại công trình này` });
      }
      next();
    } catch (error) {
      console.error('Permission check:', error.message);
      res.status(503).json({ error: 'Không kiểm tra được quyền công trình' });
    }
  };
}

module.exports = { ALL, ROLE_DEFAULTS, LEAD_DEFAULTS, isLeadTitle, normalizeList, effective, forUser, allForUser, approverProjectIds, canApprove, requirePermission };
