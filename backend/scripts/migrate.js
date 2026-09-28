// Áp dụng các migration trong ../migrations theo thứ tự tên tệp, ghi nhận vào schema_migrations.
// Chạy từ thư mục backend:  node scripts/migrate.js            (áp dụng các tệp chưa chạy)
//                           node scripts/migrate.js --status   (chỉ xem trạng thái)
// Các migration hiện có đều viết dạng IF NOT EXISTS nên chạy lại an toàn.
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const pool = require('../src/utils/db');

const dir = path.resolve(__dirname, '..', '..', 'migrations');

(async () => {
  const client = await pool.connect();
  client.on('notice', n => { if (!/already exists|does not exist/.test(n.message)) console.log('\n  THÔNG BÁO: ' + n.message); });
  try {
    await client.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
      file_name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT NOW())`);
    const done = new Set((await client.query('SELECT file_name FROM schema_migrations')).rows.map(r => r.file_name));
    const files = fs.readdirSync(dir).filter(f => /^\d{8}_.+\.sql$/.test(f)).sort();
    if (process.argv.includes('--status')) {
      files.forEach(f => console.log((done.has(f) ? '[x] ' : '[ ] ') + f));
      return;
    }
    for (const file of files) {
      if (done.has(file)) continue;
      const sql = fs.readFileSync(path.join(dir, file), 'utf8').replace(/^﻿/, '');
      process.stdout.write('Áp dụng ' + file + ' ... ');
      await client.query(sql);
      await client.query('INSERT INTO schema_migrations (file_name) VALUES ($1) ON CONFLICT DO NOTHING', [file]);
      console.log('OK');
    }
    console.log('Hoàn tất migration.');
  } catch (error) {
    console.error('\nMigration lỗi:', error.message);
    if (/must be owner|permission denied/i.test(error.message)) {
      console.error('Tài khoản trong backend/.env không phải chủ sở hữu bảng. Hãy chạy bằng quyền postgres:');
      console.error('  powershell -ExecutionPolicy Bypass -File .\\migrate-db.ps1   (tại thư mục dự án)');
    }
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
})();
