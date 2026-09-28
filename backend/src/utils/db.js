const { Pool, types } = require('pg');
// Kiểu DATE trả về nguyên chuỗi 'YYYY-MM-DD'. Mặc định pg đổi sang Date lúc 00:00 giờ máy chủ (UTC+7)
// rồi JSON hóa thành ngày hôm trước (…T17:00:00Z) → giao diện cắt 10 ký tự bị lệch 1 ngày.
types.setTypeParser(1082, value => value);
require('dotenv').config();

const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
});

// Test connection
pool.query('SELECT NOW()', (err, result) => {
  if (err) {
    console.error('❌ Database connection failed:', err.message);
  } else {
    console.log('✅ Database connected:', result.rows[0]);
  }
});

module.exports = pool;