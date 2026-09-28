// Kiểm tra cú pháp JavaScript của giao diện: các khối <script> nội tuyến trong index.html + api.js + sw.js.
// Chạy (tại thư mục dự án): node backend\scripts\check-frontend.js
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const root = path.resolve(__dirname, '..', '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const re = /<script\b([^>]*)>([\s\S]*?)<\/script>/g;
let m, n = 0, bad = 0;
while ((m = re.exec(html))) {
  if (/\bsrc=/.test(m[1])) continue;
  n++;
  try { new vm.Script(m[2], { filename: `index.html#script${n}` }); }
  catch (e) { bad++; console.log(`LỖI index.html khối script ${n}: ${e.message}`); }
}
for (const f of ['api.js', 'sw.js']) {
  try { new vm.Script(fs.readFileSync(path.join(root, f), 'utf8'), { filename: f }); }
  catch (e) { bad++; console.log(`LỖI ${f}: ${e.message}`); }
}
// Kiểm cú pháp mọi tệp js/*.js và đối chiếu ba danh sách phải khớp nhau:
// thẻ <script src> trong index.html, SHELL_FILES và bộ lọc fetch trong sw.js.
const jsDir = path.join(root, 'js');
const jsFiles = fs.existsSync(jsDir) ? fs.readdirSync(jsDir).filter(f => f.endsWith('.js')).sort() : [];
for (const f of jsFiles) {
  try { new vm.Script(fs.readFileSync(path.join(jsDir, f), 'utf8'), { filename: 'js/' + f }); }
  catch (e) { bad++; console.log(`LỖI js/${f}: ${e.message}`); }
}
const srcTags = [...html.matchAll(/<script\b[^>]*src="\.\/js\/([^"]+)"/g)].map(m => m[1]);
const swSrc = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');
const shell = [...swSrc.matchAll(/'\.\/js\/([^']+)'/g)].map(m => m[1]);
for (const f of jsFiles) {
  if (!srcTags.includes(f)) { bad++; console.log(`LỖI js/${f} không có thẻ <script src> trong index.html — tính năng sẽ mất im lặng`); }
  if (!shell.includes(f)) { bad++; console.log(`LỖI js/${f} không có trong SHELL_FILES của sw.js — app sẽ hỏng khi mất mạng`); }
}
for (const f of srcTags) {
  if (!jsFiles.includes(f)) { bad++; console.log(`LỖI index.html trỏ tới js/${f} nhưng tệp không tồn tại`); }
}
if (jsFiles.length && !/url\.pathname\.startsWith\('\/js\/'\)/.test(swSrc)) { bad++; console.log('LỖI sw.js: bộ lọc fetch chưa cho phép /js/ — tệp js sẽ không được cache'); }

const build = (fs.readFileSync(path.join(root, 'backend/src/build.js'), 'utf8').match(/BUILD:\s*'([^']+)'/) || [])[1];
// APP_BUILD có thể nằm trong index.html (trước khi tách) hoặc trong một tệp js/ (sau khi tách).
const nguonGiaoDien = html + jsFiles.map(f => fs.readFileSync(path.join(jsDir, f), 'utf8')).join('\n');
const appBuild = (nguonGiaoDien.match(/const APP_BUILD='([^']+)'/) || [])[1];
if (build !== appBuild) { bad++; console.log(`LỖI phiên bản lệch: build.js=${build}, giao diện=${appBuild}`); }
console.log(`${n} khối script nội tuyến, ${jsFiles.length} tệp js/, ${bad} lỗi, build ${build}`);
process.exit(bad ? 1 : 0);
