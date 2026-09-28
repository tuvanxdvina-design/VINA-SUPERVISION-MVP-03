require('dotenv').config();
const pool = require('../src/utils/db');

(async () => {
  try {
    const result = await pool.query(`
      SELECT COUNT(*) FILTER (
        WHERE is_active AND (password_hash = 'demo_hash' OR password_hash LIKE '$2a$10$demo_hash_%')
      )::int AS demo_accounts FROM users
    `);
    const demoAccounts = result.rows[0].demo_accounts;
    if (process.env.NODE_ENV !== 'production' || demoAccounts > 0) {
      console.error(`Chưa sẵn sàng truy cập từ xa: môi trường production=${process.env.NODE_ENV === 'production'}, tài khoản demo còn lại=${demoAccounts}`);
      process.exitCode = 1;
    } else {
      console.log('Đã sẵn sàng xác thực: production, không còn tài khoản demo đang hoạt động.');
    }
  } catch (error) {
    console.error('Không kiểm tra được tài khoản:', error.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
})();
