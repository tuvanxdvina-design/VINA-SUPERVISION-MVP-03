const test = require('node:test');
const assert = require('node:assert/strict');
const { splitTopLevel, unitName } = require('../scripts/lib/jsUnits');

test('cat hai ham top-level thanh hai don vi', () => {
  const src = 'function a(){return 1}\nfunction b(){return 2}\n';
  const u = splitTopLevel(src);
  assert.equal(u.length, 2);
  assert.equal(u.join(''), src);
  assert.deepEqual(u.map(unitName), ['a', 'b']);
});

test('khong cat trong chuoi co dau ngoac nhon', () => {
  const src = 'function a(){const s="}{";return s}\nconst b=1;\n';
  const u = splitTopLevel(src);
  assert.equal(u.length, 2);
  assert.equal(u.join(''), src);
  assert.deepEqual(u.map(unitName), ['a', 'b']);
});

test('khong cat trong template literal co ${} long nhau', () => {
  const src = 'function a(x){return `a${x?`${x}}`:""}b`}\nlet c=2;\n';
  const u = splitTopLevel(src);
  assert.equal(u.length, 2);
  assert.equal(u.join(''), src);
});

test('regex literal chua dau ngoac va dau nhay khong lam lech', () => {
  const src = 'function esc(s){return String(s).replace(/[&<>"\'{}]/g,"-")}\nfunction b(){}\n';
  const u = splitTopLevel(src);
  assert.equal(u.length, 2);
  assert.equal(u.join(''), src);
  assert.deepEqual(u.map(unitName), ['esc', 'b']);
});

test('chu thich // va /* */ khong lam lech', () => {
  const src = '// ghi chu } "\n/* khoi } */\nfunction a(){}\n';
  const u = splitTopLevel(src);
  assert.equal(u.join(''), src);
  assert.ok(u.map(unitName).includes('a'));
});

test('cat duoc cac tep js that ma noi lai khong doi mot byte', () => {
  const fs = require('fs');
  const path = require('path');
  const root = path.resolve(__dirname, '..', '..');
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  const inline = [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)].filter(m => !/\bsrc=/.test(m[1]));
  assert.equal(inline.length, 0, 'index.html khong con script noi tuyen');
  const jsDir = path.join(root, 'js');
  const files = fs.readdirSync(jsDir).filter(f => f.endsWith('.js')).sort();
  assert.ok(files.length >= 20, 'phai tim thay cac tep js da tach');
  let total = 0;
  for (const file of files) {
    const src = fs.readFileSync(path.join(jsDir, file), 'utf8');
    const u = splitTopLevel(src);
    assert.equal(u.join(''), src, file + ': noi lai phai bang dung dau vao');
    total += u.length;
  }
  assert.ok(total > 200, 'cac tep js phai co hon 200 don vi top-level, dem duoc: ' + total);
});
