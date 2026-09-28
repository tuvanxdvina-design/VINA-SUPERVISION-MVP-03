# Tách `index.html` thành các file JS theo tính năng — Kế hoạch thực thi

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Chuyển ~232 KB JavaScript nội tuyến trong `index.html` thành 12 file trong `js/`, mỗi file một tính năng, **không đổi một dòng logic nào**.

**Architecture:** Giữ `<script>` cổ điển (không module, không bundler) và giữ **đúng thứ tự nạp** hiện tại → phạm vi biến toàn cục và `onclick` nội tuyến hoạt động y như cũ. Làm hai bước có thể chứng minh bằng máy: trước tách nguyên văn từng khối (so byte), sau gom theo tính năng bằng cách di chuyển nguyên khối từng đơn vị top-level (so tập đơn vị).

**Tech Stack:** Node 24 (CommonJS), `node:test`, `playwright-core` (bộ 14 ca giao diện đã có), Express 5 (`express.static`), service worker thuần.

**Spec:** `docs/superpowers/specs/2026-09-28-tach-index-html-design.md`

## Global Constraints

- **Không đổi hành vi**: không sửa logic, không đổi tên hàm, không đổi HTML/CSS ngoài việc thay khối `<script>` nội tuyến bằng `<script src>`. Phát hiện lỗi dọc đường thì ghi lại và báo người dùng, **không sửa trong đợt này**.
- Giữ nguyên **thứ tự nạp**: tiền tố số của tên file chính là thứ tự; `api.js` vẫn nạp trước các file `js/` như hiện nay (thẻ `api.js` ở dòng 1254, sau khối nội tuyến đầu tiên ở dòng 284 — thứ tự tương đối này phải giữ đúng).
- Mọi file JS mới đặt trong `js/` ở gốc dự án. **Chỉ sửa ở gốc**, không bao giờ sửa `web-public/` (bản sao do `start-dev.ps1` sinh).
- Có **năm** danh sách tệp tĩnh phải khớp nhau, không phải bốn: `app.js` (route), `start-dev.ps1` (chép sang `web-public`), `sw.js` **`SHELL_FILES`**, `sw.js` **bộ lọc trong `fetch`** (`['/', '/api.js', '/favicon.ico']`), và các thẻ `<script src>` trong `index.html`.
- Điều kiện nghiệm thu mọi giai đoạn: `backend\scripts\run-ui-tests.cmd` → **15/15**; `backend\scripts\run-regression.cmd vina_regr_split` → **40/40**; `node backend\scripts\check-frontend.js` → 0 lỗi. Tên CSDL thử phải bắt đầu bằng `vina_ui`/`vina_reg` (script từ chối tên khác).
- Môi trường này in ra màn hình không đáng tin: **mọi lệnh dài ghi ra file rồi đọc file**; lệnh lâu chạy detached (`Start-Process cmd.exe -ArgumentList '/c', ... -WindowStyle Hidden`) rồi poll bằng Grep. Mẫu tên ca kiểm thử là regex **không dùng dấu `|`** (dùng `GD-0[67]`).
- Sửa `index.html`/`sw.js` → bump build **3 chỗ** (`backend/src/build.js` BUILD, `index.html` `const APP_BUILD=`, `sw.js` SHELL_CACHE). Bump **một lần** ở Task 7, không bump từng task, để `check-frontend` không báo lệch giữa các commit trung gian → **Task 3–6 giữ nguyên build `2026-10-07.1`**.
- Không đụng CSDL thật `vina_supervision`; không khởi động lại backend cổng 3001 của người dùng.
- Commit tiếng Việt (nội dung + lý do), kết thúc bằng `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>`. Trước commit kiểm không có bí mật trong staged.

## Review Focus

Năm cách đợt này có thể hỏng mà bộ kiểm thử hiện tại **không** bắt được — mỗi dòng có một test gắn vào task sở hữu nó:

1. **Một thẻ `<script src>` trỏ sai / thiếu file → 404, mất hẳn một tính năng mà trang vẫn mở được.** Test: Task 3, ca `HZ-03` nạp trang rồi `fetch` từng `src` trong `index.html`, khẳng định tất cả trả 200.
2. **Câu lệnh top-level của file trước gọi hàm của file nạp sau → lỗi lúc nạp, trang trắng hoặc mất nav.** Test: Task 3, ca `HZ-04` khẳng định console không có lỗi sau khi nạp và nav hiện đủ mục.
3. **Một file `js/*.js` thiếu trong `SHELL_FILES` của `sw.js` → app hỏng khi mất mạng.** Kiểm: Task 3, `check-frontend.js` đối chiếu ba danh sách (`index.html`, `SHELL_FILES`, bộ lọc `fetch`) và báo tên file lệch.
4. **Bộ tách đơn vị top-level đọc sai regex/template literal → hai hàm bị dính vào nhau hoặc một hàm bị cắt đôi.** Test: Task 1, `splitTopLevel` tự khẳng định `units.join('') === src` trên mọi đầu vào, cộng 6 ca đơn vị cho chuỗi/template/regex/chú thích.
5. **`web-public/` không được cập nhật → người dùng mở cổng 8080 thấy bản cũ, báo "sửa rồi mà không thấy".** Kiểm: Task 3 sửa `start-dev.ps1` chép cả thư mục `js/`; Task 7 kiểm tay `web-public/js/` có đủ file sau khi chạy `run.bat`.

---

### Task 1: Bộ tách đơn vị top-level (`jsUnits.js`)

**Files:**
- Create: `backend/scripts/lib/jsUnits.js`
- Test: `backend/tests/jsUnits.test.js`

**Interfaces:**
- Consumes: không có.
- Produces: `module.exports = { splitTopLevel, unitName }`
  - `splitTopLevel(src) -> string[]` — cắt `src` thành các đoạn ở **mức ngoài cùng**; nối lại phải đúng bằng `src` (hàm tự khẳng định điều này, ném lỗi nếu lệch).
  - `unitName(unit) -> string` — tên nhận dạng của đơn vị: tên hàm/biến/lớp nếu có, ngược lại là 40 ký tự đầu đã chuẩn hoá khoảng trắng.

- [ ] **Step 1: Viết test đỏ**

