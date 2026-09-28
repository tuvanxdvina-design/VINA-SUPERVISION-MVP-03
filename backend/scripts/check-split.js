// So sánh JavaScript của giao diện TRƯỚC và SAU khi tách index.html, để chứng minh
// không mất mã và không sửa nhầm mã. 14 ca kiểm thử giao diện chỉ phủ 14 luồng;
// script này phủ toàn bộ ~256 đơn vị mã.
// Cách dùng:
//   node backend/scripts/check-split.js <commit-truoc-khi-tach>            (so tập đơn vị)
//   node backend/scripts/check-split.js <commit-truoc-khi-tach> --bytes    (so từng byte)
//   node backend/scripts/check-split.js HEAD --list                       (liệt kê đơn vị)
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { splitTopLevel, unitName } = require('./lib/jsUnits');

const ROOT = path.resolve(__dirname, '..', '..');
const GIT = process.env.GIT_EXE || 'git';
const [commit, ...flags] = process.argv.slice(2);
const wantBytes = flags.includes('--bytes');
const wantList = flags.includes('--list');
if (!commit) { console.log('Thiếu tham số: <commit trước khi tách>'); process.exit(2); }

// Lấy các "phần JS của giao diện" theo đúng thứ tự xuất hiện trong index.html:
// khối nội tuyến và tệp js/ trộn lẫn. `doc` đọc một tệp theo đường dẫn tương đối gốc dự án.
// api.js KHÔNG thuộc phần tách (nó vốn đã là tệp riêng) nên bị bỏ qua ở cả hai phía.
function pieces(html, doc) {
  const out = [];
  const re = /<script\b([^>]*)>([\s\S]*?)<\/script>/g;
  let m;
  while ((m = re.exec(html))) {
    const src = (m[1].match(/src="([^"]+)"/) || [])[1];
    if (!src) { out.push({ file: 'index.html', code: m[2] }); continue; }
    if (!/\/js\//.test(src)) continue;
    const rel = src.replace(/^\.\//, '');
    out.push({ file: src, code: doc(rel) });
  }
  return out;
}

const gitShow = (rel) => execFileSync(GIT, ['show', `${commit}:${rel}`], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
const docNow = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

const before = pieces(gitShow('index.html'), gitShow);
const after = pieces(docNow('index.html'), docNow);

if (wantList) {
  for (const p of after) for (const u of splitTopLevel(p.code)) {
    if (!u.trim()) continue;
    console.log(`${unitName(u)}\t${p.file}\t${Buffer.byteLength(u)}`);
  }
  process.exit(0);
}

if (wantBytes) {
  const a = before.map(p => p.code.trim()).join('\n');
  const b = after.map(p => p.code.trim()).join('\n');
  if (a === b) { console.log(`KHỚP TỪNG BYTE: ${before.length} khối trước → ${after.length} phần sau, ${Buffer.byteLength(a)} byte`); process.exit(0); }
  let at = 0;
  while (at < a.length && a[at] === b[at]) at++;
  console.log(`LỆCH BYTE tại vị trí ${at}\ntrước: ${JSON.stringify(a.slice(Math.max(0, at - 60), at + 60))}\nsau:   ${JSON.stringify(b.slice(Math.max(0, at - 60), at + 60))}`);
  process.exit(1);
}

const norm = (u) => u.replace(/\r\n/g, '\n').trim().replace(/[ \t]+/g, ' ');
const bag = (arr) => {
  const map = new Map();
  for (const u of arr) { if (!u.trim()) continue; const k = norm(u); map.set(k, (map.get(k) || 0) + 1); }
  return map;
};
const bagBefore = bag(before.flatMap(p => splitTopLevel(p.code)));
const bagAfter = bag(after.flatMap(p => splitTopLevel(p.code)));

const thieu = [], thua = [];
for (const [k, n] of bagBefore) { const m2 = bagAfter.get(k) || 0; if (m2 < n) thieu.push([k, n - m2]); }
for (const [k, n] of bagAfter) { const m2 = bagBefore.get(k) || 0; if (m2 < n) thua.push([k, n - m2]); }

if (!thieu.length && !thua.length) {
  console.log(`KHỚP TẬP ĐƠN VỊ: ${bagBefore.size} đơn vị khác nhau, không thiếu, không thừa, không sửa nội dung`);
  process.exit(0);
}
console.log(`LỆCH: thiếu ${thieu.length} đơn vị, thừa ${thua.length} đơn vị`);
for (const [k, n] of thieu.slice(0, 20)) console.log(`  THIẾU x${n}: ${unitName(k)} — ${k.slice(0, 80)}`);
for (const [k, n] of thua.slice(0, 20)) console.log(`  THỪA  x${n}: ${unitName(k)} — ${k.slice(0, 80)}`);
console.log('Lưu ý: một đơn vị vừa THIẾU vừa THỪA với tên giống nhau nghĩa là nội dung bị sửa.');
process.exit(1);
