const express = require('express');
const auth = require('../middleware/auth');
const rbac = require('../middleware/rbac');
const permissionService = require('../services/permissionService');
const recycleService = require('../services/recycleService');
const projectProgressService = require('../services/projectProgressService');

const router = express.Router();
router.use(auth.verifyToken);

function fail(res, e) {
  if (e.status) return res.status(e.status).json({ error: e.message });
  console.error('recycle-bin:', e.message);
  res.status(500).json({ error: 'Không xử lý được Thùng rác' });
}

// Công trình người dùng được quyền Xóa; null = mọi công trình (Admin/Giám đốc)
async function deletableProjects(userId) {
  const perms = await permissionService.allForUser(userId);
  const entries = Object.entries(perms);
  if (entries.some(([, v]) => v.source === 'GLOBAL_ROLE')) return null;
  return entries.filter(([, v]) => v.permissions.includes('DELETE')).map(([k]) => k);
}

// GET /api/recycle-bin — nội dung đã xóa ở các công trình mình có quyền Xóa
router.get('/', async (req, res) => {
  try {
    const scope = await deletableProjects(req.user.userId);
    if (scope && !scope.length) return res.status(403).json({ error: 'Tài khoản không có quyền Xóa ở công trình nào' });
    res.json(await recycleService.list(scope));
  } catch (e) { fail(res, e); }
});

// POST /api/recycle-bin/:id/restore — khôi phục (quyền Xóa tại công trình của nội dung)
router.post('/:id/restore', async (req, res) => {
  try {
    const rec = await recycleService.get(req.params.id);
    if (!rec) return res.status(404).json({ error: 'Không tìm thấy trong Thùng rác' });
    const p = await permissionService.forUser(req.user.userId, rec.project_id);
    if (!p.permissions.includes('DELETE')) return res.status(403).json({ error: 'Tài khoản chưa được cấp quyền "Xóa" tại công trình này' });
    const r = await recycleService.restore(req.params.id, req.user.userId);
    if (r.type === 'project_progress_plans') await projectProgressService.syncProjectSafe(r.project_id);
    await req.audit(r.type, r.id, 'RESTORE', null, { recycle_id: req.params.id }, req.user.userId);
    res.json({ ok: true, ...r });
  } catch (e) { fail(res, e); }
});

// DELETE /api/recycle-bin/:id — xóa vĩnh viễn: CHỈ Admin. Giữ dòng vết (ai xóa, lý do, lúc nào).
router.delete('/:id', rbac.checkRole([rbac.ROLES.ADMIN]), async (req, res) => {
  try {
    const r = await recycleService.purge(req.params.id, req.user.userId);
    await req.audit(r.entity_type, req.params.id, 'PURGE', null, { title: r.title }, req.user.userId);
    res.json({ ok: true });
  } catch (e) { fail(res, e); }
});

module.exports = router;