```js
// backend/tests/jsUnits.test.js
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
```

- [ ] **Step 2: Chạy để thấy đỏ**

Run: `node --test backend/tests/jsUnits.test.js`
Expected: FAIL — `Cannot find module '../scripts/lib/jsUnits'`.

- [ ] **Step 3: Viết `backend/scripts/lib/jsUnits.js`**

```js
// Cắt một đoạn JavaScript thành các "đơn vị top-level" (khai báo hàm/biến/lớp hoặc câu lệnh
// ở mức ngoài cùng). Dùng cho check-split.js và cho việc di chuyển mã giữa các file.
// Bất biến: splitTopLevel(src).join('') === src. Nếu lệch là bộ quét đọc sai, phải ném lỗi ngay
// thay vì trả về kết quả sai lặng lẽ.

// Quét ký tự, bỏ qua nội dung chuỗi/template/regex/chú thích, đếm độ sâu ngoặc.
function splitTopLevel(src) {
  const out = [];
  let start = 0, i = 0, depth = 0;
  let prevSignificant = ''; // ký tự có nghĩa gần nhất, để đoán '/' là regex hay phép chia
  const n = src.length;
  while (i < n) {
    const c = src[i];
    // chú thích
    if (c === '/' && src[i + 1] === '/') { const j = src.indexOf('\n', i); i = j < 0 ? n : j; continue; }
    if (c === '/' && src[i + 1] === '*') { const j = src.indexOf('*/', i + 2); i = j < 0 ? n : j + 2; continue; }
    // chuỗi
    if (c === '"' || c === "'") { i = skipQuoted(src, i, c); prevSignificant = c; continue; }
    // template literal (có thể lồng ${ ... })
    if (c === '`') { i = skipTemplate(src, i); prevSignificant = '`'; continue; }
    // regex literal
    if (c === '/' && regexAllowedAfter(prevSignificant)) { const j = skipRegex(src, i); if (j > i) { i = j; prevSignificant = '/'; continue; } }
    if (c === '{' || c === '(' || c === '[') { depth++; prevSignificant = c; i++; continue; }
    if (c === '}' || c === ')' || c === ']') { depth--; prevSignificant = c; i++; continue; }
    if (depth === 0 && (c === '\n')) {
      // Kết thúc đơn vị ở dòng trống hoặc khi dòng kế tiếp bắt đầu một khai báo mới.
      const rest = src.slice(i + 1);
      if (/^\s*(?:\/\/|\/\*|(?:async\s+)?function\b|const\b|let\b|var\b|class\b|window\.|document\.|if\b|for\b|try\b|void\b|self\.|[A-Za-z_$][\w$]*\s*=|[A-Za-z_$][\w$]*\s*\()/.test(rest) && /[;}\s]$/.test(src.slice(start, i + 1).trimEnd().slice(-1) || ' ')) {
        out.push(src.slice(start, i + 1));
        start = i + 1;
      }
      i++; continue;
    }
    if (!/\s/.test(c)) prevSignificant = c;
    i++;
  }
  if (start < n) out.push(src.slice(start));
  const joined = out.join('');
  if (joined !== src) throw new Error('splitTopLevel: nối lại không bằng đầu vào (bộ quét đọc sai)');
  return out;
}

function skipQuoted(src, i, q) {
  i++;
  while (i < src.length) {
    if (src[i] === '\\') { i += 2; continue; }
    if (src[i] === q) return i + 1;
    i++;
  }
  return i;
}

function skipTemplate(src, i) {
  i++;
  while (i < src.length) {
    if (src[i] === '\\') { i += 2; continue; }
    if (src[i] === '`') return i + 1;
    if (src[i] === '$' && src[i + 1] === '{') {
      let d = 1; i += 2;
      while (i < src.length && d > 0) {
        if (src[i] === '\\') { i += 2; continue; }
        if (src[i] === '`') { i = skipTemplate(src, i); continue; }
        if (src[i] === '"' || src[i] === "'") { i = skipQuoted(src, i, src[i]); continue; }
        if (src[i] === '{') d++;
        if (src[i] === '}') d--;
        i++;
      }
      continue;
    }
    i++;
  }
  return i;
}

// '/' mở regex khi ký tự có nghĩa trước đó không thể kết thúc một biểu thức.
function regexAllowedAfter(prev) {
  if (!prev) return true;
  return !/[\w$)\]`'"]/.test(prev);
}

function skipRegex(src, i) {
  let j = i + 1, inClass = false;
  while (j < src.length) {
    const c = src[j];
    if (c === '\\') { j += 2; continue; }
    if (c === '\n') return i; // không phải regex
    if (c === '[') inClass = true;
    else if (c === ']') inClass = false;
    else if (c === '/' && !inClass) { j++; while (j < src.length && /[a-z]/.test(src[j])) j++; return j; }
    j++;
  }
  return i;
}

function unitName(unit) {
  const s = unit.trim();
  let m = s.match(/^(?:async\s+)?function\s+([A-Za-z_$][\w$]*)/);
  if (m) return m[1];
  m = s.match(/^(?:const|let|var)\s+([A-Za-z_$][\w$]*)/);
  if (m) return m[1];
  m = s.match(/^class\s+([A-Za-z_$][\w$]*)/);
  if (m) return m[1];
  m = s.match(/^([A-Za-z_$][\w$.]*)\s*=\s*(?:async\s+)?function/);
  if (m) return m[1];
  return s.replace(/\s+/g, ' ').slice(0, 40);
}

module.exports = { splitTopLevel, unitName };
```

- [ ] **Step 4: Chạy test, sửa bộ quét đến khi xanh**

Run: `node --test backend/tests/jsUnits.test.js`
Expected: 6/6 PASS. Nếu ca cuối (JS thật của `index.html`) ném "nối lại không bằng đầu vào", đó là bộ quét đọc sai — in ra vị trí lệch rồi sửa `skipRegex`/`skipTemplate`, **không** nới lỏng khẳng định.

- [ ] **Step 5: Commit**

