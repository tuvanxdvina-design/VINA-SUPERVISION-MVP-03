# VINA-SUPERVISION MVP-02 — project guide for Claude

Construction-supervision (TVGS) management app for a Vietnamese consulting firm. UI text is Vietnamese; the user writes Vietnamese — answer in Vietnamese, direct, with pushback.
**Do not re-read whole files.** Use this guide + `docs/CODEMAP.md`, then Grep for the function you need and Read only that range.

## Stack & layout
- Backend: Node 24 + Express 5 + PostgreSQL 14 (Docker container `vina-supervision-db`, DB `vina_supervision`, app user `vina_user`). Entry `backend/server.js` → `backend/src/app.js`.
  - `src/routes/*.js` (HTTP, auth/permission checks) → `src/services/*.js` (SQL). No ORM; raw `pool.query`.
  - `src/utils/db.js` (DATE type returned as 'YYYY-MM-DD' string), `src/utils/fileSafety.js` (serve uploads safely).
- Frontend: single file `index.html` (~270 KB, all JS inline, 7 `<script>` blocks) + `api.js` (fetch wrapper, API→local mappers) + `sw.js`. Served by backend at `/` (port 3001) and copied to `web-public/` by `run.bat` (port 8080). **Edit root files only**, never `web-public/`.
- Local state in `localStorage` (`db` object: projects, logs, docs, issues, sync queue); server is source of truth.
- Migrations: `migrations/YYYYMMDD_name.sql`, each wrapped in BEGIN/COMMIT, idempotent (`IF NOT EXISTS`). Applied by `migrate-db.ps1` as `postgres` (run.bat does it automatically with backup). Recorded in `schema_migrations`. Latest: `20261005_recycle_bin.sql`.
- Base schema `schema-VINA-PROD-01.sql` is OLD; real schema = schema + all migrations.

## Every change checklist
1. Bump build in **3 places**: `backend/src/build.js` BUILD, `index.html` `const APP_BUILD=`, `sw.js` SHELL_CACHE. (run.bat restarts backend when build differs; UI shows red banner if mismatched.)
2. New DB column/table → new migration file (never edit an applied one).
3. Add/adjust tests in `backend/tests/regression.test.js` (node:test, isolated DB, API on port 3101). Use dates relative to today (`vnToday()`, `shift()` helpers).
4. Run tests (see Testing). Syntax-check index.html inline scripts.
5. Append a short section to `CAP-NHAT-20260926.md` (user-facing changelog, Vietnamese) and `KET-QUA-KIEM-THU-20260926.md` (test results).
6. Tell the user to run `.\run.bat` + Ctrl+F5.

## Testing (shell output in this environment is unreliable → always write to a file, then Read/Grep it)
- Regression: `backend\scripts\run-regression.cmd [dbname]` → results in `backend\tests\last-regression.txt` (Grep `ℹ pass|ℹ fail|✖`). Takes ~2 min; poll the file. Use a unique db name (another tool may use `vina_regression`).
- Giao diện (14 ca): `backend\scripts\run-ui-tests.cmd [dbname] [mẫu tên ca]` → `backend\tests\last-ui-test.txt` (~50 s; playwright-core + Chrome của máy, cổng 3103, CSDL `vina_ui_claude`; ảnh lỗi ở `backend/tests/ui-artifacts/`). **Sửa `index.html`/`api.js` → chạy bộ này.** Mẫu tên ca là regex, không dùng dấu `|` (dùng `GD-0[67]`). Chi tiết ca + selector: `docs/CODEMAP.md`.
- Syntax: `node backend\scripts\check-frontend.js` (inline scripts + api.js + sw.js + build id match); `node --check <file>` for backend files.
- Launch long commands detached (`Start-Process cmd.exe -ArgumentList '/c', ... -WindowStyle Hidden`) and redirect to a file; the PowerShell tool gets killed on long sleeps — poll with Grep / short waits.
- UI check: start a 2nd backend on port 3102 pointed at the test DB (env PORT/DB_NAME/NODE_ENV=development, seed users log in with password `demo`), open in browser pane, drive via `javascript_exec`. Screenshots time out in this pane — inspect DOM text instead. Never type passwords into forms; fetch `/api/auth/login` from JS with test fixture creds.
- Real DB: **read-only** queries only (`docker exec -i vina-supervision-db psql -U postgres -d vina_supervision`). Never write to it; never restart the user's backend (port 3001).

