const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const pool = require('../utils/db');

exports.generateToken = (userId, roleId, authVersion) => jwt.sign(
  { userId, roleId, authVersion },
  process.env.JWT_SECRET,
  { expiresIn: '7d' }
);

exports.verifyToken = async (req, res, next) => {
  const token = req.headers.authorization?.replace(/^Bearer\s+/i, '');
  if (!token) return res.status(401).json({ error: 'No token provided' });

  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET);
  } catch (_) {
    return res.status(401).json({ error: 'Invalid token' });
  }

  try {
    const result = await pool.query(
      'SELECT id, role_id, is_active, auth_version, must_change_password FROM users WHERE id = $1',
      [decoded.userId]
    );
    const user = result.rows[0];
    if (!user?.is_active || decoded.authVersion !== user.auth_version) return res.status(401).json({ error: 'Account unavailable' });
    // Mật khẩu tạm do quản trị cấp: chỉ được đổi mật khẩu, chưa dùng được chức năng khác.
    if (user.must_change_password && !req.originalUrl.startsWith('/api/auth/change-password')) {
      return res.status(403).json({ error: 'Cần đổi mật khẩu ban đầu trước khi sử dụng', code: 'MUST_CHANGE_PASSWORD' });
    }
    req.user = { userId: user.id, roleId: user.role_id };
    next();
  } catch (error) {
    console.error('Token verification database error:', error.message);
    res.status(503).json({ error: 'Authentication service unavailable' });
  }
};

// Chống dò mật khẩu: sai quá LOGIN_MAX_FAILS lần trong LOGIN_WINDOW_MS (theo tên đăng nhập và theo IP)
// thì tạm khóa đăng nhập tới hết cửa sổ. Lưu trong bộ nhớ tiến trình — đủ cho 1 máy chủ.
const LOGIN_MAX_FAILS = 8;
const LOGIN_MAX_FAILS_IP = 30;
const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const loginFails = new Map();
const DUMMY_HASH = bcrypt.hashSync('khong-phai-mat-khau-that', 12);
function failKeys(req, username) { return [['u:' + username.toLowerCase(), LOGIN_MAX_FAILS], ['ip:' + (req.ip || ''), LOGIN_MAX_FAILS_IP]]; }
function lockedFor(keys) {
  const now = Date.now();
  let wait = 0;
  for (const [k, max] of keys) {
    const e = loginFails.get(k);
    if (e && e.until < now) loginFails.delete(k);
    else if (e && e.count >= max) wait = Math.max(wait, e.until - now);
  }
  return wait;
}
function recordFail(keys) {
  const now = Date.now();
  for (const [k] of keys) {
    const e = loginFails.get(k);
    if (!e || e.until < now) loginFails.set(k, { count: 1, until: now + LOGIN_WINDOW_MS });
    else e.count++;
  }
  if (loginFails.size > 10000) for (const [k, e] of loginFails) if (e.until < now) loginFails.delete(k);
}
exports._resetLoginLimiter = () => loginFails.clear();

exports.login = async (req, res) => {
  const username = typeof req.body?.username === 'string' ? req.body.username.trim() : '';
  const password = typeof req.body?.password === 'string' ? req.body.password : '';
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password required' });
  }
  const keys = failKeys(req, username);
  const wait = lockedFor(keys);
  if (wait > 0) {
    res.setHeader('Retry-After', String(Math.ceil(wait / 1000)));
    return res.status(429).json({ error: `Đăng nhập sai quá nhiều lần. Thử lại sau ${Math.ceil(wait / 60000)} phút.` });
  }

  try {
    const result = await pool.query(
      `SELECT u.id, u.username, u.email, u.full_name, u.role_id,
              r.name AS role_name, u.password_hash, u.is_active, u.auth_version, u.must_change_password
       FROM users u
       LEFT JOIN roles r ON r.id = u.role_id
       WHERE lower(u.username) = lower($1) ORDER BY (u.username = $1) DESC LIMIT 1`,
      [username]
    );
    const user = result.rows[0];
    if (!user?.is_active) {
      // So khớp giả để thời gian phản hồi không lộ tên đăng nhập có tồn tại hay không
      await bcrypt.compare(password, DUMMY_HASH);
      recordFail(keys);
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    const hash = user.password_hash || '';
    const placeholder = hash === 'demo_hash' || /^\$2a\$10\$demo_hash_/.test(hash);
    const demoLogin = process.env.NODE_ENV !== 'production' && placeholder && password === 'demo';
    const passwordMatches = demoLogin || (!placeholder && await bcrypt.compare(password, hash));
    if (!passwordMatches) {
      recordFail(keys);
      return res.status(401).json({ error: 'Invalid username or password' });
    }
    loginFails.delete(keys[0][0]);

    const { password_hash, is_active, auth_version, ...safeUser } = user;
    const token = exports.generateToken(user.id, user.role_id, auth_version);
    res.json({ token, user: safeUser });
  } catch (error) {
    console.error('Login database error:', error.message);
    res.status(503).json({ error: 'Authentication service unavailable' });
  }
};
