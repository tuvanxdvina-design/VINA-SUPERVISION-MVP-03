const pool = require('../utils/db');
const bcrypt = require('bcryptjs');

const SAFE = `u.id, u.username, u.email, u.full_name, u.phone, u.role_id, r.name AS role_name, u.is_active, u.created_at, u.must_change_password,
  (u.password_hash = 'demo_hash' OR u.password_hash LIKE '$2a$10$demo_hash_%') AS needs_password`;

function cleanName(v) { return String(v || '').normalize('NFC').replace(/\s+/g, ' ').trim(); }
function httpError(status, message) { const e = new Error(message); e.status = status; return e; }

class UserService {
  async getAllUsers() {
    return (await pool.query(`SELECT ${SAFE} FROM users u LEFT JOIN roles r ON u.role_id = r.id ORDER BY r.name, u.username`)).rows;
  }

  async getUserById(id) {
    return (await pool.query(`SELECT ${SAFE} FROM users u LEFT JOIN roles r ON u.role_id = r.id WHERE u.id = $1`, [id])).rows[0];
  }

  async roleIdByName(name) {
    const r = await pool.query('SELECT id FROM roles WHERE name = $1', [name]);
    if (!r.rows[0]) throw httpError(400, 'Loại tài khoản không hợp lệ (cần chạy migration để có vai trò Quản lý)');
    return r.rows[0].id;
  }

  // Tên đăng nhập do người quản trị tự chọn: 3–50 ký tự, chữ không dấu, số, dấu chấm, gạch, @ (dùng được email/số điện thoại).
  // Lưu chữ thường; đăng nhập không phân biệt hoa/thường.
  normalizeUsername(value) {
    const username = String(value || '').trim().toLowerCase();
    if (!/^[a-z0-9][a-z0-9._@-]{2,49}$/.test(username)) throw httpError(400, 'Tên đăng nhập 3–50 ký tự: chữ không dấu, số, dấu chấm, gạch dưới, gạch ngang, @ (không bắt đầu bằng ký hiệu)');
    return username;
  }

  async usernameAvailable(value, exceptId = null) {
    let username;
    try { username = this.normalizeUsername(value); } catch (e) { return { available: false, reason: e.message }; }
    const r = await pool.query('SELECT id FROM users WHERE lower(username) = $1 AND ($2::uuid IS NULL OR id <> $2)', [username, exceptId]);
    return r.rows[0] ? { available: false, username, reason: 'Tên đăng nhập đã có người dùng' } : { available: true, username };
  }

  async changeUsername(id, value) {
    const check = await this.usernameAvailable(value, id);
    if (!check.available) throw httpError(check.reason === 'Tên đăng nhập đã có người dùng' ? 409 : 400, check.reason);
    const r = await pool.query('UPDATE users SET username = $1, updated_at = NOW() WHERE id = $2 RETURNING id', [check.username, id]);
    if (!r.rows[0]) throw httpError(404, 'Không tìm thấy tài khoản');
    return this.getUserById(id);
  }

  // Tạo tài khoản kèm mật khẩu ban đầu (bcrypt). Email không bắt buộc: tự sinh nếu để trống.
  async createUser(data) {
    const username = this.normalizeUsername(data.username);
    if ((await pool.query('SELECT 1 FROM users WHERE lower(username) = $1', [username])).rows[0]) throw httpError(409, 'Tên đăng nhập đã có người dùng');
    if (String(data.password || '').length < 8) throw httpError(400, 'Mật khẩu ban đầu tối thiểu 8 ký tự');
    const fullName = cleanName(data.full_name);
    if (!fullName) throw httpError(400, 'Nhập họ tên');
    const roleId = data.role_id || await this.roleIdByName(data.role_name);
    const email = String(data.email || '').trim() || (username.includes('@') ? username : `${username}@vina.local`);
    const hash = await bcrypt.hash(String(data.password), 12);
    try {
      const r = await pool.query(`
        INSERT INTO users (username, email, password_hash, full_name, phone, role_id, is_active, must_change_password)
        VALUES ($1, $2, $3, $4, NULLIF($5, ''), $6, true, true) RETURNING id`,
      [username, email, hash, fullName, data.phone || '', roleId]);
      return this.getUserById(r.rows[0].id);
    } catch (error) {
      if (error.code === '23505') throw httpError(409, 'Tên đăng nhập hoặc email đã tồn tại');
      throw error;
    }
  }

