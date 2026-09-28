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
const build = (fs.readFileSync(path.join(root, 'backend/src/build.js'), 'utf8').match(/BUILD:\s*'([^']+)'/) || [])[1];
const appBuild = (html.match(/const APP_BUILD='([^']+)'/) || [])[1];
if (build !== appBuild) { bad++; console.log(`LỖI phiên bản lệch: build.js=${build}, index.html=${appBuild}`); }
console.log(`${n} khối script nội tuyến, ${bad} lỗi, build ${build}`);
process.exit(bad ? 1 : 0);
