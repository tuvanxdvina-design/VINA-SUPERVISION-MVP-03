# Bộ kiểm thử giao diện tự động — Kế hoạch thực thi

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Có 12 ca kiểm thử giao diện chạy bằng một lệnh, khẳng định các luồng người dùng lõi của `index.html` vẫn đúng, làm lưới an toàn cho đợt tách `index.html` sau này.

**Architecture:** Một module dùng chung dựng CSDL thử (tách ra từ `regression.test.js`), một vỏ Playwright chạy Chrome đã cài trên máy, backend thật ở cổng 3103 tự phục vụ `index.html`. Mỗi ca mở một browser context mới (chặn service worker, localStorage sạch), tự tạo dữ liệu qua API rồi thao tác giao diện và khẳng định theo điều người dùng thấy.

**Tech Stack:** Node 24 (CommonJS), `node:test` + `node:assert/strict`, `playwright-core` (`chromium.launch({channel:'chrome'})`), PostgreSQL trong Docker (`vina-supervision-db`), Express 5.

**Spec:** `docs/superpowers/specs/2026-09-28-kiem-thu-giao-dien-design.md`

## Global Constraints

- CommonJS (`backend/package.json` có `"type":"commonjs"`) — dùng `require`, không `import`.
- Chỉ thêm **một** dependency: `playwright-core` ở `devDependencies` của `backend/package.json`. Không cài `@playwright/test`, không tải trình duyệt (`playwright-core` không có postinstall tải browser).
- Trình duyệt: `chromium.launch({ channel: 'chrome', headless: true })` — dùng Chrome cài tại `C:\Program Files\Google\Chrome\Application\chrome.exe`.
- Cổng: UI test = **3103** (3101 = regression, 3102 = người dùng kiểm tra tay, 3001 = backend thật của người dùng — **không bao giờ khởi động lại cổng 3001**).
- CSDL thử mặc định: `vina_ui_claude`, qua `postgres://postgres:postgres@127.0.0.1:5432/<db>`. **Không đọc-ghi `vina_supervision`** (CSDL thật; nếu cần xem thì chỉ SELECT).
- Browser context bắt buộc: `serviceWorkers: 'block'`, context mới cho từng ca.
- Mọi ca phải tự đăng ký handler cho `alert`/`confirm` — app dùng `confirm()` ở `logAction`, `logBulk`, `restoreTrash`, `purgeTrash` và `alert()` ở nhiều chỗ; không có handler thì test treo đến khi hết thời gian chờ.
- Khẳng định theo **điều người dùng thấy** (văn bản hiển thị, nút hiện/ẩn, trạng thái bản ghi). Không khẳng định theo tên hàm nội bộ — đó là điều kiện để bộ test sống sót qua đợt tách `index.html`.
- Selector theo thứ tự ưu tiên: `id` có sẵn → `nav button[data-page="..."]` → nhãn tiếng Việt hiển thị → `data-testid` thêm mới (chỉ khi không còn cách nào).
- Nếu phải sửa `index.html`: bump build **3 chỗ** (`backend/src/build.js` BUILD, `index.html` `const APP_BUILD=`, `sw.js` SHELL_CACHE) rồi chạy `node backend\scripts\check-frontend.js`.
- Môi trường này in ra màn hình không đáng tin: **mọi lệnh dài phải ghi ra file rồi đọc file**. Lệnh chạy lâu thì chạy detached (`Start-Process cmd.exe -ArgumentList '/c', ... -WindowStyle Hidden`) rồi poll file bằng Grep.
- Nếu một ca kiểm thử phát hiện **lỗi thật của app**: dừng lại, báo người dùng, **không tự sửa app** trong phiên viết test.
- Commit bằng tiếng Việt (nội dung + lý do), kết thúc bằng dòng `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>`. Trước khi commit, kiểm tra không có bí mật trong staged (`.env`, `Token*.txt`, `Pas user.xlsx`, `backups/`, `backend/uploads/`).
- Ghi tiếng Việt trong mã nguồn test (tên ca, thông báo assert) để người dùng đọc được file kết quả.

## Selector và nhãn đã xác minh trong `index.html` (không phải phỏng đoán)

| Thứ | Giá trị |
|---|---|
| Trang đăng nhập | `#loginScreen`, `#loginUsername`, `#loginPassword`, `#loginButton`, `#loginError` |
| Khóa phiên | `localStorage['vina_supervision_auth']` = `{token, user, loggedAt}` (`api.js` `setAuthSession`) |
| Nav | `nav button[data-page="dashboard|inbox|projects|daily|docs|issues|reports|people|audit|trash|settings"]`; `inbox` và `trash` mặc định `style="display:none"` |
| Vùng trang | `<section id="dashboard|inbox|trash|projects|daily|docs|issues|reports|people|settings|audit" class="page">`, trang đang mở có class `active` |
| Modal | `#modal` (class `show` khi mở), tiêu đề `#mtitle`, thân `#mbody` |
| Nhật ký | `#newLogButton` ("+ Lập nhật ký"), `#logProject`, `#logsTable`; modal: `#lproj #ldate #lshift #lwork #lworkers #lmachines #lweather`; nút "Lưu nháp", "Lưu và gửi duyệt", "Lưu thay đổi" |
| Nút luồng duyệt trong bảng nhật ký | "Gửi duyệt", "Duyệt", "Trả lại", "Khóa" |
| Hồ sơ | `#docProject`, `#docsTable`; nhãn quyết định: "Duyệt", "Trả lại", "Khóa hồ sơ", "Mở khóa" |
| Việc cần duyệt | `#inboxBody` |
| Thùng rác | `#trashBody`, `#trashFilter`; nút "↩ Khôi phục", "Xóa vĩnh viễn" |
| Modal xóa | `#delReason` (nhãn "Lý do xóa (bắt buộc)") |
| Nhân sự | modal có `#tmTitle` (chức danh), `#tmPermWrap`, `#tmDefaultsText`, checkbox `.tmPerm`, radio `input[name="tmPermMode"]` (`DEFAULT`/`CUSTOM`), nút "Lưu thay đổi" |
| Nhãn quyền | `PERM_LABELS = {VIEW:'Xem',CREATE:'Thêm',EDIT:'Sửa',DOWNLOAD:'Tải xuống / in',APPROVE:'Duyệt',DELETE:'Xóa'}` |
| Buộc đổi mật khẩu | `window.forcePasswordChange()`, cờ `window.__forcePw`, tiêu đề modal "Đổi mật khẩu ban đầu", có nút "Đăng xuất"; `openModal`/`closeModal` bị vô hiệu khi `__forcePw` |
| Banner lệch build | `#buildBanner` (chèn đầu `main` khi `/health` trả build khác `APP_BUILD`) |
| Cảnh báo dashboard | phần tử có `onclick="goAlertTarget(...)"` trong `#dashboard` |

## Review Focus

Năm cách bộ test này có thể **xanh giả hoặc hỏng mơ hồ** — mỗi dòng có một test/đoạn kiểm tra gắn vào task sở hữu nó:

1. **Service worker hoặc `localStorage` sót giữa các ca** → ca xanh nhờ trạng thái của ca trước. Test: Task 2, ca `HZ-01` khẳng định `navigator.serviceWorker.controller === null` và `localStorage` chỉ chứa khóa do ca hiện tại đặt.
2. **`alert()`/`confirm()` không được xử lý** → test treo 15 giây rồi báo lỗi vô nghĩa "timeout". Test: Task 2 helper ghi mọi dialog vào `page.__dialogs`; ca `HZ-02` cố tình gọi một hành động có `confirm()` và khẳng định `page.__dialogs` có nội dung.
3. **Cổng 3103 hoặc CSDL `vina_ui_claude` đang bị chiếm** (chạy song song với regression, hoặc lần chạy trước chết giữa đường) → lỗi Postgres/EADDRINUSE khó hiểu. Kiểm tra: Task 2 `assertPortFree` báo lỗi tiếng Việt rõ ràng trước khi dựng CSDL.
4. **Không mở được Chrome** (máy khác không có Chrome, hoặc Chrome vừa cập nhật) → lỗi thô từ Playwright. Kiểm tra: Task 2 bọc `chromium.launch` trong try/catch, thông báo kèm cách dự phòng `npx playwright install chromium`.
5. **Selector khớp phần tử đang bị ẩn** (`nav button[data-page="inbox"]` luôn tồn tại trong DOM, chỉ `display:none`) → ca "ẩn nav" xanh sai. Quy tắc: mọi khẳng định hiện/ẩn dùng `isVisible()`, không dùng `count()`; áp dụng ở Task 3 ca GD-03 và mọi ca kiểm tra nút.

---

### Task 1: Tách module dựng CSDL thử dùng chung

**Files:**
- Create: `backend/tests/lib/testDb.js`
- Modify: `backend/tests/regression.test.js:11-99` (phần helper + `test.before`)
- Test: chính `backend/tests/regression.test.js` (chạy lại toàn bộ, số ca pass không đổi)