```bash
git add backend/scripts/lib/jsUnits.js backend/tests/jsUnits.test.js
git commit -m "Cong cu: bo tach don vi top-level cua JavaScript (jsUnits.js)

Bat buoc noi lai bang dung dau vao, co 6 ca kiem thu gom chuoi, template long
nhau, regex chua ngoac/nhay, chu thich, va toan bo JS that trong index.html.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 2: `check-split.js` — lưới an toàn của đợt tách

**Files:**
- Create: `backend/scripts/check-split.js`

**Interfaces:**
- Consumes: `{ splitTopLevel, unitName }` từ `backend/scripts/lib/jsUnits.js`.
- Produces: lệnh `node backend/scripts/check-split.js <commit> [--bytes] [--list]`, mã thoát 0 nếu khớp, 1 nếu lệch.
  - Nguồn "trước": JS nội tuyến trong `index.html` của `<commit>` (`git show <commit>:index.html`).
  - Nguồn "sau": các khối nội tuyến còn lại của `index.html` hiện tại **cộng** nội dung từng file trong các thẻ `<script src="./js/...">` — đọc danh sách từ chính `index.html`, không hard-code.
  - `--bytes`: so chuỗi nối (sau khi `trim()` từng khối) — dùng cho Giai đoạn 1.
  - mặc định: so **tập đơn vị đã sắp xếp** theo nội dung đã chuẩn hoá khoảng trắng — dùng cho Giai đoạn 2; in ra đơn vị thiếu / thừa / bị sửa.
  - `--list`: in `<tên đơn vị>\t<file>\t<số byte>` cho từng đơn vị của nguồn "sau" — dùng để lập bảng phân bổ ở Task 5.

- [ ] **Step 1: Viết `backend/scripts/check-split.js`**

```js
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
  const at = [...a].findIndex((c, i) => c !== b[i]);
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
```

- [ ] **Step 2: Chạy trên trạng thái chưa tách để kiểm chính script**

Run: `node backend/scripts/check-split.js HEAD --bytes`
Expected: `KHỚP TỪNG BYTE` (vì "trước" và "sau" đang là cùng một `index.html`, chưa có file `js/`). Nếu báo lệch thì lỗi ở chính script, sửa trước khi đi tiếp.

- [ ] **Step 3: Kiểm chế độ so tập đơn vị và chế độ liệt kê**

Run: `node backend/scripts/check-split.js HEAD`
Expected: `KHỚP TẬP ĐƠN VỊ: <N> đơn vị khác nhau…` với N > 200.
Run: `node backend/scripts/check-split.js HEAD --list > %TEMP%\units.txt` rồi đếm dòng.
Expected: > 200 dòng, cột 2 là `index.html`.

- [ ] **Step 4: Commit**

```bash
git add backend/scripts/check-split.js
git commit -m "Cong cu: check-split.js so JS giao dien truoc/sau khi tach index.html

Che do --bytes cho giai doan tach nguyen van, che do mac dinh so tap don vi
top-level cho giai doan gom theo tinh nang, --list de lap bang phan bo.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 3: Giai đoạn 0 — hạ tầng phục vụ thư mục `js/` + 2 ca kiểm thử bảo vệ

**Files:**
- Modify: `backend/src/app.js:62-67` (thêm mount tĩnh)
- Modify: `start-dev.ps1:8-11` (chép cả thư mục `js/`)
- Modify: `sw.js:2` và `sw.js:19` (hai danh sách)
- Modify: `backend/scripts/check-frontend.js` (quét `js/*.js` + đối chiếu ba danh sách)
- Create: `js/00-khoi-dong.js` (file thật đầu tiên, chứa phần khởi động đã có sẵn ở khối nội tuyến nhỏ nhất — xem Step 4)
- Create: `backend/tests/ui/cases/09-ha-tang-js.js`
- Modify: `backend/tests/ui/all.test.js` (thêm một dòng `require`)

**Interfaces:**
- Consumes: bộ helper giao diện đã có (`uiTest`, `loginViaApi`, `navVisible` trong `backend/tests/ui/helpers.js`).
- Produces: đường phục vụ `GET /js/<tên file>` trả 200; `check-frontend.js` báo lỗi nếu ba danh sách lệch nhau.

- [ ] **Step 0: Ghi lại commit mốc `BASE_SPLIT` TRƯỚC khi di chuyển bất kỳ dòng JS nào**

Run: `git rev-parse --short HEAD`
Ghi giá trị này vào ghi chú task với tên `BASE_SPLIT`. Đây là mốc "toàn bộ JS còn nội tuyến"; **mọi** lần chạy `check-split.js` ở Task 3, 4, 6, 7 đều dùng đúng mốc này. Ghi sai mốc là mất khả năng chứng minh không thất lạc mã.

- [ ] **Step 1: Viết hai ca kiểm thử đỏ**

```js
// backend/tests/ui/cases/09-ha-tang-js.js
// Hai ca bảo vệ đợt tách index.html: mọi tệp JS khai báo trong trang phải nạp được,
// và trang phải nạp không lỗi console (bắt trường hợp câu lệnh top-level gọi hàm của file nạp sau).
const assert = require('node:assert/strict');
const { uiTest, loginViaApi, navVisible } = require('../helpers');

module.exports = function () {
  uiTest('HZ-03 mọi tệp JS khai báo trong index.html đều nạp được (không 404)', async (page) => {
    const srcs = await page.$$eval('script[src]', els => els.map(e => e.getAttribute('src')));
    assert.ok(srcs.length >= 2, 'trang phải khai báo ít nhất api.js và một tệp js/: ' + JSON.stringify(srcs));
    for (const src of srcs) {
      const res = await page.request.get(new URL(src, page.url()).href);
      assert.equal(res.status(), 200, 'tệp không nạp được (' + res.status() + '): ' + src);
    }
  });

  uiTest('HZ-04 nạp trang không có lỗi console và nav hiện đủ mục', async (page) => {
    const loi = [];
    page.on('console', m => { if (m.type() === 'error') loi.push(m.text()); });
    page.on('pageerror', e => loi.push('pageerror: ' + e.message));
    await loginViaApi(page, 'admin');
    for (const p of ['dashboard', 'projects', 'daily', 'docs', 'issues', 'reports', 'people', 'settings']) {
      assert.equal(await navVisible(page, p), true, 'thiếu mục nav: ' + p);
    }
    assert.deepEqual(loi, [], 'không được có lỗi console khi nạp trang');
  });
};
```

