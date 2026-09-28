const express = require('express');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

// POST /api/auth/login
router.post('/login', authMiddleware.login);

// POST /api/auth/change-password (người đang đăng nhập tự đổi mật khẩu)
router.post('/change-password', authMiddleware.verifyToken, async (req, res) => {
  try {
    await require('../services/userService').changeOwnPassword(req.user.userId, req.body?.old_password, req.body?.new_password);
    res.json({ ok: true, message: 'Đã đổi mật khẩu. Hãy đăng nhập lại.' });
  } catch (e) { res.status(e.status || 500).json({ error: e.status ? e.message : 'Không đổi được mật khẩu' }); }
});

module.exports = router;