const express = require('express');
const auth = require('../middleware/auth');
const access = require('../middleware/projectAccess');
const reviewService = require('../services/reviewService');

const router = express.Router();
router.use(auth.verifyToken);

// GET /api/reviews/inbox — việc chờ tôi duyệt, bản của tôi bị yêu cầu chỉnh sửa, bản vừa được duyệt
router.get('/inbox', async (req, res) => {
  try { res.json(await reviewService.inbox(req.user.userId)); }
  catch (e) { console.error('reviews:', e.message); res.status(500).json({ error: 'Không tải được danh sách việc cần duyệt' }); }
});

// GET /api/reviews/:entity/:id — lịch sử ý kiến duyệt của một báo cáo/hồ sơ/nhật ký
const checkers = { documents: access.record('documents'), daily_logs: access.record('daily_logs') };
router.get('/:entity/:id', (req, res, next) => {
  const check = checkers[req.params.entity];
  if (!check) return res.status(400).json({ error: 'Loại bản ghi không hợp lệ' });
  check(req, res, next);
}, async (req, res) => {
  try { res.json(await reviewService.history(req.params.entity, req.params.id)); }
  catch (e) { console.error('reviews:', e.message); res.status(500).json({ error: 'Không tải được lịch sử duyệt' }); }
});

module.exports = router;