**Interfaces:**
- Consumes: không có (task đầu).
- Produces: `createTestDb(dbUrl)` trả về `{ dbName, psql, psqlFile, setupAll, startServer, waitHealth }`:
  - `psql(sql, url = dbUrl) -> string` (đã trim)
  - `psqlFile(absPath) -> void`
  - `setupAll() -> void` (reset CSDL → pgcrypto → `schema-VINA-PROD-01.sql` → migration `< 20260926` → bảng `project_member_access` → dữ liệu lỗi giống thực tế → migration `>= 20260926`)
  - `startServer({ port }) -> ChildProcess`
  - `waitHealth(baseUrl, tries = 40) -> Promise<void>`

- [ ] **Step 1: Ghi lại số ca pass hiện tại làm mốc**

Chạy detached rồi đọc file (khoảng 2 phút):

```powershell
Start-Process cmd.exe -ArgumentList '/c','backend\scripts\run-regression.cmd vina_regr_base' -WindowStyle Hidden
```

Poll `backend\tests\last-regression.txt` bằng Grep `ℹ pass|ℹ fail|✖|EXIT`. Ghi con số pass/fail vào ghi chú của task — đây là mốc phải giữ nguyên.

- [ ] **Step 2: Tạo `backend/tests/lib/testDb.js`**

Chuyển **nguyên trạng** logic đang có trong `regression.test.js` (dòng 11–99), không đổi hành vi:

```js
// Dựng CSDL thử và khởi động backend cho các bộ kiểm thử (regression + giao diện).
// Tách ra từ regression.test.js để hai bộ dùng chung một cách dựng dữ liệu.
const { execFileSync, spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const ROOT = path.resolve(__dirname, '..', '..', '..');
const CONTAINER = 'vina-supervision-db';

function hasNativePsql() {
  try { execFileSync('psql', ['--version'], { stdio: 'ignore' }); return true; } catch (_) { return false; }
}
const nativePsql = hasNativePsql();
const dbFromUrl = (url) => new URL(url).pathname.slice(1);
const dbUserFromUrl = (url) => decodeURIComponent(new URL(url).username);

function createTestDb(dbUrl) {
  const u = new URL(dbUrl);
  const dbName = u.pathname.slice(1);
  const adminUrl = new URL(dbUrl); adminUrl.pathname = '/postgres';

  function psql(sql, url = dbUrl) {
    if (nativePsql) return execFileSync('psql', [url, '-v', 'ON_ERROR_STOP=1', '-qtA', '-c', sql], { encoding: 'utf8' }).trim();
    return execFileSync('docker', ['exec', CONTAINER, 'psql', '-U', dbUserFromUrl(url), '-d', dbFromUrl(url), '-v', 'ON_ERROR_STOP=1', '-qtA', '-c', sql], { encoding: 'utf8' }).trim();
  }

  function psqlFile(file) {
    if (nativePsql) { execFileSync('psql', [dbUrl, '-v', 'ON_ERROR_STOP=1', '-q', '-f', file], { stdio: 'pipe' }); return; }
    const remote = '/tmp/vina-test-' + path.basename(file);
    execFileSync('docker', ['cp', file, CONTAINER + ':' + remote], { stdio: 'pipe' });
    try { execFileSync('docker', ['exec', CONTAINER, 'psql', '-U', dbUserFromUrl(dbUrl), '-d', dbName, '-v', 'ON_ERROR_STOP=1', '-q', '-f', remote], { stdio: 'pipe' }); }
    finally { try { execFileSync('docker', ['exec', CONTAINER, 'rm', '-f', remote], { stdio: 'ignore' }); } catch (_) {} }
  }

  function resetDatabase() {
    if (nativePsql) {
      psql('DROP DATABASE IF EXISTS ' + dbName, adminUrl.href);
      psql('CREATE DATABASE ' + dbName, adminUrl.href);
      return;
    }
    execFileSync('docker', ['exec', CONTAINER, 'dropdb', '-U', 'postgres', '--if-exists', dbName], { stdio: 'pipe' });
    execFileSync('docker', ['exec', CONTAINER, 'createdb', '-U', 'postgres', '-O', dbUserFromUrl(dbUrl), dbName], { stdio: 'pipe' });
  }

  function migrationFiles() {
    return fs.readdirSync(path.join(ROOT, 'migrations')).filter(f => /^\d{8}_.+\.sql$/.test(f)).sort();
  }

  // Dữ liệu lỗi giống thực tế (nhân sự trùng tên NFD/khoảng trắng, nhật ký không có ca, mã ca MORNING…)
  function seedRealisticMess() {
    const nfd = 'Nguyễn Thành B'.normalize('NFD');
    psql(`
    INSERT INTO users (username,email,password_hash,full_name,role_id) SELECT 'admin','a@x','demo_hash','Admin',id FROM roles WHERE name='ADMIN';
    INSERT INTO users (username,email,password_hash,full_name,role_id) SELECT 'thanhb','b@x','demo_hash','Nguyễn Thành B',id FROM roles WHERE name='ENGINEER';
    INSERT INTO project_members(project_id,user_id,role_id,assigned_by) SELECT p.id,u.id,u.role_id,u.id FROM projects p,users u WHERE p.contract_no='001' AND u.username='admin';
    INSERT INTO project_members(project_id,user_id,role_id) SELECT p.id,u.id,u.role_id FROM projects p,users u WHERE p.contract_no='001' AND u.username='thanhb';
    INSERT INTO project_personnel(project_id,full_name,assignment_title,certificate,updated_at) SELECT id,'${nfd}','TVGS trưởng','CC-1',NOW()-interval '1 day' FROM projects WHERE contract_no='001';
    INSERT INTO project_personnel(project_id,full_name,assignment_title) SELECT id,'Nguyễn  Thành B','GS viên' FROM projects WHERE contract_no='001';
    INSERT INTO project_personnel(project_id,full_name,assignment_title) SELECT id,'Trần Văn C','GS hiện trường' FROM projects WHERE contract_no='001';
    INSERT INTO daily_logs(project_id,log_date,shift,work_summary,created_by) SELECT p.id,'2026-09-18','MORNING','seed',u.id FROM projects p,users u WHERE p.contract_no='001' AND u.username='hung';
    INSERT INTO daily_logs(project_id,log_date,work_summary,created_by) SELECT p.id,'2026-09-21','a',u.id FROM projects p,users u WHERE p.contract_no='001' AND u.username='hung';
    INSERT INTO daily_logs(project_id,log_date,work_summary,created_by) SELECT p.id,'2026-09-21','b',u.id FROM projects p,users u WHERE p.contract_no='001' AND u.username='son';
    INSERT INTO documents(project_id,type,auto_code,name,created_by) SELECT p.id,'BB','BB-001-001','seed',u.id FROM projects p,users u WHERE p.contract_no='001' AND u.username='hung';
    `);
  }

  function setupAll() {
    resetDatabase();
    psql('CREATE EXTENSION IF NOT EXISTS pgcrypto');
    psqlFile(path.join(ROOT, 'schema-VINA-PROD-01.sql'));
    const all = migrationFiles();
    for (const f of all.filter(f => f < '20260926')) psqlFile(path.join(ROOT, 'migrations', f));
    psql(`CREATE TABLE IF NOT EXISTS project_member_access (project_member_id uuid PRIMARY KEY REFERENCES project_members(id) ON DELETE CASCADE, access_permissions jsonb NOT NULL DEFAULT '["VIEW"]'::jsonb, work_scope text, updated_at timestamptz NOT NULL DEFAULT NOW())`);
    seedRealisticMess();
    for (const f of all.filter(f => f >= '20260926')) psqlFile(path.join(ROOT, 'migrations', f));
  }

  function startServer({ port }) {
    return spawn(process.execPath, ['server.js'], {
      cwd: path.join(ROOT, 'backend'),
      env: {
        ...process.env, PORT: String(port), HOST: '127.0.0.1', NODE_ENV: 'development',
        DB_HOST: u.hostname, DB_PORT: u.port || '5432',
        DB_USER: decodeURIComponent(u.username), DB_PASSWORD: decodeURIComponent(u.password), DB_NAME: dbName
      },
      stdio: 'ignore'
    });
  }

  async function waitHealth(baseUrl, tries = 40) {
    for (let i = 0; i < tries; i++) {
      try { if ((await fetch(baseUrl + '/health')).ok) return; } catch (_) {}
      await new Promise(r => setTimeout(r, 250));
    }
    throw new Error('Backend không phản hồi /health ở ' + baseUrl + ' — xem backend/runtime.stderr.log');
  }

  return { dbName, psql, psqlFile, setupAll, startServer, waitHealth, ROOT };
}

module.exports = { createTestDb };
```

- [ ] **Step 3: Kiểm tra cú pháp module mới**

Run: `node --check backend/tests/lib/testDb.js`
Expected: không in gì, exit 0.

- [ ] **Step 4: Sửa `regression.test.js` dùng module**

Thay khối helper (dòng ~11–99) bằng:

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const fs = require('fs');
const { createTestDb } = require('./lib/testDb');

const DB_URL = process.env.TEST_DB_URL;
const PORT = 3101;
const BASE = `http://127.0.0.1:${PORT}`;
if (!DB_URL) { console.log('Bỏ qua: chưa đặt TEST_DB_URL'); process.exit(0); }
const db = createTestDb(DB_URL);
const psql = db.psql;
const ROOT = db.ROOT;

let server; const tokens = {}; let P = {};
// (giữ nguyên hàm api(...) hiện có)

