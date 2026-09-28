# CODEMAP — where things are (read this instead of whole files)

Line numbers drift; locate with `Grep "function <name>" index.html -n`, then Read ~30 lines around it.

## Backend (backend/src)
| Feature | Route file | Service file | Tables |
|---|---|---|---|
| Auth, login lockout, must-change-password | routes/auth.js, middleware/auth.js | services/userService.js | users |
| Users/accounts (create, rename, reset pw, usage, freeze author) | routes/users.js | services/userService.js | users |
| Per-project permissions | — | services/permissionService.js (ALL, effective, isLeadTitle, forUser, allForUser, approverProjectIds, canApprove, requirePermission) | project_members, project_member_access, project_personnel |
| Project access guard | middleware/projectAccess.js (query/body/projectParam/record) | — | project_members |
| Projects + progress plans (Excel parse, actuals) | routes/projectRoutes.js | services/projectService.js, projectProgressService.js, scheduleParser.js, xlsxReader.js | projects, project_progress_plans, project_schedule_items, project_schedule_actuals |
| Personnel/team, link accounts | routes/projectPersonnel.js, routes/projectMembers.js | services/projectPersonnelService.js, projectMemberService.js | project_personnel, project_members |
| Daily logs (workflow, files, photos, bulk, delete) | routes/dailyLogs.js | services/dailyLogService.js, attachmentService.js | daily_logs, daily_log_files, attachments |
| Documents & reports (workflow, files, delete) | routes/documents.js | services/documentService.js | documents, document_files, document_sequences |
| Quality issues | routes/issues.js | services/issueService.js | issues |
| Review notes, inbox, escalate | routes/reviews.js (+ workflow in dailyLogs/documents) | services/reviewService.js | review_notes |
| Report compile, portfolio, health/alerts | routes/reports.js | services/reportService.js, portfolioService.js (THRESHOLDS) | (reads all) |
| Recycle bin | routes/recycleBin.js | services/recycleService.js (SPEC per entity) | deleted_records |
| Safe file serving | — | utils/fileSafety.js | — |

App wiring & health (build, pending migrations, security warnings): `src/app.js`. Build id: `src/build.js`.

