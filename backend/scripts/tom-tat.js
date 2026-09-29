// In một dòng tóm tắt cho mỗi tệp kết quả kiểm thử — để không phải đọc cả tệp kết quả.
// Cách dùng: node backend/scripts/tom-tat.js backend/tests/last-regression.txt backend/tests/last-ui-test.txt
const fs = require('fs');
const path = require('path');
let xau = 0;
for (const f of process.argv.slice(2)) {
  const ten = path.basename(f);
  if (!fs.existsSync(f)) { console.log(`${ten}: (chưa có tệp)`); xau++; continue; }
  const s = fs.readFileSync(f, 'utf8');
  const so = (re) => { const m = s.match(re); return m ? Number(m[1]) : null; };
  const pass = so(/^ℹ pass (\d+)/m), fail = so(/^ℹ fail (\d+)/m), ms = so(/^ℹ duration_ms ([\d.]+)/m);
  const xong = /^DONE/m.test(s);
  const doTen = [...s.matchAll(/^✖ (.+?) \(/gm)].map(m => m[1]).filter(t => !/^(tests|failing)/.test(t));
  if (pass === null) { console.log(`${ten}: ĐANG CHẠY hoặc không có số liệu${xong ? ' (đã DONE — xem tệp)' : ''}`); xau++; continue; }
  const trangThai = fail === 0 && xong ? 'XANH' : 'ĐỎ';
  if (trangThai !== 'XANH') xau++;
  console.log(`${ten}: ${trangThai} pass=${pass} fail=${fail}${ms ? ' ' + Math.round(ms / 1000) + 's' : ''}${doTen.length ? ' | đỏ: ' + [...new Set(doTen)].join(' · ') : ''}`);
}
process.exit(xau ? 1 : 0);
