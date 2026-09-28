const express = require('express');
const authMiddleware = require('../middleware/auth');
const rbac = require('../middleware/rbac');
const userService = require('../services/userService');

const router = express.Router();
router.use(authMiddleware.verifyToken);
const R = rbac.ROLES;
const managers = [R.ADMIN, R.DIRECTOR];

function fail(res, err) {
  if (err.status) return res.status(err.status).json({ error: err.message });
  console.error('users:', err.message);
  return res.status(500).json({ error: 'Không xử lý được tài khoản' });
}
// Giám đốc không tạo/sửa được tài khoản Admin; chỉ Admin tạo Admin.
function mayAssignRole(actorRole, roleName) {
  if (actorRole === R.ADMIN) return true;
  return [R.DIRECTOR, R.MANAGER, R.TVGS_LEAD, R.ENGINEER].includes(roleName);
}

router.get('/', rbac.checkRole(managers), async (req, res) => {
  try { res.json(await userService.getAllUsers()); } catch (e) { fail(res, e); }
});

// GET /api/users/username-available?username=...&except=<id> — kiểm tra tên đăng nhập khi gõ
router.get('/username-available', rbac.checkRole(managers), async (req, res) => {
  try {
    const except = /^[0-9a-f-]{36}$/i.test(String(req.query.except || '')) ? req.query.except : null;
    res.json(await userService.usernameAvailable(req.query.username, except));
  } catch (e) { fail(res, e); }
});

// GET /api/users/:id/usage — số nhật ký/hồ sơ/vấn đề tài khoản đã lập (trước khi đổi họ tên tài khoản)
router.get('/:id/usage', rbac.checkRole(managers), async (req, res) => {
  try { res.json(await userService.usage(req.params.id)); } catch (e) { fail(res, e); }
});

router.get('/:id', async (req, res) => {
  try {
    const own = req.params.id === req.user.userId;
    if (!own) {
      const role = (await require('../utils/db').query('SELECT r.name FROM users u JOIN roles r ON r.id = u.role_id WHERE u.id = $1', [req.user.userId])).rows[0]?.name;
      if (!managers.includes(role)) return res.status(403).json({ error: 'Không có quyền xem tài khoản khác' });
    }
    const user = await userService.getUserById(req.params.id);
    if (!user) return res.status(404).json({ error: 'Không tìm thấy tài khoản' });
    res.json(user);
  } catch (e) { fail(res, e); }
});

router.post('/', rbac.checkRole(managers), async (req, res) => {
  try {
    const roleName = req.body.role_name || 'ENGINEER';
    if (!mayAssignRole(req.role, roleName)) return res.status(403).json({ error: 'Chỉ Admin được tạo tài khoản Admin' });
    const user = await userService.createUser({ ...req.body, role_name: roleName });
    await req.audit('users', user.id, 'CREATE', null, { username: user.username, role: user.role_name }, req.user.userId);
    res.status(201).json(user);
  } catch (e) { fail(res, e); }
});

router.patch('/:id', rbac.checkRole(managers), async (req, res) => {
  try {
    const before = await userService.getUserById(req.params.id);
    if (!before) return res.status(404).json({ error: 'Không tìm thấy tài khoản' });
    if (before.role_name === R.ADMIN && req.role !== R.ADMIN) return res.status(403).json({ error: 'Chỉ Admin được sửa tài khoản Admin' });
    if (req.body.role_name && !mayAssignRole(req.role, req.body.role_name)) return res.status(403).json({ error: 'Không được gán loại tài khoản này' });
    // Đổi tên đăng nhập (tùy chọn). Mật khẩu giữ nguyên; người dùng đăng nhập bằng tên mới.
    if (req.body.username !== undefined && String(req.body.username).trim().toLowerCase() !== before.username) {
      await userService.changeUsername(req.params.id, req.body.username);
    }
    // Tài khoản chuyển cho người khác: giữ tên người lập cũ trên nhật ký/hồ sơ/vấn đề đã có
    let frozen = 0;
    if (req.body.keep_history_name === true && req.body.full_name && String(req.body.full_name).normalize('NFC').replace(/\s+/g, ' ').trim() !== before.full_name) {
      frozen = await userService.freezeAuthorName(req.params.id, before.full_name);
    }
    const user = await userService.updateUser(req.params.id, req.body);
    await req.audit('users', req.params.id, 'UPDATE', before, { ...user, history_name_kept_on: frozen || undefined }, req.user.userId);
    res.json({ ...user, history_name_kept_on: frozen });
  } catch (e) { fail(res, e); }
});

// Đặt lại mật khẩu cho người khác (Admin/Giám đốc)
router.post('/:id/password', rbac.checkRole(managers), async (req, res) => {
  try {
    const target = await userService.getUserById(req.params.id);
    if (!target) return res.status(404).json({ error: 'Không tìm thấy tài khoản' });
    if (target.role_name === R.ADMIN && req.role !== R.ADMIN) return res.status(403).json({ error: 'Chỉ Admin được đặt mật khẩu Admin' });
    await userService.setPassword(req.params.id, req.body.password);
    await req.audit('users', req.params.id, 'RESET_PASSWORD', null, null, req.user.userId);
    res.json({ ok: true });
  } catch (e) { fail(res, e); }
});

router.delete('/:id', rbac.checkRole([R.ADMIN]), async (req, res) => {
  try {
    if (req.params.id === req.user.userId) return res.status(400).json({ error: 'Không tự vô hiệu hóa chính mình' });
    await userService.deactivateUser(req.params.id);
    await req.audit('users', req.params.id, 'DEACTIVATE', null, null, req.user.userId);
    res.json({ ok: true });
  } catch (e) { fail(res, e); }
});

module.exports = router;