## Domain rules (decided with the user — do not re-litigate)
- Legal basis: Nghị định **207/2026/NĐ-CP** (effective 01/07/2026) replaced 06/2021.
- Roles (global): ADMIN, DIRECTOR (= "quản trị", company level, all projects), MANAGER, TVGS_LEAD, ENGINEER.
- **Per-project permissions** (`permissionService.js`): VIEW, CREATE, EDIT, DOWNLOAD, APPROVE, DELETE. Admin/Director = all. Others: custom list per assignment (`project_member_access`) or default by **title at that project**: title "TVGS trưởng"-like (`isLeadTitle`) → VIEW/CREATE/EDIT/DOWNLOAD/APPROVE; other titles → VIEW/CREATE/DOWNLOAD; MANAGER → VIEW/DOWNLOAD. DELETE never by default. Frontend mirror: `defaultPermsFor`, `LEAD_DEFAULT_PERMS` in index.html — keep in sync.
- One person may work on many projects with different titles. Title source: `project_personnel.assignment_title` (preferred) else `project_members.assignment_title`.
- Approval workflow (reports, documents, daily logs): DRAFT→SUBMITTED→APPROVED→LOCKED. Lead (APPROVE at project) decides: approve / reject (comment required) / **escalate to company** (comment required; then only Admin/Director decide). Notes in `review_notes`. Inbox `/api/reviews/inbox`; "Việc cần duyệt" nav only for users with APPROVE somewhere or Admin/Director.
- Non-DRAFT documents/logs: only Admin/Director can edit (UPDATE_LOCKED audited).
- Delete = **recycle bin** (`recycleService.js`, table `deleted_records`, JSONB snapshot of row + children), reason required, restore possible; purge only ADMIN (keeps trace row).
- New accounts / admin password reset → `must_change_password` (server blocks all but change-password). Usernames are admin-chosen (`USERNAME_RE`), login is case-insensitive.
- Account full_name vs personnel name mismatch → warning chip; "Đúng người" can freeze old author name on past records (`author_name` columns on daily_logs/documents/issues; queries use `COALESCE(x.author_name, u.full_name)`).
- Portfolio/alerts: `portfolioService.js` (THRESHOLDS object; EVM SPI, overdue items, stale actuals, missing logs Mon–Sat, approval aging, overdue issues, missing weekly/monthly report). Members see only assigned projects (`projectService.getAllProjects`).
- Reports: `reportService.compile` snapshots data into the document `details.snapshot` at save; progress compared as-of min(period end, today); weekly/monthly editor can write actuals to the schedule.
- File uploads are stored in PostgreSQL bytea (documents, daily_log_files) and on disk `backend/uploads` (photos). Serve only via `sendStoredFile` (inline only PDF/PNG/JPEG/WebP/GIF) — stored XSS was fixed this way.

## Conventions
- Frontend: always `esc()` user data in HTML strings; inline onclick args pass ids only. Vietnamese labels. Functions are long one-liners — edit with exact-string Edit, re-grep after edits.
- Backend errors: `httpError(status, msg)` pattern; routes return Vietnamese `{error}` messages; 409 for state conflicts.
- Audit: `req.audit(entity, id, action, before, after, userId)` on every write.
- Time: Vietnam = UTC+7 (`todayVN()` helpers); DATE columns are strings.

## Working agreements (user decisions 2026-09-28)
- **Only Claude Code edits this folder** (OpenAI Codex no longer used). If a file changed unexpectedly, say so instead of silently overwriting.
- One feature per session; keep this file and `docs/CODEMAP.md` updated when adding files/functions/rules (that is what makes new sessions cheap).
- Model: Sonnet for routine edits; Opus for permission/workflow design, migrations on real data, security, large refactors.
- Git (local only, no remote): `C:\Program Files\Git\cmd\git.exe` (may not be on PATH in the tool shell — use full path). Repo initialized 2026-09-28, first commit `a1546c1` = build 2026-10-06.1. `core.autocrlf=false`. Start a session with `git log --oneline -n 10` + `git status --short` to see what changed since last time (incl. user's own edits); use `git diff` instead of re-reading files. **Commit after each verified change** (message in Vietnamese: what + why + build id). Before committing, confirm no secret is staged (`.env`, `Token*.txt`, `Pas user.xlsx`, backups, uploads are ignored).
- Bộ kiểm thử giao diện đã xong (14 ca, `backend/tests/ui/`, xong 28/09/2026) — đây là lưới an toàn cho đợt tách `index.html`.
- Next planned big task (own session, Opus): tách `index.html` thành các file JS theo tính năng; điều kiện nghiệm thu = 14 ca giao diện vẫn xanh **mà không phải sửa nội dung ca nào**. Sau đó làm nhóm P2 (12 ca còn lại trong `docs/superpowers/specs/2026-09-28-kiem-thu-giao-dien-design.md`).

## Known issues / hazards
- `JWT_SECRET` in `backend/.env` is still the placeholder (security banner shown). `Token eyJ….txt` and `Pas user.xlsx` in root contain secrets — do not open, do not publish, never commit.
- Old `*.bak*`, `PROJECT_TREE.*`, `encoding-report.json`, `index-*check.js`, `patch-index.py` were moved to `D:\Setup\QLGS-HeThong\ChatGPT\_archive-VINA-MVP-02` (outside the project). `web-public/` is a generated copy — never edit.
- Real data quirk: account `nthanhb` (formerly `hung`) and `dvhung` (email khanh@) — see `CAP-NHAT` Đợt 11.
