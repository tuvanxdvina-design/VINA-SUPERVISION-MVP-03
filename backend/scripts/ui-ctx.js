// Trích ~240 ký tự quanh mỗi lần xuất hiện của một chuỗi trong index.html.
// Dùng khi cần biết markup/nhãn thật mà không phải đọc cả file 270 KB.
// Cách dùng: node backend/scripts/ui-ctx.js "goAlertTarget(" "#delReason"
const fs = require('fs');
const path = require('path');
const s = fs.readFileSync(path.join(__dirname, '..', '..', 'index.html'), 'utf8');
for (const pat of process.argv.slice(2)) {
  let i = 0, n = 0;
  console.log('### ' + pat);
  while ((i = s.indexOf(pat, i)) >= 0 && n < 5) {
    console.log('  ' + JSON.stringify(s.slice(Math.max(0, i - 110), i + 130)));
    i += pat.length; n++;
  }
  if (!n) console.log('  (không có)');
}