## Frontend (index.html) — function groups
- **Core/state**: `db` object, `persistLocal`, `save`, `queueSync`, `mergeProjectsFromServer`, `audit`, `esc`, `fmt`, `progressDate`, `todayIso`, `openModal`/`closeModal`, `goPage`, `renderAll`, nav click binding (`nav button` onclick ~ after `updateNet`).
- **Permissions (client mirror)**: `qualityPermissions`, `loadQualityPermissions` (GET /project-members/my-permissions), `myPerms`, `canApproveIn`, `canDeleteIn`, `deleteBtn`, `docCanDecide`, `canCreateDocIn`, `canModifyDoc`, `canManageAssignments` (Admin/Director), `canEditProject`, `isLogLead(pid)`.
- **Dashboard/portfolio/alerts**: `loadPortfolio`, `renderPortfolio`, `loadProjectHealth` (#pdHealth), `goAlertTarget`, `healthChip`, `pctBar`; legacy `renderDashboard` (local stats, inside <details>).
- **Projects**: `renderProjects`, `projectRows`, `openProject`, `saveProject`, `openProjectDetail`, `renderProjectDetail`.
- **Progress schedule**: `loadProjectProgressPlans`, `renderProjectProgress`, `sCurveSvg`, `openProgressPlan` (editor), `saveProgressPlan`, `deleteProgressPlan`, `openProgressActuals`, `saveProgressActuals`, `ITEM_STATUS`.
- **Daily logs**: `renderLogs`, `logActionsHtml`, `logAction` (→ `openReviewDecision` for approve/reject), `logBulk`, `openLog`, `saveLog`, `showLogFiles`, `showLogPhotos`, `exportDailyLog`; server sync `syncDailyLogsFromApi` (+ api.js `syncDailyLogs*`).
- **Quality issues**: `renderIssues`, `openIssue`, `saveQualityDocument`, `viewIssue`, `printQualityDocument`, `qualityLetterhead`.
- **Documents**: `renderDocs`, `viewDoc`, `openDoc`, `saveDoc`, `docWorkflow`, `docFileLinks`, `openServerFile`/`safeFileBlob`, `syncDocumentsFromApi`, legacy local docs `syncLegacyLocalDocs`.
- **Reports**: `renderReports`, `openReport`, `compileReport`, `renderReportEditor`, `saveReport` (writes manual actuals first), `reportBodyHtml` (+ `reportItemsTableHtml`, `reportAlertsHtml`), `reportProgressInputHtml`, `collectReportActuals`, `viewReport`, `printReport`.
- **Personnel/accounts**: `loadProjectTeamDirectory`, `fetchTeam`, `teamTableHtml`, `accountCell` (mismatch chip), `openTeamMember` (modal), `onTeamAccountChange`, `permEditorHtml`/`readPermEditor`/`refreshPermDefaults`, `defaultPermsFor`, `saveTeamMember`, `usernameSuggestions`/`checkUsernameInput`, `showRenameUsername`/`saveRenameUsername`, `openAccountFix`/`confirmAccountOwner`, `resetTeamPassword`, `showAccountSlip`, settings page `loadSettingsProjects`/`loadSettingsTeam`.
- **Review/inbox**: `openReviewDecision`, `submitReviewDecision`, `reviewBlockHtml`, `returnedChip`, `loadReviewHistory`, `loadInbox`, `renderInbox`, `updateInboxBadge`, `isReviewer`, `applyInboxNavVisibility`.
- **Recycle bin**: `deleteContent`, `confirmDeleteContent`, `loadTrash`, `renderTrash`, `restoreTrash`, `purgeTrash`, `applyTrashNavVisibility`.
- **Auth UI**: login `vinaDoLogin`, `openChangePassword`, `forcePasswordChange`, `checkServerMigrations` (build/migration/secret banners, `APP_BUILD`).

Newer features live in the LAST `<script>` block (after the font-fix MutationObserver script). Put new feature code there; hook into older code with small edits.

## api.js
`apiRequest` (401 → logout; 403 MUST_CHANGE_PASSWORD → forcePasswordChange), mappers `mapProjectFromApi`, `mapDailyLogFromApi` (lastReview, fileCount…), `mapDocumentFromApi`, sync of offline queue.

## Tests
`backend/tests/lib/testDb.js` — `createTestDb(dbUrl)` → `{ psql, psqlFile, setupAll, startServer({port}), waitHealth(base), dbName, ROOT }`. Dựng CSDL thử (schema gốc + migration cũ + dữ liệu lỗi giống thực tế + migration mới) và chạy backend. Dùng chung cho regression và bộ giao diện — sửa ở đây là sửa cho cả hai.

`backend/tests/ui/` — kiểm thử giao diện bằng `playwright-core` (Chrome cài trên máy, `channel:'chrome'`), backend cổng **3103**, CSDL `vina_ui_claude`. Một tiến trình: `all.test.js` gọi `test.before(startApp)` rồi `require` từng module trong `cases/`. Helper `ui/helpers.js`: `uiTest(name, fn)` (context mới mỗi ca, chặn service worker, tự nhận `alert`/`confirm` vào `page.__dialogs`, chụp ảnh + văn bản trang vào `backend/tests/ui-artifacts/` khi lỗi), `loginViaApi` (nạp phiên bằng `addInitScript` **trước** khi trang chạy script — gọi lại để đổi tài khoản), `loginViaForm`, `openPage`, `navVisible`, `apiAs(token)`, `tokenOf(who)`, `projectIdByContract(token, '001')`.
Chạy: `backend\scripts\run-ui-tests.cmd [db] [mẫu tên ca]` → `backend\tests\last-ui-test.txt`. Mẫu tên ca là regex, **không dùng dấu `|`** (qua PowerShell/cmd sẽ vỡ) — dùng `GD-0[67]`.
Các ca: GD-01 đăng nhập · GD-02 buộc đổi mật khẩu ban đầu · GD-03 nav theo vai trò · GD-04 phạm vi công trình · GD-05 tổng quan + bấm cảnh báo · GD-06 lập/gửi nhật ký · GD-07 duyệt qua "Việc cần duyệt" · GD-08 trả lại cần ý kiến · GD-09 khóa sửa sau duyệt · GD-10 luồng hồ sơ + mã tự sinh · GD-11 quyền mặc định theo chức danh · GD-12/GD-12b thùng rác · HZ-01/HZ-02 chống "xanh giả" (trạng thái sạch, hộp thoại được xử lý).
Selector hay dùng: `#loginScreen/#loginUsername/#loginPassword/#loginButton/#loginError`; `nav button[data-page="…"]` (inbox/trash mặc định `display:none` → luôn dùng `isVisible()`, không dùng `count()`); `#modal.show`/`#mtitle`/`#mbody`; nhật ký `#newLogButton`, `#logsTable`, modal `#lproj #ldate #lshift #lwork`; hồ sơ `#docsTable`, `+ Tạo hồ sơ`, `#dname`, `#docSaveBtn`, nút luồng nằm trong modal **Xem**; duyệt `#rvComment` + `.primary` = Phê duyệt, `.danger` = Yêu cầu chỉnh sửa; xóa `#delReason` + `.danger` + `#delMsg`; nhân sự `#tmTitle` (select), `.tmPerm`, `#tmDefaultsText` (chỉ hiện với người đã liên kết tài khoản); thùng rác `#trashBody`, nút "Khôi phục"/"Xóa vĩnh viễn".

`backend/scripts/ui-ctx.js` — in ~240 ký tự quanh một chuỗi trong `index.html` (đọc markup thật mà không mở cả file 270 KB): `node backend/scripts/ui-ctx.js "goAlertTarget(" "#delReason"`.

`backend/tests/regression.test.js` — one file, ordered tests sharing state (`P` = project ids by contract_no '001','002','003'; tokens: admin, thanhb (engineer, GS viên @001), hung (lead @001), son, tuan (unassigned), duong (director)). Append new tests at the end.
`backend/tests/smoke-test.js` — against the live server (read-only unless --write).