Thêm vào `backend/tests/ui/all.test.js` sau dòng `require('./cases/08-thung-rac')();`:

```js
require('./cases/09-ha-tang-js')();
```

- [ ] **Step 2: Chạy để thấy trạng thái hiện tại**

```powershell
Start-Process cmd.exe -ArgumentList '/c','backend\scripts\run-ui-tests.cmd vina_ui_claude HZ-0[34]' -WindowStyle Hidden
```

Poll `backend\tests\last-ui-test.txt`. Expected: **HZ-03 đỏ** (trang chưa có tệp `js/` nào nên `srcs.length >= 2` không thoả — chỉ có `api.js`), HZ-04 xanh. Ghi lại kết quả: đây là bằng chứng HZ-03 thật sự kiểm điều kiện mới.

- [ ] **Step 3: Thêm mount tĩnh vào `backend/src/app.js`**

Sửa khối route tĩnh (ngay dưới dòng ghi chú `// Serve only the three public assets...`), thêm **một** dòng:

```js
app.use('/js', express.static(path.join(webRoot, 'js'), { extensions: false, index: false }));
```

Đổi luôn dòng ghi chú cho khớp thực tế:

```js
// Chỉ phục vụ các tệp giao diện công khai (trang, api.js, thư mục js/, sw.js, favicon, logo).
// Không bao giờ để lộ backup dự án hay .env.
```

- [ ] **Step 4: Tạo `js/00-khoi-dong.js` và trỏ `index.html` vào nó**

Chuyển **nguyên văn** khối nội tuyến ở dòng 1255 (khối đăng ký service worker, ~1 dòng) sang `js/00-khoi-dong.js`, rồi thay khối đó trong `index.html` bằng:

```html
<script src="./js/00-khoi-dong.js"></script>
```

Đây là phép thử đường phục vụ trên một khối nhỏ, tự chứa, không phụ thuộc hàm nào — nếu sai thì sai ngay ở đây, rẻ hơn sai giữa 137 KB.

- [ ] **Step 5: Cập nhật hai danh sách trong `sw.js`**

```js
const SHELL_FILES = ['./', './api.js', './favicon.ico', './js/00-khoi-dong.js'];
```

và trong `fetch`:

```js
  if (!['/', '/api.js', '/favicon.ico'].includes(url.pathname) && !url.pathname.startsWith('/js/')) return;
```

- [ ] **Step 6: Cập nhật `start-dev.ps1` để chép cả thư mục `js/`**

Ngay sau vòng `foreach` chép từng tệp (dòng 8–11), thêm:

```powershell
$jsSrc = Join-Path $projectRoot 'js'
if (Test-Path $jsSrc) {
    $jsDst = Join-Path $webRoot 'js'
    New-Item -ItemType Directory -Path $jsDst -Force | Out-Null
    Copy-Item -LiteralPath (Join-Path $jsSrc '*') -Destination $jsDst -Recurse -Force
}
```

- [ ] **Step 7: Mở rộng `backend/scripts/check-frontend.js`**

Thêm, sau vòng kiểm `api.js`/`sw.js` và trước đoạn so build:

```js
// Kiểm cú pháp mọi tệp js/*.js và đối chiếu ba danh sách phải khớp nhau:
// thẻ <script src> trong index.html, SHELL_FILES và bộ lọc fetch trong sw.js.
const jsDir = path.join(root, 'js');
const jsFiles = fs.existsSync(jsDir) ? fs.readdirSync(jsDir).filter(f => f.endsWith('.js')).sort() : [];
for (const f of jsFiles) {
  try { new vm.Script(fs.readFileSync(path.join(jsDir, f), 'utf8'), { filename: 'js/' + f }); }
  catch (e) { bad++; console.log(`LỖI js/${f}: ${e.message}`); }
}
const srcTags = [...html.matchAll(/<script\b[^>]*src="\.\/js\/([^"]+)"/g)].map(m => m[1]);
const sw = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');
const shell = [...sw.matchAll(/'\.\/js\/([^']+)'/g)].map(m => m[1]);
for (const f of jsFiles) {
  if (!srcTags.includes(f)) { bad++; console.log(`LỖI js/${f} không có thẻ <script src> trong index.html — tính năng sẽ mất im lặng`); }
  if (!shell.includes(f)) { bad++; console.log(`LỖI js/${f} không có trong SHELL_FILES của sw.js — app sẽ hỏng khi mất mạng`); }
}
for (const f of srcTags) {
  if (!jsFiles.includes(f)) { bad++; console.log(`LỖI index.html trỏ tới js/${f} nhưng tệp không tồn tại`); }
}
if (!/url\.pathname\.startsWith\('\/js\/'\)/.test(sw)) { bad++; console.log('LỖI sw.js: bộ lọc fetch chưa cho phép /js/ — tệp js sẽ không được cache'); }
```

Sửa dòng in tổng kết để nói cả số tệp js:

```js
console.log(`${n} khối script nội tuyến, ${jsFiles.length} tệp js/, ${bad} lỗi, build ${build}`);
```

- [ ] **Step 8: Chạy kiểm tra cú pháp, so byte với mốc, và hai ca**

Run: `node backend\scripts\check-frontend.js`
Expected: `… 1 tệp js/, 0 lỗi, build 2026-10-07.1`.

Run: `node backend\scripts\check-split.js <BASE_SPLIT> --bytes`
Expected: `KHỚP TỪNG BYTE` — chứng minh khối service worker đã dời sang `js/00-khoi-dong.js` **nguyên văn**, không sót và không thêm ký tự nào.

```powershell
Start-Process cmd.exe -ArgumentList '/c','backend\scripts\run-ui-tests.cmd vina_ui_claude' -WindowStyle Hidden
```

Expected: **17/17** (15 ca cũ + HZ-03 + HZ-04).

- [ ] **Step 9: Chạy regression**

```powershell
Start-Process cmd.exe -ArgumentList '/c','backend\scripts\run-regression.cmd vina_regr_split' -WindowStyle Hidden
```

Expected: 40/40.

- [ ] **Step 10: Commit**

