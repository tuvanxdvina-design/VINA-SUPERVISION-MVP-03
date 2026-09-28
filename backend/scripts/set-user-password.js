// Run from backend/: node scripts/set-user-password.js <username>
// The password is read from stdin, never from command-line arguments.
require('dotenv').config();
const readline = require('readline');
const bcrypt = require('bcryptjs');
const pool = require('../src/utils/db');

const username = process.argv[2];
if (!username || process.argv.length !== 3) {
  console.error('Usage: node scripts/set-user-password.js <username>');
  process.exit(2);
}

// Use the normal console output for reliable PowerShell input. The password is
// not printed back by readline; only the prompt is visible.
const prompt = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: !!process.stdin.isTTY });
function ask(label) {
  return new Promise(resolve => {
    process.stdout.write(label);
    prompt.question('', answer => { process.stdout.write('\n'); resolve(answer); });
  });
}

(async () => {
  try {
    let password, confirm;
    if (process.stdin.isTTY) {
      password = await ask('Mật khẩu mới: ');
      confirm = await ask('Nhập lại mật khẩu: ');
    } else {
      const chunks = [];
      for await (const chunk of process.stdin) chunks.push(chunk);
      [password, confirm] = Buffer.concat(chunks).toString('utf8').split(/\r?\n/);
    }
    if (typeof password !== 'string' || typeof confirm !== 'string') throw new Error('Cần nhập mật khẩu hai lần');
    if (password.length < 8) throw new Error('Mật khẩu cần ít nhất 8 ký tự');
    if (password !== confirm) throw new Error('Hai lần nhập không khớp');
    const hash = await bcrypt.hash(password, 12);
    const result = await pool.query('UPDATE users SET password_hash = $1, auth_version = auth_version + 1, updated_at = NOW() WHERE username = $2 AND is_active = true RETURNING id', [hash, username]);
    if (result.rowCount !== 1) throw new Error('Không tìm thấy tài khoản đang hoạt động');
    console.log('Đã cập nhật mật khẩu cho tài khoản ' + username);
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  } finally {
    prompt.close();
    await pool.end();
  }
})();