test.before(async () => {
  db.setupAll();
  server = db.startServer({ port: PORT });
  await db.waitHealth(BASE);
  for (const who of ['admin', 'thanhb', 'hung', 'son', 'tuan', 'duong']) {
    const r = await api('POST', '/auth/login', { username: who, password: 'demo' }, null);
    assert.equal(r.status, 200, 'Khong dang nhap duoc ' + who + ': ' + JSON.stringify(r.body));
    tokens[who] = r.body.token;
  }
  const projectResponse = await api('GET', '/projects');
  assert.equal(projectResponse.status, 200, 'Khong tai duoc cong trinh: ' + JSON.stringify(projectResponse.body));
  P = Object.fromEntries(projectResponse.body.map(p => [p.contract_no, p.id]));
});
```

Giữ nguyên mọi `test(...)` phía sau, giữ nguyên `test.after`. Lưu ý: các ca sau vẫn dùng `psql(...)`, `ROOT`, `P`, `api` — đã khai báo lại ở trên nên không phải sửa.

- [ ] **Step 5: Kiểm tra cú pháp**

Run: `node --check backend/tests/regression.test.js`
Expected: exit 0.

- [ ] **Step 6: Chạy lại toàn bộ regression và so với mốc ở Step 1**

```powershell
Start-Process cmd.exe -ArgumentList '/c','backend\scripts\run-regression.cmd vina_regr_after' -WindowStyle Hidden
```

Poll `backend\tests\last-regression.txt`. Expected: số pass **bằng** Step 1, `fail 0`, `EXIT 0`. Nếu lệch một ca cũng phải dừng và tìm nguyên nhân, không đi tiếp.

- [ ] **Step 7: Commit**

```bash
git add backend/tests/lib/testDb.js backend/tests/regression.test.js
git commit -m "Test: tach module dung chung dung CSDL thu (testDb.js)

De bo kiem thu giao dien dung lai dung mot cach dung du lieu voi regression.
Khong doi hanh vi: da chay lai toan bo regression, so ca pass khong doi.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 2: Hạ tầng kiểm thử giao diện + ca đầu tiên (GD-01) + 2 ca chống xanh giả

**Files:**
- Modify: `backend/package.json` (devDependencies + script `test:ui`)
- Create: `backend/tests/ui/helpers.js`
- Create: `backend/tests/ui/01-dang-nhap.test.js`
- Create: `backend/scripts/run-ui-tests.cmd`
- Create: `backend/scripts/ui-ctx.js` (công cụ trích ngữ cảnh quanh một chuỗi trong `index.html`)
- Modify: `.gitignore`

**Interfaces:**
- Consumes: `createTestDb(dbUrl)` từ Task 1.
- Produces: từ `backend/tests/ui/helpers.js`:
  - `PORT = 3103`, `BASE = 'http://127.0.0.1:3103'`
  - `startApp() -> Promise<void>` (dựng CSDL, chạy backend, mở Chrome) — gọi trong `test.before`
  - `stopApp() -> Promise<void>` — gọi trong `test.after`
  - `uiTest(name, fn)` — bọc `test()`, tạo context/page mới, tự chụp ảnh khi lỗi
  - `loginViaApi(page, who, password = 'demo') -> Promise<object>` (trả về `user`)
  - `loginViaForm(page, who, password = 'demo') -> Promise<void>`
  - `openPage(page, dataPage) -> Promise<void>` (bấm nav rồi chờ section active)
  - `navVisible(page, dataPage) -> Promise<boolean>`
  - `tokenOf(who, password = 'demo') -> Promise<string>` (token để dựng dữ liệu qua API)
  - `apiAs(token) -> { get(p), post(p, body), patch(p, body), del(p, body) }`
  - `projectIdByContract(token, contractNo) -> Promise<string>`

- [ ] **Step 1: Cài `playwright-core`**

```bash
cd backend && npm install --save-dev playwright-core
```

Kiểm tra: `backend/package.json` có `"devDependencies": { "playwright-core": "^1.63.0" }`. Thêm script:

```json
"scripts": {
  "start": "node server.js",
  "dev": "node --watch server.js",
  "test": "node --test tests/regression.test.js",
  "test:ui": "node --test tests/ui/"
}
```

- [ ] **Step 2: Cập nhật `.gitignore`**

Thêm vào nhóm "Sinh tự động / môi trường":

```
backend/tests/last-ui-test.txt
backend/tests/ui-artifacts/
```

- [ ] **Step 3: Tạo `backend/scripts/ui-ctx.js` (công cụ đọc `index.html` không tốn token)**

```js
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
```

- [ ] **Step 4: Tạo `backend/tests/ui/helpers.js`**

```js
// Vỏ chạy kiểm thử giao diện: dựng CSDL thử, chạy backend cổng 3103, mở Chrome đã cài trên máy.
// Mỗi ca dùng một browser context riêng (localStorage sạch, chặn service worker).
const test = require('node:test');
const assert = require('node:assert/strict');
const net = require('net');
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright-core');
const { createTestDb } = require('../lib/testDb');

const PORT = 3103;
const BASE = `http://127.0.0.1:${PORT}`;
const DB_URL = process.env.UI_TEST_DB_URL || 'postgres://postgres:postgres@127.0.0.1:5432/vina_ui_claude';
const ART = path.join(__dirname, '..', 'ui-artifacts');

let db = null, server = null, browser = null;

function assertPortFree(port) {
  return new Promise((resolve, reject) => {
    const s = net.createServer();
    s.once('error', () => reject(new Error('Cổng ' + port + ' đang bị chiếm. Có thể lần chạy trước chưa tắt, hoặc bộ regression/kiểm tra tay đang chạy. Tắt tiến trình node đang giữ cổng rồi chạy lại.')));
    s.once('listening', () => s.close(resolve));
    s.listen(port, '127.0.0.1');
  });
}

async function startApp() {
  await assertPortFree(PORT);
  db = createTestDb(DB_URL);
  db.setupAll();
  server = db.startServer({ port: PORT });
  await db.waitHealth(BASE);
  try {
    browser = await chromium.launch({ channel: 'chrome', headless: true });
  } catch (e) {
    throw new Error('Không mở được Chrome (channel=chrome). Máy này cần Google Chrome; nếu không có, chạy "npx playwright install chromium" rồi đổi channel thành mặc định. Lỗi gốc: ' + e.message);
  }
}

async function stopApp() {
  if (browser) await browser.close();
  if (server) server.kill();
}