  async updateUser(id, data) {
    const roleId = data.role_id || (data.role_name ? await this.roleIdByName(data.role_name) : null);
    await pool.query(`
      UPDATE users SET full_name = COALESCE(NULLIF($1, ''), full_name), phone = COALESCE($2, phone),
        role_id = COALESCE($3, role_id), is_active = COALESCE($4, is_active),
        auth_version = auth_version + CASE WHEN $3::uuid IS NOT NULL AND $3::uuid <> role_id OR $4 = false THEN 1 ELSE 0 END,
        updated_at = NOW()
      WHERE id = $5`, [cleanName(data.full_name), data.phone ?? null, roleId, data.is_active ?? null, id]);
    return this.getUserById(id);
  }

  // mustChange = true khi Admin/Giám đốc đặt mật khẩu hộ (mật khẩu tạm); false khi người dùng tự đổi.
  async setPassword(id, password, mustChange = true) {
    if (String(password || '').length < 8) throw httpError(400, 'Mật khẩu tối thiểu 8 ký tự');
    const hash = await bcrypt.hash(String(password), 12);
    const r = await pool.query('UPDATE users SET password_hash = $1, must_change_password = $3, auth_version = auth_version + 1, updated_at = NOW() WHERE id = $2 RETURNING id', [hash, id, mustChange]);
    if (!r.rows[0]) throw httpError(404, 'Không tìm thấy tài khoản');
  }

  async changeOwnPassword(id, oldPassword, newPassword) {
    const u = (await pool.query('SELECT password_hash FROM users WHERE id = $1', [id])).rows[0];
    if (!u) throw httpError(404, 'Không tìm thấy tài khoản');
    const placeholder = u.password_hash === 'demo_hash' || /^\$2a\$10\$demo_hash_/.test(u.password_hash);
    const ok = placeholder ? (process.env.NODE_ENV !== 'production' && oldPassword === 'demo') : await bcrypt.compare(String(oldPassword || ''), u.password_hash);
    if (!ok) throw httpError(400, 'Mật khẩu hiện tại không đúng');
    if (String(newPassword || '') === String(oldPassword || '')) throw httpError(400, 'Mật khẩu mới phải khác mật khẩu hiện tại');
    await this.setPassword(id, newPassword, false);
  }

  // Số bản ghi do tài khoản đã lập (để cảnh báo trước khi đổi họ tên tài khoản)
  async usage(id) {
    return (await pool.query(`SELECT
      (SELECT COUNT(*)::int FROM daily_logs WHERE created_by = $1 AND author_name IS NULL) AS daily_logs,
      (SELECT COUNT(*)::int FROM documents WHERE created_by = $1 AND author_name IS NULL) AS documents,
      (SELECT COUNT(*)::int FROM issues WHERE created_by = $1 AND author_name IS NULL) AS issues,
      (SELECT TO_CHAR(MIN(log_date),'YYYY-MM-DD') FROM daily_logs WHERE created_by = $1 AND author_name IS NULL) AS first_log,
      (SELECT TO_CHAR(MAX(log_date),'YYYY-MM-DD') FROM daily_logs WHERE created_by = $1 AND author_name IS NULL) AS last_log`, [id])).rows[0];
  }

  // Chốt tên người lập hiện tại lên các bản ghi cũ trước khi tài khoản đổi sang người khác
  async freezeAuthorName(id, name) {
    const n = cleanName(name);
    if (!n) return 0;
    let total = 0;
    for (const t of ['daily_logs', 'documents', 'issues']) {
      total += (await pool.query(`UPDATE ${t} SET author_name = $2 WHERE created_by = $1 AND author_name IS NULL`, [id, n])).rowCount;
    }
    return total;
  }

  // Vô hiệu hóa thay vì xóa cứng (giữ lịch sử nhật ký, hồ sơ, audit)
  async deactivateUser(id) {
    await pool.query('UPDATE users SET is_active = false, auth_version = auth_version + 1, updated_at = NOW() WHERE id = $1', [id]);
    await pool.query("UPDATE project_members SET status = 'INACTIVE', end_date = CURRENT_DATE, updated_at = NOW() WHERE user_id = $1 AND status = 'ACTIVE'", [id]);
  }
}

module.exports = new UserService();
