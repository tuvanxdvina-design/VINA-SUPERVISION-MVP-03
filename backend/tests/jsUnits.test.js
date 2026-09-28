// Kiểm bộ tách đơn vị top-level. Bất biến quan trọng nhất: nối các đơn vị lại phải
// bằng đúng đầu vào — nếu bộ quét đọc sai chuỗi/template/regex thì ca cuối sẽ đỏ.
const test = require('node:test');
const assert = require('node:assert/strict');
const { splitTopLevel, unitName } = require('../scripts/lib/jsUnits');

test('cắt hai hàm top-level thành hai đơn vị', () => {
  const src = 'function a(){return 1}\nfunction b(){return 2}\n';
  const u = splitTopLevel(src);
  assert.equal(u.length, 2);
  assert.equal(u.join(''), src);
  assert.deepEqual(u.map(unitName), ['a', 'b']);
});

test('không cắt trong chuỗi có dấu ngoặc nhọn', () => {
  const src = 'function a(){const s="}{";return s}\nconst b=1;\n';
  const u = splitTopLevel(src);
  assert.equal(u.length, 2);
  assert.equal(u.join(''), src);
  assert.deepEqual(u.map(unitName), ['a', 'b']);
});

test('không cắt trong template literal có ${} lồng nhau', () => {
  const src = 'function a(x){return `a${x?`${x}}`:""}b`}\nlet c=2;\n';
  const u = splitTopLevel(src);
  assert.equal(u.length, 2);
  assert.equal(u.join(''), src);
});

test('regex literal chứa dấu ngoặc và dấu nháy không làm lệch', () => {
  const src = 'function esc(s){return String(s).replace(/[&<>"\'{}]/g,"-")}\nfunction b(){}\n';
  const u = splitTopLevel(src);
  assert.equal(u.length, 2);
  assert.equal(u.join(''), src);
  assert.deepEqual(u.map(unitName), ['esc', 'b']);
});

test('chú thích // và /* */ không làm lệch', () => {
  const src = '// ghi chú } "\n/* khối } */\nfunction a(){}\n';
  const u = splitTopLevel(src);
  assert.equal(u.join(''), src);
  assert.ok(u.map(unitName).includes('a'));
});

test('cắt được JS thật của index.html mà nối lại không đổi một byte', () => {
  const fs = require('fs');
  const path = require('path');
  const html = fs.readFileSync(path.resolve(__dirname, '..', '..', 'index.html'), 'utf8');
  const blocks = [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)].filter(m => !/\bsrc=/.test(m[1])).map(m => m[2]);
  assert.ok(blocks.length >= 5, 'phải tìm thấy các khối nội tuyến');
  let tong = 0;
  for (const b of blocks) {
    const u = splitTopLevel(b);
    assert.equal(u.join(''), b, 'nối lại phải bằng đúng đầu vào');
    tong += u.length;
  }
  assert.ok(tong > 200, 'index.html phải có hơn 200 đơn vị top-level, đếm được: ' + tong);
});
