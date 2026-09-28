const express = require('express');
const auth = require('../middleware/auth');
const rbac = require('../middleware/rbac');
const access = require('../middleware/projectAccess');
const service = require('../services/projectPersonnelService');
const permissionService = require('../services/permissionService');

const router = express.Router();
router.use(auth.verifyToken);

const managers = [rbac.ROLES.ADMIN, rbac.ROLES.DIRECTOR];

function sendError(res, error) {
  if (error.status) return res.status(error.status).json({ error: error.message });
  if (error.code === '23503') return res.status(404).json({ error: 'Công trình hoặc tài khoản không tồn tại trên máy chủ' });
  console.error('project-personnel:', error.message);
  return res.status(500).json({ error: 'Không xử lý được nhân sự công trình' });
}

function validPermissions(value) {
  return value === undefined || value === null ||
    (Array.isArray(value) && value.every(v => permissionService.ALL.includes(v)));
}

// Danh sách hợp nhất (mỗi người một dòng) — dùng cho trang Nhân sự, Chi tiết công trình, Quản lý quyền.
router.get('/project/:projectId/team', access.projectParam, async (req, res) => {
  try {
    const rows = await service.team(req.params.projectId);
    const me = await permissionService.forUser(req.user.userId, req.params.projectId);
    if (['ADMIN', 'DIRECTOR'].includes(me.role)) return res.json(rows);
    // Nhân viên: chỉ thấy quyền truy cập của CHÍNH MÌNH; thành viên khác chỉ hiện tên, chức danh, chứng chỉ
    res.json(rows.map(r => r.user_id === req.user.userId ? { ...r, is_me: true } : {
      key: r.key, personnel_id: r.personnel_id, full_name: r.full_name, assignment_title: r.assignment_title,
      certificate: r.certificate, role_name: r.role_name, account_status: r.account_status === 'LINKED' ? 'LINKED' : 'NO_ACCOUNT',
      access_permissions: [], permission_source: 'HIDDEN'
    }));
  }
  catch (error) { sendError(res, error); }
});

router.get('/project/:projectId/unassigned-authors', access.projectParam, rbac.checkRole(managers), async (req, res) => {
  try { res.json(await service.unassignedAuthors(req.params.projectId)); }
  catch (error) { sendError(res, error); }
});

// Giữ API cũ (chỉ hồ sơ nhân sự).
router.get('/project/:projectId', access.projectParam, async (req, res) => {
  try { res.json(await service.list(req.params.projectId)); }
  catch (error) { sendError(res, error); }
});

router.post('/', access.body, rbac.checkRole(managers), async (req, res) => {
  try {
    const { project_id, full_name, assignment_title } = req.body;
    if (!project_id || !service.cleanName(full_name) || !String(assignment_title || '').trim()) {
      return res.status(400).json({ error: 'Thiếu công trình, họ tên hoặc chức danh' });
    }
    if (String(full_name).length > 255 || String(assignment_title).length > 120) return res.status(400).json({ error: 'Thông tin nhân sự vượt giới hạn' });
    const { row, created } = await service.upsert({ ...req.body, created_by: req.user.userId });
    await req.audit('project_personnel', row.id, created ? 'CREATE' : 'UPDATE', null, row, req.user.userId);
    res.status(created ? 201 : 200).json(row);
  } catch (error) { sendError(res, error); }
});

async function loadPersonnel(req, res, next) {
  try {
    const row = await service.getById(req.params.id);
    if (!row || row.status !== 'ACTIVE') return res.status(404).json({ error: 'Không tìm thấy nhân sự công trình' });
    req.personnel = row;
    next();
  } catch (error) { sendError(res, error); }
}

router.put('/:id', rbac.checkRole(managers), loadPersonnel, async (req, res) => {
  try {
    if (req.body.full_name !== undefined && String(req.body.full_name).length > 255) return res.status(400).json({ error: 'Họ tên tối đa 255 ký tự' });
    if (req.body.assignment_title !== undefined && String(req.body.assignment_title).length > 120) return res.status(400).json({ error: 'Chức danh tối đa 120 ký tự' });
    const row = await service.update(req.params.id, req.body);
    await req.audit('project_personnel', row.id, 'UPDATE', req.personnel, row, req.user.userId);
    res.json(row);
  } catch (error) { sendError(res, error); }
});

router.post('/:id/link-account', rbac.checkRole(managers), loadPersonnel, async (req, res) => {
  try {
    if (!req.body.user_id) return res.status(400).json({ error: 'Cần chọn tài khoản' });
    if (!validPermissions(req.body.access_permissions)) return res.status(400).json({ error: 'Quyền truy cập không hợp lệ' });
    const result = await service.linkAccount(req.params.id, { ...req.body, actorId: req.user.userId });
    await req.audit('project_personnel', req.params.id, 'LINK_ACCOUNT', req.personnel, result, req.user.userId);
    res.json(result);
  } catch (error) { sendError(res, error); }
});

router.post('/:id/unlink-account', rbac.checkRole(managers), loadPersonnel, async (req, res) => {
  try {
    const row = await service.unlinkAccount(req.params.id);
    await req.audit('project_personnel', req.params.id, 'UNLINK_ACCOUNT', req.personnel, row, req.user.userId);
    res.json(row);
  } catch (error) { sendError(res, error); }
});

router.delete('/:id', rbac.checkRole(managers), loadPersonnel, async (req, res) => {
  try {
    const row = await service.remove(req.params.id);
    await req.audit('project_personnel', row.id, 'REMOVE', req.personnel, null, req.user.userId);
    res.json(row);
  } catch (error) { sendError(res, error); }
});

module.exports = router;