async function newPage(name) {
  const context = await browser.newContext({ baseURL: BASE, serviceWorkers: 'block', viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  page.setDefaultTimeout(15000);
  page.__dialogs = [];
  page.on('dialog', async d => { page.__dialogs.push(d.message()); await d.accept(); });
  page.__name = name;
  await page.goto('/');
  return page;
}

// Khi một ca lỗi: lưu ảnh chụp + văn bản trang + nội dung hộp thoại để xem lại.
async function dump(page, name) {
  try {
    fs.mkdirSync(ART, { recursive: true });
    const slug = String(name).replace(/[^\w-]+/g, '_').slice(0, 60);
    await page.screenshot({ path: path.join(ART, slug + '.png'), fullPage: true });
    const text = await page.evaluate(() => document.body.innerText.slice(0, 20000));
    fs.writeFileSync(path.join(ART, slug + '.txt'),
      'HOP THOAI: ' + JSON.stringify(page.__dialogs) + '\n\n' + text, 'utf8');
  } catch (_) { /* lỗi khi chụp không được che lỗi thật của ca */ }
}

function uiTest(name, fn) {
  test(name, async () => {
    const page = await newPage(name);
    try {
      await fn(page);
    } catch (e) {
      await dump(page, name);
      throw e;
    } finally {
      await page.context().close();
    }
  });
}

async function loginViaApi(page, who, password = 'demo') {
  const res = await page.request.post(BASE + '/api/auth/login', { data: { username: who, password } });
  assert.equal(res.status(), 200, 'Không đăng nhập được bằng API: ' + who);
  const data = await res.json();
  await page.evaluate(a => localStorage.setItem('vina_supervision_auth', JSON.stringify(a)),
    { token: data.token, user: data.user, loggedAt: new Date().toISOString() });
  await page.reload();
  await page.waitForSelector('nav button[data-page="projects"]', { state: 'visible' });
  return data.user;
}

async function loginViaForm(page, who, password = 'demo') {
  await page.fill('#loginUsername', who);
  await page.fill('#loginPassword', password);
  await page.click('#loginButton');
}

async function openPage(page, dataPage) {
  await page.click(`nav button[data-page="${dataPage}"]`);
  await page.waitForSelector(`#${dataPage}.page.active`, { state: 'visible' });
}

async function navVisible(page, dataPage) {
  return page.locator(`nav button[data-page="${dataPage}"]`).isVisible();
}

function apiAs(token) {
  const headers = { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' };
  const call = async (method, p, body) => {
    const res = await fetch(BASE + '/api' + p, { method, headers, body: body ? JSON.stringify(body) : undefined });
    const ct = res.headers.get('content-type') || '';
    return { status: res.status, body: ct.includes('json') ? await res.json() : null };
  };
  return {
    get: (p) => call('GET', p),
    post: (p, b) => call('POST', p, b),
    patch: (p, b) => call('PATCH', p, b),
    del: (p, b) => call('DELETE', p, b)
  };
}

async function tokenOf(who, password = 'demo') {
  const res = await fetch(BASE + '/api/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: who, password })
  });
  const data = await res.json();
  assert.ok(data.token, 'Không lấy được token của ' + who + ': ' + JSON.stringify(data));
  return data.token;
}

async function projectIdByContract(token, contractNo) {
  const list = (await apiAs(token).get('/projects')).body || [];
  const p = list.find(x => x.contract_no === contractNo);
  assert.ok(p, 'Không thấy công trình có số hợp đồng ' + contractNo);
  return p.id;
}

module.exports = { PORT, BASE, DB_URL, startApp, stopApp, uiTest, loginViaApi, loginViaForm, openPage, navVisible, apiAs, tokenOf, projectIdByContract };
```

- [ ] **Step 5: Tạo `backend/scripts/run-ui-tests.cmd`**

```bat
@echo off
REM Chay kiem thu giao dien tren CSDL thu rieng, ghi ket qua ra backend\tests\last-ui-test.txt
REM Cach dung: backend\scripts\run-ui-tests.cmd [ten_csdl_thu] [mau_ten_ca]
setlocal
set DB=%1
if "%DB%"=="" set DB=vina_ui_claude
set UI_TEST_DB_URL=postgres://postgres:postgres@127.0.0.1:5432/%DB%
cd /d %~dp0..
set OUT=%~dp0..\tests\last-ui-test.txt
echo RUNNING %DATE% %TIME% db=%DB% pattern=%2> "%OUT%"
if "%2"=="" (
  node --test tests/ui/ >> "%OUT%" 2>&1
) else (
  node --test --test-name-pattern "%2" tests/ui/ >> "%OUT%" 2>&1
)
echo EXIT %ERRORLEVEL%>> "%OUT%"
docker exec vina-supervision-db psql -U postgres -d postgres -qc "drop database if exists %DB%" >nul 2>&1
echo DONE>> "%OUT%"
endlocal
```

- [ ] **Step 6: Viết `backend/tests/ui/01-dang-nhap.test.js` với GD-01, HZ-01, HZ-02**

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const { startApp, stopApp, uiTest, loginViaApi, loginViaForm, navVisible } = require('./helpers');

test.before(startApp);
test.after(stopApp);

uiTest('HZ-01 mỗi ca có trạng thái trình duyệt sạch (không service worker, localStorage rỗng)', async (page) => {
  const state = await page.evaluate(() => ({
    sw: !!navigator.serviceWorker && !!navigator.serviceWorker.controller,
    keys: Object.keys(localStorage)
  }));
  assert.equal(state.sw, false, 'service worker phải bị chặn, nếu không ca sau có thể chạy trên bản cache cũ');
  assert.deepEqual(state.keys.filter(k => k.startsWith('vina')), [], 'localStorage phải sạch khi vào ca mới');
});

uiTest('HZ-02 hộp thoại confirm/alert của trình duyệt được tự động xử lý', async (page) => {
  await loginViaApi(page, 'thanhb');
  await page.evaluate(() => { window.confirm('kiểm tra hộp thoại'); });
  assert.ok(page.__dialogs.some(m => m.includes('kiểm tra hộp thoại')),
    'helper phải bắt được hộp thoại; nếu không, các ca bấm Duyệt/Xóa sẽ treo');
});

uiTest('GD-01 đăng nhập: sai mật khẩu bị chặn, đúng thì vào được app', async (page) => {
  await loginViaForm(page, 'hung', 'sai-mat-khau');
  await page.waitForFunction(() => (document.getElementById('loginError')?.textContent || '').trim().length > 0);
  assert.ok(await page.locator('#loginScreen').isVisible(), 'sai mật khẩu thì vẫn phải ở màn hình đăng nhập');
  assert.equal(await navVisible(page, 'projects'), false, 'chưa đăng nhập thì không được thấy thanh nav');

  await page.fill('#loginPassword', 'demo');
  await page.click('#loginButton');
  await page.waitForSelector('nav button[data-page="projects"]', { state: 'visible' });
  assert.equal(await page.locator('#buildBanner').count(), 0, 'không được có banner lệch phiên bản giữa index.html và máy chủ');
  assert.equal(await page.locator('#loginScreen').isVisible(), false, 'đăng nhập đúng thì màn hình đăng nhập phải biến mất');
  assert.equal(await navVisible(page, 'daily'), true, 'vào được app: thấy mục Nhật ký trên thanh nav');
});
```

- [ ] **Step 7: Chạy 3 ca đầu**

```powershell
Start-Process cmd.exe -ArgumentList '/c','backend\scripts\run-ui-tests.cmd vina_ui_claude' -WindowStyle Hidden
```

Poll `backend\tests\last-ui-test.txt` (Grep `pass|fail|EXIT|Error`). Expected: `pass 3`, `fail 0`, `EXIT 0`. Nếu `#loginError` không có nội dung khi sai mật khẩu, chạy `node backend/scripts/ui-ctx.js "loginError"` để xem app hiển thị lỗi ở đâu rồi sửa selector.

- [ ] **Step 8: Chứng minh ca GD-01 thật sự bắt lỗi (chống xanh giả)**

Tạm đổi `'sai-mat-khau'` thành `'demo'` trong GD-01, chạy lại. Expected: **FAIL** (vì đăng nhập thành công nên không có `#loginError`). Trả lại `'sai-mat-khau'`, chạy lại → PASS. Ghi kết quả hai lần chạy vào ghi chú task.

- [ ] **Step 9: Commit**

```bash
git add backend/package.json backend/package-lock.json .gitignore backend/scripts/run-ui-tests.cmd backend/scripts/ui-ctx.js backend/tests/ui/helpers.js backend/tests/ui/01-dang-nhap.test.js
git commit -m "Test giao dien: ha tang Playwright + ca dang nhap (GD-01)

playwright-core dung Chrome cai san (khong tai trinh duyet), backend cong 3103
tren CSDL thu vina_ui_claude, moi ca mot context rieng (chan service worker).
Them 2 ca chong xanh gia: trang thai sach va tu xu ly confirm/alert.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 3: GD-02 buộc đổi mật khẩu ban đầu + GD-03 nav theo vai trò

**Files:**
- Create: `backend/tests/ui/02-tai-khoan-va-nav.test.js`

**Interfaces:**
- Consumes: `startApp`, `stopApp`, `uiTest`, `loginViaApi`, `loginViaForm`, `navVisible`, `tokenOf`, `apiAs` từ `helpers.js`.
- Produces: không có gì cho task sau.

- [ ] **Step 1: Viết hai ca**

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const { startApp, stopApp, uiTest, loginViaApi, loginViaForm, navVisible, tokenOf, apiAs } = require('./helpers');

test.before(startApp);
test.after(stopApp);

uiTest('GD-02 tài khoản mới bị buộc đổi mật khẩu ban đầu, không bỏ qua được', async (page) => {
  const admin = apiAs(await tokenOf('admin'));
  const created = await admin.post('/users', { username: 'gd02.moi', full_name: 'Ca GD02', password: 'TamThoi123', role_name: 'ENGINEER' });
  assert.equal(created.status, 201, 'tạo được tài khoản thử: ' + JSON.stringify(created.body));

  await loginViaForm(page, 'gd02.moi', 'TamThoi123');
  await page.waitForSelector('#modal.show', { state: 'visible' });
  assert.equal(await page.locator('#mtitle').innerText(), 'Đổi mật khẩu ban đầu');

  // Không đóng được: gọi closeModal như người dùng bấm nền/Esc
  await page.evaluate(() => window.closeModal && window.closeModal());
  assert.ok(await page.locator('#modal.show').isVisible(), 'modal buộc đổi mật khẩu không được đóng khi chưa đổi');

  const body = await page.locator('#mbody').innerText();
  assert.ok(body.includes('mật khẩu ban đầu') || body.includes('mật khẩu tạm'), 'phải giải thích vì sao bị buộc đổi');
  assert.ok(await page.locator('#mbody >> text="Đăng xuất"').isVisible(), 'phải có đường thoát: nút Đăng xuất');
});

uiTest('GD-03 thanh nav hiện đúng theo vai trò và quyền', async (page) => {
  // tuan: chưa được phân công công trình nào
  await loginViaApi(page, 'tuan');
  assert.equal(await navVisible(page, 'inbox'), false, 'người không có quyền Duyệt ở đâu cả thì không thấy "Việc cần duyệt"');
  assert.equal(await navVisible(page, 'trash'), false, 'người không có quyền Xóa thì không thấy "Thùng rác"');

  // hung: TVGS trưởng tại công trình 001 → có quyền duyệt
  await page.evaluate(() => localStorage.clear());
  await loginViaApi(page, 'hung');
  assert.equal(await navVisible(page, 'inbox'), true, 'Trưởng TVGS phải thấy "Việc cần duyệt"');

  // admin: thấy đủ
  await page.evaluate(() => localStorage.clear());
  await loginViaApi(page, 'admin');
  assert.equal(await navVisible(page, 'inbox'), true);
  assert.equal(await navVisible(page, 'trash'), true, 'Admin phải thấy "Thùng rác"');
  assert.equal(await navVisible(page, 'settings'), true, 'Admin phải thấy "Thiết lập"');

  // duong: Giám đốc (quản trị cấp công ty)
  await page.evaluate(() => localStorage.clear());
  await loginViaApi(page, 'duong');
  assert.equal(await navVisible(page, 'inbox'), true, 'Giám đốc phải thấy "Việc cần duyệt"');
  assert.equal(await navVisible(page, 'trash'), true, 'Giám đốc phải thấy "Thùng rác"');
});
```

- [ ] **Step 2: Chạy hai ca này**

```powershell
Start-Process cmd.exe -ArgumentList '/c','backend\scripts\run-ui-tests.cmd vina_ui_claude GD-0' -WindowStyle Hidden
```

Expected: các ca `GD-01`, `GD-02`, `GD-03` pass. Nếu GD-02 không thấy `#modal.show`: kiểm tra `POST /users` có trả `must_change_password` và chạy `node backend/scripts/ui-ctx.js "forcePasswordChange"` để xem app gọi lúc nào (đăng nhập hay sau `load`).

- [ ] **Step 3: Chứng minh GD-03 không xanh giả**

Đổi tạm khẳng định của `tuan` từ `false` thành `true`, chạy lại → phải FAIL (chứng tỏ `isVisible()` thật sự đọc được trạng thái ẩn `display:none`). Trả lại `false`.

- [ ] **Step 4: Commit**

```bash
git add backend/tests/ui/02-tai-khoan-va-nav.test.js
git commit -m "Test giao dien: buoc doi mat khau ban dau (GD-02) va nav theo vai tro (GD-03)

Kiem tra modal doi mat khau khong dong duoc va menu Viec can duyet/Thung rac/
Thiet lap chi hien voi nguoi co quyen tuong ung.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 4: GD-04 phạm vi công trình + GD-05 dashboard và cảnh báo

**Files:**
- Create: `backend/tests/ui/03-tong-quan.test.js`

**Interfaces:**
- Consumes: `startApp`, `stopApp`, `uiTest`, `loginViaApi`, `openPage`, `tokenOf`, `apiAs`, `projectIdByContract`.
- Produces: không có gì cho task sau.

- [ ] **Step 1: Xác minh markup cảnh báo trước khi viết ca**

Run: `node backend/scripts/ui-ctx.js "goAlertTarget(" "alertBadge"`
Ghi lại selector thật của thẻ cảnh báo (dự kiến phần tử trong `#dashboard` có `onclick` chứa `goAlertTarget`). Dùng đúng selector đó ở Step 2.

- [ ] **Step 2: Viết hai ca**

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const { startApp, stopApp, uiTest, loginViaApi, openPage } = require('./helpers');

test.before(startApp);
test.after(stopApp);

uiTest('GD-04 thành viên chỉ thấy công trình được phân công', async (page) => {
  await loginViaApi(page, 'thanhb'); // GS viên tại công trình 001
  await openPage(page, 'projects');
  const projects = await page.locator('#projects').innerText();
  assert.ok(projects.includes('001'), 'phải thấy công trình 001 (được phân công)');
  assert.ok(!projects.includes('002') && !projects.includes('003'), 'không được thấy công trình chưa phân công: ' + projects.slice(0, 400));

  const sel = await page.locator('#logProject option').allInnerTexts();
  assert.ok(sel.every(t => !t.includes('002') && !t.includes('003')), 'ô chọn công trình ở Nhật ký cũng chỉ được có công trình của mình');
});

uiTest('GD-05 tổng quan: có chip sức khỏe và bấm cảnh báo nhảy đúng chỗ', async (page) => {
  await loginViaApi(page, 'admin');
  await openPage(page, 'dashboard');
  await page.waitForFunction(() => !/Đang tải/.test(document.getElementById('dashboard')?.innerText || ''));
  const text = await page.locator('#dashboard').innerText();
  for (const code of ['001', '002', '003']) {
    assert.ok(text.includes(code), 'Admin phải thấy cả 3 công trình ở tổng quan, thiếu ' + code);
  }

  const alerts = page.locator('#dashboard [onclick*="goAlertTarget"]');
  const n = await alerts.count();
  assert.ok(n > 0, 'dữ liệu thử phải sinh ít nhất một cảnh báo (thiếu nhật ký, chậm tiến độ…)');
  await alerts.first().click();
  await page.waitForFunction(() => document.querySelector('#dashboard.page.active') === null);
  const active = await page.evaluate(() => document.querySelector('.page.active')?.id);
  assert.ok(['projects', 'daily', 'docs', 'issues', 'reports'].includes(active),
    'bấm cảnh báo phải chuyển sang trang liên quan, đang ở: ' + active);
});
```

- [ ] **Step 3: Chạy hai ca**

```powershell
Start-Process cmd.exe -ArgumentList '/c','backend\scripts\run-ui-tests.cmd vina_ui_claude "GD-04|GD-05"' -WindowStyle Hidden
```

Expected: pass. Nếu GD-05 không có cảnh báo nào: xem `backend/src/services/portfolioService.js` THRESHOLDS và dữ liệu seed — bổ sung dữ liệu cho ca bằng API trong chính ca đó (ví dụ tạo một vấn đề quá hạn), **không** sửa ngưỡng của app.

- [ ] **Step 4: Commit**

```bash
git add backend/tests/ui/03-tong-quan.test.js
git commit -m "Test giao dien: pham vi cong trinh theo phan cong (GD-04) va canh bao tong quan (GD-05)

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 5: GD-06 lập & gửi duyệt nhật ký + GD-07 Trưởng TVGS duyệt qua "Việc cần duyệt"

**Files:**
- Create: `backend/tests/ui/04-nhat-ky-duyet.test.js`

**Interfaces:**
- Consumes: `startApp`, `stopApp`, `uiTest`, `loginViaApi`, `openPage`, `tokenOf`, `apiAs`, `projectIdByContract`.
- Produces: hàm cục bộ `taoNhatKyQuaGiaoDien(page, { ngay, congViec, guiDuyet })` dùng trong chính file này (Task 6 dựng dữ liệu qua API bằng hàm riêng, không dùng hàm này — mỗi file test độc lập).

- [ ] **Step 1: Viết GD-06**

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const { startApp, stopApp, uiTest, loginViaApi, openPage } = require('./helpers');

test.before(startApp);
test.after(stopApp);

// Lập nhật ký bằng giao diện; trả về nội dung công việc để tìm lại dòng trong bảng.
async function taoNhatKyQuaGiaoDien(page, { ngay, congViec, guiDuyet = false }) {
  await openPage(page, 'daily');
  await page.click('#newLogButton');
  await page.waitForSelector('#modal.show #lwork', { state: 'visible' });
  await page.fill('#ldate', ngay);
  await page.fill('#lwork', congViec);
  await page.fill('#lworkers', '5');
  await page.click(`#modal >> text="${guiDuyet ? 'Lưu và gửi duyệt' : 'Lưu nháp'}"`);
  await page.waitForSelector('#modal.show', { state: 'hidden' });
  await page.waitForFunction(t => (document.getElementById('logsTable')?.innerText || '').includes(t), congViec);
  return congViec;
}

uiTest('GD-06 lập nhật ký nháp rồi gửi duyệt: người lập hết quyền sửa', async (page) => {
  await loginViaApi(page, 'thanhb');
  const congViec = 'GD-06 dam mong truc A';
  await taoNhatKyQuaGiaoDien(page, { ngay: '2026-09-24', congViec });

  const rowDraft = page.locator('#logsTable tr', { hasText: congViec });
  assert.ok((await rowDraft.innerText()).match(/Nháp|DRAFT/), 'nhật ký mới phải ở trạng thái nháp');
  assert.ok(await rowDraft.locator('text="Gửi duyệt"').isVisible(), 'nháp phải có nút Gửi duyệt');
  assert.equal(await rowDraft.locator('text="Duyệt"').count(), 0, 'người lập không được thấy nút Duyệt');

  await rowDraft.locator('text="Gửi duyệt"').click(); // confirm() được helper tự chấp nhận
  await page.waitForFunction(t => {
    const tr = [...document.querySelectorAll('#logsTable tr')].find(r => r.innerText.includes(t));
    return tr && !/Nháp|DRAFT/.test(tr.innerText);
  }, congViec);

  const rowSent = page.locator('#logsTable tr', { hasText: congViec });
  const sentText = await rowSent.innerText();
  assert.ok(/Chờ|SUBMITTED|duyệt/.test(sentText), 'sau khi gửi phải ở trạng thái chờ duyệt: ' + sentText);
  assert.equal(await rowSent.locator('text="Gửi duyệt"').count(), 0, 'đã gửi thì không còn nút Gửi duyệt');
});
```

- [ ] **Step 2: Chạy GD-06, sửa selector đến khi xanh**

```powershell
Start-Process cmd.exe -ArgumentList '/c','backend\scripts\run-ui-tests.cmd vina_ui_claude GD-06' -WindowStyle Hidden
```

Nếu nhãn trạng thái trong bảng khác dự kiến, chạy `node backend/scripts/ui-ctx.js "LOG_STATUS" "Nháp"` để lấy nhãn thật rồi sửa biểu thức kiểm tra. Xem ảnh lỗi ở `backend/tests/ui-artifacts/GD-06*.png`.

- [ ] **Step 3: Viết GD-07 vào cùng file**

```js
uiTest('GD-07 Trưởng TVGS thấy việc trong hộp duyệt và duyệt được', async (page) => {
  // Người lập gửi duyệt
  await loginViaApi(page, 'thanhb');
  const congViec = 'GD-07 be tong san ham';
  await taoNhatKyQuaGiaoDien(page, { ngay: '2026-09-25', congViec, guiDuyet: true });

  // Trưởng TVGS tại công trình 001
  await page.evaluate(() => localStorage.clear());
  await loginViaApi(page, 'hung');
  await openPage(page, 'inbox');
  await page.waitForFunction(() => !/Đang tải/.test(document.getElementById('inboxBody')?.innerText || ''));
  assert.ok((await page.locator('#inboxBody').innerText()).includes(congViec),
    'việc đã gửi phải xuất hiện trong "Việc cần duyệt" của Trưởng TVGS');

  await openPage(page, 'daily');
  const row = page.locator('#logsTable tr', { hasText: congViec });
  await row.locator('text="Duyệt"').first().click();
  await page.waitForFunction(t => {
    const tr = [...document.querySelectorAll('#logsTable tr')].find(r => r.innerText.includes(t));
    return tr && /Đã duyệt|APPROVED|Khóa/.test(tr.innerText);
  }, congViec);

  const after = await page.locator('#logsTable tr', { hasText: congViec }).innerText();
  assert.ok(/Đã duyệt|APPROVED/.test(after), 'sau khi duyệt trạng thái phải là đã duyệt: ' + after);
  assert.ok(after.includes('hung') || after.includes('Hùng') || after.includes('Hưng'),
    'bảng phải cho biết ai đã duyệt: ' + after);
});
```

- [ ] **Step 4: Chạy GD-06 + GD-07**

```powershell
Start-Process cmd.exe -ArgumentList '/c','backend\scripts\run-ui-tests.cmd vina_ui_claude "GD-06|GD-07"' -WindowStyle Hidden
```

Expected: cả hai pass, `EXIT 0`.

- [ ] **Step 5: Commit**

```bash
git add backend/tests/ui/04-nhat-ky-duyet.test.js
git commit -m "Test giao dien: lap-gui duyet nhat ky (GD-06) va Truong TVGS duyet qua hop viec (GD-07)

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 6: GD-08 trả lại phải có lý do + GD-09 đã duyệt thì khóa sửa

**Files:**
- Create: `backend/tests/ui/05-tra-lai-va-khoa-sua.test.js`

**Interfaces:**
- Consumes: `startApp`, `stopApp`, `uiTest`, `loginViaApi`, `openPage`, `tokenOf`, `apiAs`, `projectIdByContract`.
- Produces: không có gì cho task sau.

- [ ] **Step 1: Xác minh modal quyết định duyệt**

Run: `node backend/scripts/ui-ctx.js "submitReviewDecision" "rvNote"`
Ghi lại id ô ghi chú và nhãn nút xác nhận thật; dùng đúng ở Step 2 (dự kiến modal do `openReviewDecision` mở).

- [ ] **Step 2: Viết GD-08**

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const { startApp, stopApp, uiTest, loginViaApi, openPage, tokenOf, apiAs, projectIdByContract } = require('./helpers');

test.before(startApp);
test.after(stopApp);

// Dựng sẵn một nhật ký đã gửi duyệt bằng API (nhanh và không phụ thuộc ca khác).
async function nhatKyDaGui(congViec, ngay) {
  const token = await tokenOf('thanhb');
  const api = apiAs(token);
  const pid = await projectIdByContract(token, '001');
  const created = await api.post('/daily-logs', { project_id: pid, log_date: ngay, shift: 'CA1', work_summary: congViec });
  assert.equal(created.status, 201, 'tạo nhật ký qua API: ' + JSON.stringify(created.body));
  const id = created.body.id;
  const sent = await api.post(`/daily-logs/${id}/submit`, {});
  assert.ok([200, 204].includes(sent.status), 'gửi duyệt qua API: ' + JSON.stringify(sent.body));
  return { id, congViec };
}

uiTest('GD-08 trả lại nhật ký bắt buộc có ý kiến, người lập thấy chip bị trả', async (page) => {
  const { congViec } = await nhatKyDaGui('GD-08 lap trung ca 1', '2026-09-22');

  await loginViaApi(page, 'hung');
  await openPage(page, 'daily');
  const row = page.locator('#logsTable tr', { hasText: congViec });
  await row.locator('text="Trả lại"').first().click();
  await page.waitForSelector('#modal.show', { state: 'visible' });

  // Bấm xác nhận khi chưa nhập ý kiến → phải bị chặn
  await page.locator('#modal button.primary').first().click();
  assert.ok(await page.locator('#modal.show').isVisible(), 'chưa nhập ý kiến thì không được trả lại');
  const stillSubmitted = await page.evaluate(t => {
    const tr = [...document.querySelectorAll('#logsTable tr')].find(r => r.innerText.includes(t));
    return tr ? tr.innerText : '';
  }, congViec);
  assert.ok(!/Bị trả|RETURNED/.test(stillSubmitted), 'trạng thái không được đổi khi ý kiến rỗng');

  // Nhập ý kiến rồi xác nhận
  await page.locator('#modal textarea').first().fill('Thiếu khối lượng bê tông, bổ sung rồi gửi lại.');
  await page.locator('#modal button.primary').first().click();
  await page.waitForSelector('#modal.show', { state: 'hidden' });

  await page.evaluate(() => localStorage.clear());
  await loginViaApi(page, 'thanhb');
  await openPage(page, 'daily');
  const mine = await page.locator('#logsTable tr', { hasText: congViec }).innerText();
  assert.ok(/Bị trả|trả lại|RETURNED/i.test(mine), 'người lập phải thấy dấu hiệu bị trả lại: ' + mine);

  // Bị trả lại thì người lập sửa được, và phải đọc được ý kiến của người duyệt (reviewBlockHtml trong modal sửa)
  await page.locator('#logsTable tr', { hasText: congViec }).locator('text="Sửa"').first().click();
  await page.waitForSelector('#modal.show #lwork', { state: 'visible' });
  assert.ok((await page.locator('#mbody').innerText()).includes('Thiếu khối lượng'),
    'ý kiến của người duyệt phải hiện khi người lập mở lại nhật ký bị trả');
});
```

- [ ] **Step 3: Viết GD-09 vào cùng file**

```js
uiTest('GD-09 nhật ký đã duyệt: người lập không sửa được, Admin sửa được', async (page) => {
  const congViec = 'GD-09 lap cot truc B';
  const { id } = await nhatKyDaGui(congViec, '2026-09-23');
  const leadApi = apiAs(await tokenOf('hung'));
  const approved = await leadApi.post(`/daily-logs/${id}/approve`, {});
  assert.ok([200, 204].includes(approved.status), 'duyệt qua API: ' + JSON.stringify(approved.body));

  await loginViaApi(page, 'thanhb');
  await openPage(page, 'daily');
  const row = page.locator('#logsTable tr', { hasText: congViec });
  assert.equal(await row.locator('text="Sửa"').count(), 0, 'người lập không được sửa nhật ký đã duyệt');

  await page.evaluate(() => localStorage.clear());
  await loginViaApi(page, 'admin');
  await openPage(page, 'daily');
  const adminRow = page.locator('#logsTable tr', { hasText: congViec });
  await adminRow.locator('text="Sửa"').first().click();
  await page.waitForSelector('#modal.show #lwork', { state: 'visible' });
  await page.fill('#lwork', congViec + ' (Admin sua)');
  await page.click('#modal >> text="Lưu thay đổi"');
  await page.waitForSelector('#modal.show', { state: 'hidden' });
  await page.waitForFunction(() => (document.getElementById('logsTable')?.innerText || '').includes('(Admin sua)'));
});
```

- [ ] **Step 4: Chạy hai ca**

```powershell
Start-Process cmd.exe -ArgumentList '/c','backend\scripts\run-ui-tests.cmd vina_ui_claude "GD-08|GD-09"' -WindowStyle Hidden
```

Expected: pass. Nếu đường dẫn API `/daily-logs/:id/submit|approve` khác, xem `backend/src/routes/dailyLogs.js` (Grep `router.post`) rồi sửa.

- [ ] **Step 5: Commit**

```bash
git add backend/tests/ui/05-tra-lai-va-khoa-sua.test.js
git commit -m "Test giao dien: tra lai phai co y kien (GD-08) va khoa sua sau khi duyet (GD-09)

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 7: GD-10 luồng hồ sơ DRAFT→SUBMITTED→APPROVED→LOCKED

**Files:**
- Create: `backend/tests/ui/06-ho-so.test.js`

**Interfaces:**
- Consumes: `startApp`, `stopApp`, `uiTest`, `loginViaApi`, `openPage`.
- Produces: không có gì cho task sau.

- [ ] **Step 1: Đối chiếu selector hồ sơ (đã xác minh, chỉ cần xác nhận còn đúng)**

Run: `node backend/scripts/ui-ctx.js "openDoc()" "docSaveBtn" "docWorkflow("`
Đã xác minh: nút mở modal là `#docs` toolbar `+ Tạo hồ sơ` (`onclick="openDoc()"`); modal có `#dproj` (công trình), `#dgroup` (nhóm), `#dtype` (loại), `#dname` (tên), mã hồ sơ là ô `disabled` ghi "Máy chủ tự cấp khi lưu"; nút lưu `#docSaveBtn` nhãn "Tạo và tải tệp lên" (khi tạo) / "Lưu thay đổi" (khi sửa); thông báo `#docMessage`. Nếu `ui-ctx.js` cho kết quả khác thì sửa lại Step 2 theo kết quả thật.

- [ ] **Step 2: Viết GD-10**

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const { startApp, stopApp, uiTest, loginViaApi, openPage } = require('./helpers');

test.before(startApp);
test.after(stopApp);

uiTest('GD-10 hồ sơ: mã tự sinh và đi đủ nháp → gửi → duyệt → khóa', async (page) => {
  await loginViaApi(page, 'hung'); // Trưởng TVGS: có CREATE và APPROVE tại 001
  await openPage(page, 'docs');
  await page.click('#docs >> text="+ Tạo hồ sơ"');
  await page.waitForSelector('#modal.show #dname', { state: 'visible' });
  const ten = 'GD-10 Bien ban nghiem thu mong';
  await page.selectOption('#dtype', { index: 0 });
  await page.fill('#dname', ten);
  await page.click('#docSaveBtn');
  await page.waitForSelector('#modal.show', { state: 'hidden' });
  await page.waitForFunction(t => (document.getElementById('docsTable')?.innerText || '').includes(t), ten);

  const row = () => page.locator('#docsTable tr', { hasText: ten });
  const code = (await row().innerText()).match(/[A-Z]{2,3}-\d{3}-\d{3}/);
  assert.ok(code, 'hồ sơ phải có mã tự sinh dạng BB-001-002: ' + (await row().innerText()));

  for (const [nhan, mong] of [['Gửi duyệt', /Chờ|SUBMITTED/], ['Duyệt', /Đã duyệt|APPROVED/], ['Khóa hồ sơ', /Khóa|LOCKED/]]) {
    await row().locator(`text="${nhan}"`).first().click();
    await page.waitForFunction(([t, re]) => {
      const tr = [...document.querySelectorAll('#docsTable tr')].find(r => r.innerText.includes(t));
      return tr && new RegExp(re).test(tr.innerText);
    }, [ten, mong.source]);
  }

  const locked = await row().innerText();
  assert.ok(/Khóa|LOCKED/.test(locked), 'phải khóa được: ' + locked);
  assert.equal(await row().locator('text="Sửa"').count(), 0, 'hồ sơ đã khóa không còn nút Sửa');
});
```

- [ ] **Step 3: Chạy GD-10 và sửa selector đến khi xanh**

```powershell
Start-Process cmd.exe -ArgumentList '/c','backend\scripts\run-ui-tests.cmd vina_ui_claude GD-10' -WindowStyle Hidden
```

Nếu `#docSaveBtn` báo lỗi vì hồ sơ bắt buộc có tệp đính kèm (nhãn nút là "Tạo và tải tệp lên"), đọc `#docMessage` để biết yêu cầu thật, rồi đính kèm một tệp nhỏ trong ca bằng `page.setInputFiles` với tệp tạo tại `backend/tests/ui-artifacts/gd10.pdf`. Nếu vẫn không có nhãn/id ổn định ở nút luồng duyệt, thêm `data-testid` vào `index.html`, bump build 3 chỗ và chạy `node backend\scripts\check-frontend.js`.

- [ ] **Step 4: Commit**

```bash
git add backend/tests/ui/06-ho-so.test.js
git commit -m "Test giao dien: luong ho so nhap-gui-duyet-khoa va ma tu sinh (GD-10)

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

Nếu có sửa `index.html`/`sw.js`/`build.js` thì thêm vào cùng commit và ghi rõ build mới trong nội dung commit.

---

### Task 8: GD-11 quyền mặc định theo chức danh (bản sao phía client)

**Files:**
- Create: `backend/tests/ui/07-quyen-theo-chuc-danh.test.js`

**Interfaces:**
- Consumes: `startApp`, `stopApp`, `uiTest`, `loginViaApi`, `openPage`.
- Produces: không có gì cho task sau.

- [ ] **Step 1: Xác minh cách mở modal nhân sự**

Run: `node backend/scripts/ui-ctx.js "openTeamMember(" "tmTitle" "tmPerm"`
Ghi lại: nhãn nút thêm nhân sự ở trang `people`, id ô chức danh (`#tmTitle`), và markup checkbox `.tmPerm` (giá trị/nhãn).

- [ ] **Step 2: Viết GD-11**

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const { startApp, stopApp, uiTest, loginViaApi, openPage } = require('./helpers');

test.before(startApp);
test.after(stopApp);

// Đọc danh sách quyền đang được tích trong modal nhân sự, trả về mã quyền.
const quyenDangTich = (page) => page.$$eval('.tmPerm', els => els.filter(e => e.checked).map(e => e.value));

uiTest('GD-11 quyền mặc định đổi theo chức danh, không bao giờ mặc định có Xóa', async (page) => {
  await loginViaApi(page, 'admin');
  await openPage(page, 'people');
  await page.waitForFunction(() => !/Đang tải/.test(document.getElementById('people')?.innerText || ''));

  // Mở một nhân sự sẵn có ở công trình 001 (dữ liệu seed: Trần Văn C — GS hiện trường)
  await page.locator('#people >> text="Trần Văn C"').first().click();
  await page.waitForSelector('#modal.show #tmTitle', { state: 'visible' });

  await page.fill('#tmTitle', 'TVGS trưởng');
  await page.dispatchEvent('#tmTitle', 'input');
  await page.dispatchEvent('#tmTitle', 'change');
  await page.waitForFunction(() => (document.getElementById('tmDefaultsText')?.textContent || '').includes('Duyệt'));
  let perms = await quyenDangTich(page);
  assert.ok(perms.includes('APPROVE'), 'chức danh TVGS trưởng phải có quyền Duyệt theo mặc định: ' + perms.join(','));
  assert.ok(!perms.includes('DELETE'), 'Xóa không bao giờ là quyền mặc định: ' + perms.join(','));

  await page.fill('#tmTitle', 'GS viên');
  await page.dispatchEvent('#tmTitle', 'input');
  await page.dispatchEvent('#tmTitle', 'change');
  await page.waitForFunction(() => !(document.getElementById('tmDefaultsText')?.textContent || '').includes('Duyệt'));
  perms = await quyenDangTich(page);
  assert.ok(!perms.includes('APPROVE'), 'chức danh GS viên không được có quyền Duyệt mặc định: ' + perms.join(','));
  assert.ok(perms.includes('VIEW') && perms.includes('CREATE') && perms.includes('DOWNLOAD'),
    'GS viên phải có Xem/Thêm/Tải xuống: ' + perms.join(','));
  assert.ok(!perms.includes('DELETE'), 'Xóa không bao giờ là quyền mặc định: ' + perms.join(','));
});
```

- [ ] **Step 3: Chạy GD-11**

```powershell
Start-Process cmd.exe -ArgumentList '/c','backend\scripts\run-ui-tests.cmd vina_ui_claude GD-11' -WindowStyle Hidden
```

Expected: pass. Nếu `.tmPerm` không có `value` là mã quyền, đọc nhãn tiếng Việt cạnh checkbox (`PERM_LABELS`) và so theo nhãn.

- [ ] **Step 4: Chứng minh ca này bắt được lỗi lệch bản sao quyền**

Tạm sửa `LEAD_DEFAULT_PERMS` trong `index.html` bỏ `'APPROVE'`, chạy lại → phải FAIL. Hoàn nguyên `index.html` (`git checkout -- index.html`) rồi chạy lại → PASS. Đây là bằng chứng ca này bảo vệ được đúng thứ nó phải bảo vệ.

- [ ] **Step 5: Commit**

```bash
git add backend/tests/ui/07-quyen-theo-chuc-danh.test.js
git commit -m "Test giao dien: quyen mac dinh theo chuc danh tai cong trinh (GD-11)

Bat loi khi ban sao quyen phia client (defaultPermsFor/LEAD_DEFAULT_PERMS)
lech voi permissionService.js.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 9: GD-12 xóa vào thùng rác và khôi phục

**Files:**
- Create: `backend/tests/ui/08-thung-rac.test.js`

**Interfaces:**
- Consumes: `startApp`, `stopApp`, `uiTest`, `loginViaApi`, `openPage`, `tokenOf`, `apiAs`, `projectIdByContract`.
- Produces: không có gì cho task sau.

- [ ] **Step 1: Viết GD-12**

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const { startApp, stopApp, uiTest, loginViaApi, openPage, tokenOf, apiAs, projectIdByContract } = require('./helpers');

test.before(startApp);
test.after(stopApp);

uiTest('GD-12 xóa phải có lý do, vào Thùng rác và khôi phục được', async (page) => {
  // Dựng nhật ký để xóa
  const token = await tokenOf('admin');
  const api = apiAs(token);
  const pid = await projectIdByContract(token, '001');
  const congViec = 'GD-12 nhat ky se xoa';
  const created = await api.post('/daily-logs', { project_id: pid, log_date: '2026-09-26', shift: 'CA2', work_summary: congViec });
  assert.equal(created.status, 201, JSON.stringify(created.body));

  await loginViaApi(page, 'admin');
  await openPage(page, 'daily');
  const row = page.locator('#logsTable tr', { hasText: congViec });
  await row.locator('text="Xóa"').first().click();
  await page.waitForSelector('#modal.show #delReason', { state: 'visible' });

  // Lý do rỗng → bị chặn
  await page.locator('#modal button.danger, #modal button.primary').first().click();
  assert.ok(await page.locator('#modal.show').isVisible(), 'lý do rỗng thì không được xóa');
  assert.ok((await page.locator('#logsTable').innerText()).includes(congViec), 'bản ghi vẫn còn khi chưa nhập lý do');

  // Có lý do → xóa
  await page.fill('#delReason', 'Lập trùng nhật ký ca 2 ngày 26/09.');
  await page.locator('#modal button.danger, #modal button.primary').first().click();
  await page.waitForFunction(t => !(document.getElementById('logsTable')?.innerText || '').includes(t), congViec);

  // Vào Thùng rác
  await openPage(page, 'trash');
  await page.waitForFunction(() => !/Đang tải/.test(document.getElementById('trashBody')?.innerText || ''));
  const trash = await page.locator('#trashBody').innerText();
  assert.ok(trash.includes(congViec), 'bản ghi đã xóa phải nằm trong Thùng rác: ' + trash.slice(0, 300));
  assert.ok(trash.includes('Lập trùng nhật ký'), 'Thùng rác phải giữ lý do xóa');

  // Khôi phục
  await page.locator('#trashBody tr', { hasText: congViec }).locator('text="Khôi phục"').first().click();
  await page.waitForFunction(t => !(document.getElementById('trashBody')?.innerText || '').includes(t), congViec);
  await openPage(page, 'daily');
  await page.waitForFunction(t => (document.getElementById('logsTable')?.innerText || '').includes(t), congViec);
});

uiTest('GD-12b nút Xóa vĩnh viễn chỉ Admin thấy', async (page) => {
  const token = await tokenOf('admin');
  const api = apiAs(token);
  const pid = await projectIdByContract(token, '001');
  const congViec = 'GD-12b nhat ky da xoa';
  const created = await api.post('/daily-logs', { project_id: pid, log_date: '2026-09-27', shift: 'CA1', work_summary: congViec });
  await api.del(`/daily-logs/${created.body.id}`, { reason: 'Dựng dữ liệu cho ca kiểm thử.' });

  await loginViaApi(page, 'admin');
  await openPage(page, 'trash');
  await page.waitForFunction(t => (document.getElementById('trashBody')?.innerText || '').includes(t), congViec);
  assert.ok(await page.locator('#trashBody tr', { hasText: congViec }).locator('text="Xóa vĩnh viễn"').isVisible(),
    'Admin phải thấy nút Xóa vĩnh viễn');

  await page.evaluate(() => localStorage.clear());
  await loginViaApi(page, 'duong'); // Giám đốc: thấy Thùng rác nhưng không được xóa vĩnh viễn
  await openPage(page, 'trash');
  await page.waitForFunction(t => (document.getElementById('trashBody')?.innerText || '').includes(t), congViec);
  assert.equal(await page.locator('#trashBody tr', { hasText: congViec }).locator('text="Xóa vĩnh viễn"').count(), 0,
    'chỉ Admin được xóa vĩnh viễn');
});
```

- [ ] **Step 2: Chạy hai ca**

```powershell
Start-Process cmd.exe -ArgumentList '/c','backend\scripts\run-ui-tests.cmd vina_ui_claude GD-12' -WindowStyle Hidden
```

Expected: pass. Nếu `DELETE /daily-logs/:id` cần trường khác `reason`, xem `backend/src/routes/dailyLogs.js` và `recycleService.js`.

- [ ] **Step 3: Commit**

```bash
git add backend/tests/ui/08-thung-rac.test.js
git commit -m "Test giao dien: xoa phai co ly do, vao Thung rac, khoi phuc (GD-12)

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 10: Chạy toàn bộ, ghi tài liệu, đặt mốc

**Files:**
- Modify: `docs/CODEMAP.md` (mục `## Tests`)
- Modify: `CAP-NHAT-20260926.md` (một mục ngắn, tiếng Việt, cho người dùng)
- Modify: `KET-QUA-KIEM-THU-20260926.md` (kết quả chạy thật)
- Modify: `CLAUDE.md` (mục Testing: thêm cách chạy bộ UI; mục Working agreements: đánh dấu việc kế tiếp = tách `index.html`)

**Interfaces:**
- Consumes: toàn bộ các task trước.
- Produces: mốc để đợt tách `index.html` dựa vào.

- [ ] **Step 1: Chạy trọn bộ UI hai lần liên tiếp (kiểm tra ca có chập chờn)**

```powershell
Start-Process cmd.exe -ArgumentList '/c','backend\scripts\run-ui-tests.cmd vina_ui_claude' -WindowStyle Hidden
```

Chạy lại lần hai sau khi lần một xong. Expected: cả hai lần `fail 0`, `EXIT 0`, cùng số ca pass. Ca nào lần xanh lần đỏ thì phải sửa (thường do thiếu `waitForFunction`), không được để lại.

- [ ] **Step 2: Chạy lại regression để chắc chắn không ảnh hưởng**

```powershell
Start-Process cmd.exe -ArgumentList '/c','backend\scripts\run-regression.cmd vina_regr_final' -WindowStyle Hidden
```

Expected: pass bằng mốc ở Task 1 Step 1, `EXIT 0`.

- [ ] **Step 3: Nếu đã sửa `index.html`, kiểm tra cú pháp và khớp build**

Run: `node backend\scripts\check-frontend.js`
Expected: không lỗi, build id khớp ở cả 3 chỗ.

- [ ] **Step 4: Cập nhật `docs/CODEMAP.md`**

Thêm vào cuối mục `## Tests`:

```markdown
`backend/tests/lib/testDb.js` — `createTestDb(dbUrl)`: dựng CSDL thử (schema + migration + dữ liệu lỗi giống thực tế), `startServer({port})`, `waitHealth(base)`. Dùng chung cho regression và bộ giao diện.
`backend/tests/ui/*.test.js` — kiểm thử giao diện bằng playwright-core (Chrome cài trên máy), backend cổng 3103, CSDL `vina_ui_claude`. Helper: `backend/tests/ui/helpers.js` (`uiTest`, `loginViaApi`, `loginViaForm`, `openPage`, `navVisible`, `apiAs`, `tokenOf`). Chạy: `backend\scripts\run-ui-tests.cmd [db] [mẫu tên ca]` → `backend\tests\last-ui-test.txt`, ảnh lỗi ở `backend/tests/ui-artifacts/`.
`backend/scripts/ui-ctx.js` — in ngữ cảnh quanh một chuỗi trong `index.html` (đọc markup mà không phải mở cả file).
Các ca hiện có: GD-01 đăng nhập · GD-02 buộc đổi mật khẩu · GD-03 nav theo vai trò · GD-04 phạm vi công trình · GD-05 cảnh báo tổng quan · GD-06 lập/gửi nhật ký · GD-07 duyệt qua hộp việc · GD-08 trả lại cần ý kiến · GD-09 khóa sửa sau duyệt · GD-10 luồng hồ sơ · GD-11 quyền theo chức danh · GD-12 thùng rác (+ HZ-01/HZ-02 chống xanh giả).
```

- [ ] **Step 5: Cập nhật `CLAUDE.md`**

Trong mục **Testing**, thêm một dòng ngay sau dòng Regression:

```markdown
- Giao diện: `backend\scripts\run-ui-tests.cmd [dbname] [mẫu tên ca]` → `backend\tests\last-ui-test.txt` (playwright-core + Chrome của máy, cổng 3103, CSDL `vina_ui_claude`; ảnh lỗi ở `backend/tests/ui-artifacts/`). Sửa giao diện → chạy bộ này.
```

Trong mục **Working agreements**, đổi dòng "Next planned big task" thành: bộ kiểm thử giao diện đã xong (12 ca P1); việc kế tiếp là tách `index.html` theo tính năng, dùng 12 ca này làm điều kiện nghiệm thu; nhóm P2 (12 ca còn lại trong spec) làm sau.

- [ ] **Step 6: Ghi `CAP-NHAT-20260926.md` và `KET-QUA-KIEM-THU-20260926.md`**

`CAP-NHAT`: một mục ngắn cho người dùng — đã thêm bộ kiểm thử giao diện tự động 12 ca, chạy bằng một lệnh, không ảnh hưởng dữ liệu thật, mục đích là bảo vệ khi tách `index.html`.

`KET-QUA-KIEM-THU`: dán số liệu thật từ `last-ui-test.txt` và `last-regression.txt` (số pass/fail, thời gian chạy, ngày chạy).

- [ ] **Step 7: Commit mốc**

```bash
git add docs/CODEMAP.md CLAUDE.md CAP-NHAT-20260926.md KET-QUA-KIEM-THU-20260926.md
git commit -m "Tai lieu: bo kiem thu giao dien 12 ca da xanh, dat moc truoc khi tach index.html

Ghi cach chay vao CLAUDE.md va CODEMAP.md; ket qua chay thuc vao file kiem thu.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

- [ ] **Step 8: Báo người dùng**

Báo: số ca pass của bộ UI và của regression (số thật, kèm đường dẫn file kết quả), có sửa `index.html` hay không (nếu có thì nhắc chạy `.\run.bat` + Ctrl+F5 và nói build mới), và những lỗi thật của app đã phát hiện trong lúc viết test (nếu có) — để người dùng quyết định sửa ở phiên sau.