```bash
git add backend/src/app.js start-dev.ps1 sw.js backend/scripts/check-frontend.js js/00-khoi-dong.js index.html backend/tests/ui/cases/09-ha-tang-js.js backend/tests/ui/all.test.js
git commit -m "Ha tang: phuc vu thu muc js/ va 2 ca kiem thu bao ve dot tach

Mot mount tinh /js trong app.js, start-dev.ps1 chep ca thu muc sang web-public,
sw.js cache /js/*, check-frontend.js kiem cu phap js/*.js va doi chieu ba danh
sach (script src / SHELL_FILES / bo loc fetch). Chuyen khoi dang ky service
worker ra js/00-khoi-dong.js de thu duong phuc vu. UI 17/17, regression 40/40.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 4: Giai đoạn 1 — tách 6 khối nội tuyến còn lại ra file, nguyên văn

**Files:**
- Create: `js/01-core.js`, `js/02-glue-sau-api.js`, `js/03-font-fix.js`, `js/04-tinh-nang-2.js`, `js/05-glue-cuoi.js`, `js/06-tinh-nang-3.js` (tên tạm theo thứ tự; Task 6 mới đổi thành tên theo tính năng)
- Modify: `index.html` (mỗi khối nội tuyến → một thẻ `<script src>`)
- Modify: `sw.js` (`SHELL_FILES` thêm 6 tệp)

**Interfaces:**
- Consumes: `node backend/scripts/check-split.js <commit> --bytes` từ Task 2; `jsUnits.js` không dùng ở task này.
- Produces: `index.html` không còn khối JS nội tuyến nào; thứ tự nạp: `js/01-core.js` → `api.js` → `js/00-khoi-dong.js` → `js/02…` → … (đúng thứ tự xuất hiện cũ).

- [ ] **Step 1: Dùng lại `BASE_SPLIT` đã ghi ở Task 3 Step 0**

Không lấy `git rev-parse HEAD` mới: HEAD bây giờ đã là commit của Task 3 (đã dời một khối), so với nó thì không còn chứng minh được gì. Dùng đúng mốc "toàn bộ JS còn nội tuyến".

- [ ] **Step 2: Viết script tách một lần (đặt trong thư mục nháp, không commit)**

```js
// %TEMP%\tach-inline.js — tách từng khối <script> nội tuyến của index.html ra file js/,
// giữ nguyên văn từng byte, thay khối bằng thẻ <script src>.
const fs = require('fs');
const path = require('path');
const ROOT = 'D:/Setup/QLGS-HeThong/ChatGPT/VINA-SUPERVISION-MVP-02';
const ten = ['01-core.js', '02-glue-sau-api.js', '03-font-fix.js', '04-tinh-nang-2.js', '05-glue-cuoi.js', '06-tinh-nang-3.js'];
let html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const re = /<script>([\s\S]*?)<\/script>/g; // chỉ khối không có thuộc tính (nội tuyến)
const khoi = [...html.matchAll(re)];
if (khoi.length !== ten.length) throw new Error('Số khối nội tuyến (' + khoi.length + ') khác số tên file (' + ten.length + ')');
for (let i = khoi.length - 1; i >= 0; i--) {
  const m = khoi[i];
  fs.writeFileSync(path.join(ROOT, 'js', ten[i]), m[1], 'utf8');
  html = html.slice(0, m.index) + `<script src="./js/${ten[i]}"></script>` + html.slice(m.index + m[0].length);
}
fs.writeFileSync(path.join(ROOT, 'index.html'), html, 'utf8');
console.log('Da tach ' + khoi.length + ' khoi');
```

- [ ] **Step 3: Chạy script tách**

Run: `node %TEMP%\tach-inline.js`
Expected: `Da tach 6 khoi`. Nếu báo lệch số khối: đếm lại bằng `node backend/scripts/check-split.js HEAD --list | wc -l` và sửa mảng `ten` cho đúng, **không** đổi biểu thức tìm khối thành thứ gì khớp cả `src=`.

- [ ] **Step 4: Cập nhật `SHELL_FILES` trong `sw.js`**

```js
const SHELL_FILES = ['./', './api.js', './favicon.ico', './js/00-khoi-dong.js', './js/01-core.js', './js/02-glue-sau-api.js', './js/03-font-fix.js', './js/04-tinh-nang-2.js', './js/05-glue-cuoi.js', './js/06-tinh-nang-3.js'];
```

- [ ] **Step 5: Chứng minh không mất một byte nào**

Run: `node backend\scripts\check-split.js <BASE_SPLIT> --bytes`
Expected: `KHỚP TỪNG BYTE: 7 khối trước → 7 phần sau, <N> byte`. Nếu lệch: script in vị trí và 120 ký tự quanh đó — sửa cho khớp, tuyệt đối không chỉnh khẳng định.

- [ ] **Step 6: Kiểm cú pháp và ba danh sách**

Run: `node backend\scripts\check-frontend.js`
Expected: `0 khối script nội tuyến, 7 tệp js/, 0 lỗi, build 2026-10-07.1`.

- [ ] **Step 7: Chạy bộ giao diện và regression**

```powershell
Start-Process cmd.exe -ArgumentList '/c','backend\scripts\run-ui-tests.cmd vina_ui_claude' -WindowStyle Hidden
```

Expected: 17/17.

```powershell
Start-Process cmd.exe -ArgumentList '/c','backend\scripts\run-regression.cmd vina_regr_split' -WindowStyle Hidden
```

Expected: 40/40.

- [ ] **Step 8: Thử ngoại tuyến một lần bằng tay (điều kiện của spec mục 8)**

Chạy backend thử trên cổng 3102 với CSDL thử rồi mở trong browser pane, hoặc dùng chính lượt chạy kiểm thử: mở trang, chặn mạng bằng `page.context().setOffline(true)` trong một lần chạy thử tay, tải lại, khẳng định trang vẫn mở được (service worker đã cache `js/*`). Ghi kết quả vào ghi chú task; nếu trang trắng khi ngoại tuyến thì thiếu tệp trong `SHELL_FILES` — sửa rồi thử lại.

- [ ] **Step 9: Commit**

```bash
git add index.html sw.js js/
git commit -m "Tach index.html: 6 khoi script noi tuyen -> 6 tep trong js/ (nguyen van)

index.html khong con JS noi tuyen; thu tu nap giu nguyen nhu cu. Da chung minh
bang check-split.js --bytes: khop tung byte. UI 17/17, regression 40/40.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 5: Bảng phân bổ đơn vị mã vào 12 file theo tính năng

**Files:**
- Create: `%TEMP%\phan-bo.json` (bảng phân bổ, thư mục nháp — không commit)

**Interfaces:**
- Consumes: `node backend/scripts/check-split.js HEAD --list` (Task 2).
- Produces: `phan-bo.json` dạng `{ "<tên đơn vị>": "<tên file đích>" }` phủ **đúng một lần** mọi đơn vị, dùng bởi Task 6.

- [ ] **Step 1: Lấy danh sách đơn vị hiện có**

Run: `node backend\scripts\check-split.js HEAD --list > %TEMP%\units.txt`
Rồi đọc file: mỗi dòng là `<tên>\t<file>\t<byte>`. Ghi lại tổng số đơn vị.

- [ ] **Step 2: Lập bảng phân bổ theo mục 5 của spec**

Tên file đích (12 file, tiền tố số = thứ tự nạp, giữ đúng thứ tự tương đối cũ):
`01-core.js`, `02-quyen.js`, `03-cong-trinh.js`, `04-tien-do.js`, `05-nhat-ky.js`, `06-ho-so-bao-cao.js`, `07-chat-luong.js`, `08-nhan-su.js`, `09-duyet.js`, `10-thung-rac.js`, `11-tong-quan.js`, `12-dang-nhap.js`.

Quy tắc phân bổ (đúng như spec mục 5):
- Hàm/biến tên khớp nhóm nào thì vào file nhóm đó (ví dụ `renderLogs`, `logAction`, `openLog`, `saveLog`, `syncDailyLogsFromApi`, `LOG_STATUS` → `05-nhat-ky.js`).
- Không rõ thuộc nhóm nào → để `01-core.js`.
- **Câu lệnh top-level** (đơn vị mà `unitName` trả về đoạn văn bản chứ không phải tên) giữ **đúng vị trí tương đối cũ**: gán vào file có số thứ tự bằng hoặc lớn hơn mọi đơn vị nó phụ thuộc; mặc định `12-dang-nhap.js` (nạp cuối) nếu không chắc.

Ví dụ cụ thể cho các trường hợp dễ nhầm (dùng làm mẫu khi gán phần còn lại):

| Đơn vị | File đích | Vì sao |
|---|---|---|
| `esc`, `fmt`, `db`, `save`, `goPage`, `renderAll`, `openModal` | `01-core.js` | Dùng ở khắp mọi tính năng |
| `defaultPermsFor`, `LEAD_DEFAULT_PERMS`, `isLeadTitle`, `PERM_LABELS`, `myPerms` | `02-quyen.js` | Bản sao quyền phía client — giữ cùng một chỗ để đối chiếu với `permissionService.js` |
| `deleteBtn` | `02-quyen.js` | Là hàm quyền (quyết định có hiện nút Xóa), không phải hàm của Thùng rác |
| `DELETE_API`, `deleteContent`, `confirmDeleteContent` | `10-thung-rac.js` | Luồng xóa → Thùng rác |
| `reviewBlockHtml`, `returnedChip` | `09-duyet.js` | Dùng bởi cả nhật ký và hồ sơ, nhưng thuộc nghiệp vụ duyệt |
| `permEditorHtml`, `refreshPermDefaults` | `08-nhan-su.js` | Là giao diện trang Nhân sự, dù nội dung nói về quyền |
| `syncDailyLogsFromApi` | `05-nhat-ky.js` | Đồng bộ dữ liệu của chính tính năng đó |
| `checkServerMigrations`, `APP_BUILD`, `forcePasswordChange` | `12-dang-nhap.js` | Khởi động + phiên đăng nhập, nạp cuối |

Viết `phan-bo.json` theo danh sách ở Step 1 (số khoá bằng đúng số dòng của `units.txt`, dự kiến khoảng 250–270).

- [ ] **Step 3: Kiểm bảng phân bổ trước khi di chuyển bất cứ thứ gì**

```js
// %TEMP%\kiem-phan-bo.js
const fs = require('fs');
const map = JSON.parse(fs.readFileSync(process.env.TEMP + '\\phan-bo.json', 'utf8'));
const dong = fs.readFileSync(process.env.TEMP + '\\units.txt', 'utf8').trim().split('\n');
const ten = dong.map(l => l.split('\t')[0]);
const thieu = ten.filter(t => !(t in map));
const la = Object.keys(map).filter(k => !ten.includes(k));
const kich = {};
for (const l of dong) { const [t, , b] = l.split('\t'); kich[map[t]] = (kich[map[t]] || 0) + Number(b); }
console.log('Tong don vi:', ten.length, '| chua gan:', thieu.length, '| gan cho don vi khong ton tai:', la.length);
if (thieu.length) console.log('CHUA GAN:', thieu.slice(0, 30).join(', '));
if (la.length) console.log('LA:', la.slice(0, 30).join(', '));
for (const [f, b] of Object.entries(kich).sort()) console.log(`  ${f}: ${Math.round(b / 1024)} KB`);
```

Run: `node %TEMP%\kiem-phan-bo.js`
Expected: `chua gan: 0`, `gan cho don vi khong ton tai: 0`, và **mọi file ≤ ~35 KB**. Nếu một file quá lớn, chia lại nhóm đó theo spec (ví dụ tách `06-ho-so-bao-cao.js` thành hồ sơ và báo cáo) và ghi thay đổi vào ghi chú task.

- [ ] **Step 4: Ghi lại bảng vào ghi chú task**

Không commit `phan-bo.json` (công cụ dùng một lần). Ghi vào ghi chú task: tổng số đơn vị, kích thước dự kiến từng file — để Task 6 đối chiếu.

---

### Task 6: Giai đoạn 2 — di chuyển mã vào 12 file theo tính năng

**Files:**
- Create/Modify: `js/01-core.js` … `js/12-dang-nhap.js`
- Delete: các tên tạm của Task 4 (`js/02-glue-sau-api.js`, `js/03-font-fix.js`, `js/04-tinh-nang-2.js`, `js/05-glue-cuoi.js`, `js/06-tinh-nang-3.js`) sau khi mã đã dời hết
- Modify: `index.html` (danh sách thẻ `<script src>` theo thứ tự mới), `sw.js` (`SHELL_FILES`)

**Interfaces:**
- Consumes: `phan-bo.json` (Task 5), `splitTopLevel`/`unitName` (Task 1), `check-split.js` (Task 2).
- Produces: 12 tệp `js/*.js`, mỗi tệp ≤ ~35 KB; `index.html` nạp chúng theo thứ tự số.

- [ ] **Step 1: Viết script di chuyển (thư mục nháp, không commit)**

```js
// %TEMP%\di-chuyen.js — dời từng đơn vị top-level sang file đích theo phan-bo.json.
// Giữ nguyên văn từng đơn vị; chỉ thay đổi đơn vị nằm ở file nào và thứ tự trong file đích
// (thứ tự trong file đích = thứ tự xuất hiện ban đầu, nên mã phụ thuộc nhau vẫn đúng chiều).
const fs = require('fs');
const path = require('path');
const ROOT = 'D:/Setup/QLGS-HeThong/ChatGPT/VINA-SUPERVISION-MVP-02';
const { splitTopLevel, unitName } = require(path.join(ROOT, 'backend/scripts/lib/jsUnits'));
const map = JSON.parse(fs.readFileSync(process.env.TEMP + '\\phan-bo.json', 'utf8'));
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const srcs = [...html.matchAll(/<script\b[^>]*src="\.\/js\/([^"]+)"/g)].map(m => m[1]);

const dich = new Map(); // tên file đích -> mảng đơn vị
let chuaGan = 0;
for (const f of srcs) {
  const code = fs.readFileSync(path.join(ROOT, 'js', f), 'utf8');
  for (const u of splitTopLevel(code)) {
    if (!u.trim()) continue;
    const t = map[unitName(u)];
    if (!t) { chuaGan++; continue; }
    if (!dich.has(t)) dich.set(t, []);
    dich.get(t).push(u);
  }
}
if (chuaGan) throw new Error(chuaGan + ' don vi chua co trong phan-bo.json — dung lai');
for (const [f, units] of dich) fs.writeFileSync(path.join(ROOT, 'js', f), units.join(''), 'utf8');
console.log('Da ghi ' + dich.size + ' tep dich');
```

- [ ] **Step 2: Chạy script di chuyển**

Run: `node %TEMP%\di-chuyen.js`
Expected: `Da ghi 12 tep dich`. Nếu ném "chưa có trong phan-bo.json": quay lại Task 5 Step 3, không sửa script để bỏ qua đơn vị.

- [ ] **Step 3: Xoá tệp tạm và cập nhật thẻ `<script src>` trong `index.html`**

Xoá các tệp tạm đã rỗng nội dung (`js/02-glue-sau-api.js`, `js/03-font-fix.js`, `js/04-tinh-nang-2.js`, `js/05-glue-cuoi.js`, `js/06-tinh-nang-3.js`) nếu không còn trong bảng phân bổ, rồi sửa `index.html` để nạp đúng thứ tự:

```html
<script src="./js/01-core.js"></script>
<script src="./js/02-quyen.js"></script>
<script src="./api.js"></script>
<script src="./js/00-khoi-dong.js"></script>
<script src="./js/03-cong-trinh.js"></script>
<script src="./js/04-tien-do.js"></script>
<script src="./js/05-nhat-ky.js"></script>
<script src="./js/06-ho-so-bao-cao.js"></script>
<script src="./js/07-chat-luong.js"></script>
<script src="./js/08-nhan-su.js"></script>
<script src="./js/09-duyet.js"></script>
<script src="./js/10-thung-rac.js"></script>
<script src="./js/11-tong-quan.js"></script>
<script src="./js/12-dang-nhap.js"></script>
```

Vị trí của `api.js` và `js/00-khoi-dong.js` giữ **đúng chỗ tương đối như trước** (sau khối lớn đầu tiên): `01-core.js` và `02-quyen.js` là phần đầu của khối cũ nên đứng trước `api.js`; mọi thứ còn lại đứng sau.

Ghi chú về ranh giới `api.js`: `api.js` chỉ **khai báo** (`API_BASE`, `AUTH_KEY`, `getAuthToken`, `apiRequest`…), không gọi mã ứng dụng lúc nạp — nên việc một hàm của khối cũ (trước `api.js`) giờ nằm ở tệp nạp **sau** `api.js` là an toàn. Chỉ có **câu lệnh top-level** chạy ngay lúc nạp mới cần đúng thứ tự; nếu một câu lệnh như vậy cần `apiRequest`, nó phải nằm ở tệp sau `api.js` — đúng chiều hiện tại, không cần làm gì thêm.

- [ ] **Step 4: Cập nhật `SHELL_FILES` trong `sw.js`**

```js
const SHELL_FILES = ['./', './api.js', './favicon.ico', './js/00-khoi-dong.js', './js/01-core.js', './js/02-quyen.js', './js/03-cong-trinh.js', './js/04-tien-do.js', './js/05-nhat-ky.js', './js/06-ho-so-bao-cao.js', './js/07-chat-luong.js', './js/08-nhan-su.js', './js/09-duyet.js', './js/10-thung-rac.js', './js/11-tong-quan.js', './js/12-dang-nhap.js'];
```

- [ ] **Step 5: Chứng minh không mất mã và không sửa nội dung**

Run: `node backend\scripts\check-split.js <BASE_SPLIT>`
Expected: `KHỚP TẬP ĐƠN VỊ: <N> đơn vị khác nhau, không thiếu, không thừa, không sửa nội dung`. Nếu in THIẾU/THỪA cùng một tên → nội dung đơn vị đó bị sửa, phải hoàn lại đúng nguyên văn.

- [ ] **Step 6: Kiểm cú pháp, ba danh sách, và kích thước tệp**

Run: `node backend\scripts\check-frontend.js`
Expected: `0 khối script nội tuyến, 13 tệp js/, 0 lỗi, build 2026-10-07.1`.
Run: `node -e "const fs=require('fs');for(const f of fs.readdirSync('js').sort())console.log(f, Math.round(fs.statSync('js/'+f).size/1024)+' KB')"`
Expected: mọi tệp ≤ ~35 KB.

- [ ] **Step 7: Chạy bộ giao diện và regression**

```powershell
Start-Process cmd.exe -ArgumentList '/c','backend\scripts\run-ui-tests.cmd vina_ui_claude' -WindowStyle Hidden
```

Expected: 17/17. Nếu một ca đỏ vì lỗi console (HZ-04) → có câu lệnh top-level gọi hàm của file nạp sau: chuyển câu lệnh đó xuống `js/12-dang-nhap.js`, chạy lại `check-split.js` (tập đơn vị không đổi nên vẫn phải KHỚP) rồi chạy lại bộ giao diện.

```powershell
Start-Process cmd.exe -ArgumentList '/c','backend\scripts\run-regression.cmd vina_regr_split' -WindowStyle Hidden
```

Expected: 40/40.

- [ ] **Step 8: Commit**

```bash
git add index.html sw.js js/
git commit -m "Tach index.html: gom ma thanh 12 tep js/ theo tinh nang

Di chuyen nguyen khoi tung don vi top-level, khong sua logic. check-split.js
bao tap don vi khong doi so voi truoc khi tach. Moi tep <= 35 KB.
UI 17/17, regression 40/40.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 7: Giai đoạn 3 — tài liệu, bump build, nghiệm thu cuối

**Files:**
- Modify: `docs/CODEMAP.md` (bảng hàm → tệp), `CLAUDE.md` (quy tắc "mã mới đặt ở đâu", cách chạy), `CAP-NHAT-20260926.md`, `KET-QUA-KIEM-THU-20260926.md`
- Modify: `backend/src/build.js`, `index.html` (`APP_BUILD`), `sw.js` (`SHELL_CACHE`)

**Interfaces:**
- Consumes: kết quả Task 6.
- Produces: mốc để đợt sau (nhóm P2 của bộ kiểm thử giao diện) dựa vào.

- [ ] **Step 1: Bump build 3 chỗ**

`backend/src/build.js`: `BUILD: '2026-10-08.1'`; `index.html`: `const APP_BUILD='2026-10-08.1';`; `sw.js`: `const SHELL_CACHE = 'vina-supervision-shell-20261008-v38';`

- [ ] **Step 2: Cập nhật `docs/CODEMAP.md`**

Thay mục "Frontend (index.html) — function groups" bằng bảng tệp → nhóm hàm, giữ nguyên tên hàm đã liệt kê, và thêm câu: "Thứ tự nạp = thứ tự số trong tên tệp; xem các thẻ `<script src>` ở cuối `index.html`. Mã mới đặt vào tệp tính năng tương ứng, không còn khối `<script>` nội tuyến nào."

- [ ] **Step 3: Cập nhật `CLAUDE.md`**

- Mục Frontend: `index.html` giờ là HTML + CSS + thẻ `<script src>`; JS nằm ở `js/01-core.js` … `js/12-dang-nhap.js`; **mã mới vào tệp tính năng tương ứng** (thay quy tắc cũ "đặt vào khối `<script>` cuối").
- Mục Every change checklist: thêm "tệp JS mới trong `js/` phải có thẻ `<script src>` trong `index.html` **và** tên trong `SHELL_FILES` của `sw.js` — `check-frontend.js` sẽ báo nếu thiếu".
- Mục Testing: thêm `node backend\scripts\check-split.js <commit>` (khi di chuyển mã giữa các tệp) và `node --test backend/tests/jsUnits.test.js`.
- Mục Working agreements: đánh dấu đợt tách đã xong; việc kế tiếp là nhóm P2 (12 ca kiểm thử giao diện còn lại).

- [ ] **Step 4: Ghi `CAP-NHAT-20260926.md` (cho người dùng) và `KET-QUA-KIEM-THU-20260926.md`**

`CAP-NHAT`: mục "Đợt 15 (…) — bản 2026-10-08.1: chia nhỏ mã giao diện": nói rõ **không có tính năng nào thay đổi**, chỉ chia tệp để sửa nhanh và ít vỡ hơn; cần `.\run.bat` + Ctrl+F5; nếu mở cổng 8080 thì `run.bat` đã chép lại `web-public\js`.

`KET-QUA`: mục "Đợt 15": số thật của `check-split.js` (byte-equal ở Giai đoạn 1, tập đơn vị không đổi ở Giai đoạn 2), UI 17/17 ×2 lần, regression 40/40, `check-frontend` 0 lỗi, kích thước tệp lớn nhất.

- [ ] **Step 5: Nghiệm thu cuối**

Run: `node backend\scripts\check-frontend.js` → Expected: 0 lỗi, build `2026-10-08.1`.
Run: `node backend\scripts\check-split.js <BASE_SPLIT>` → Expected: KHỚP TẬP ĐƠN VỊ.
Chạy bộ giao diện **hai lần liên tiếp** → Expected: 17/17 cả hai lần.
Chạy regression một lần → Expected: 40/40.
Chạy `.\run.bat` một lần rồi kiểm `web-public\js` có đủ 13 tệp.

- [ ] **Step 6: Commit**

```bash
git add CLAUDE.md docs/CODEMAP.md CAP-NHAT-20260926.md KET-QUA-KIEM-THU-20260926.md backend/src/build.js index.html sw.js
git commit -m "Ban 2026-10-08.1: hoan tat tach index.html + tai lieu

12 tep js/ theo tinh nang, index.html chi con HTML/CSS va the script src.
CODEMAP co bang ham -> tep; CLAUDE.md doi quy tac dat ma moi. Bump build 3 cho.
UI 17/17 (hai lan), regression 40/40, check-split khop tap don vi.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

- [ ] **Step 7: Báo người dùng**

Báo: số thật của từng lệnh kiểm tra, kích thước tệp lớn nhất sau khi chia, build mới, và nhắc chạy `.\run.bat` + Ctrl+F5. Nếu phát hiện lỗi thật của app dọc đường thì liệt kê để người dùng quyết định sửa ở đợt sau.
