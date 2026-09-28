# Thiết kế: tách `index.html` thành các file JS theo tính năng (Giai đoạn 2)

Ngày: 2026-09-28 · Trạng thái: chờ duyệt · Tiền đề: bộ 14 ca kiểm thử giao diện (`backend/tests/ui/`) đã xanh, commit `c984874`

## 1. Mục tiêu và lý do

`index.html` hiện ~270 KB: 7 khối `<script>` nội tuyến ≈ **232 KB / 256 hàm top-level** (khối #1 = 137 KB / 158 hàm, #6 = 49 KB / 51 hàm, #8 = 40 KB / 47 hàm, ba khối nhỏ ~3 KB). Mọi lần sửa một tính năng đều phải mở một tệp khổng lồ; tìm hàm phải grep; hai người (hoặc hai phiên) sửa hai tính năng khác nhau vẫn đụng cùng một tệp.

Mục tiêu: mỗi tính năng một file JS ≤ ~35 KB, nạp bằng `<script src>` cổ điển theo đúng thứ tự hiện tại. `index.html` còn lại là HTML + CSS + các thẻ `<script src>`.

**Không đổi hành vi ứng dụng.** Không sửa một dòng logic nào, không đổi tên hàm, không đổi giao diện. Đây là thao tác di chuyển mã.

Thành công nghĩa là: 14 ca kiểm thử giao diện xanh **mà không sửa nội dung ca nào**, regression xanh, `check-split.js` chứng minh không mất/không sửa mã, và mỗi file mới ≤ ~35 KB.

Ngoài phạm vi (cố ý bỏ): chuyển sang ES module, thêm bundler/minify, đổi CSS, gộp/bỏ hàm trùng lặp, sửa lỗi phát hiện dọc đường (ghi lại, báo người dùng, làm ở đợt khác).

## 2. Quyết định đã chốt với người dùng (2026-09-28)

| Vấn đề | Chốt |
|---|---|
| Mức tách | ~10–12 file theo tính năng, cắt đúng biên hàm top-level |
| Nơi đặt | Thư mục `js/` ở gốc dự án, phục vụ bằng **một** mount tĩnh |
| Kiểu nạp | `<script src>` cổ điển, giữ nguyên thứ tự nạp → phạm vi biến toàn cục không đổi, `onclick` nội tuyến vẫn gọi được hàm |
| Không làm | ES module (phải phơi hàng trăm hàm ra `window` vì HTML dùng `onclick` khắp nơi) |

## 3. Vì sao giữ `<script>` cổ điển là an toàn

Nhiều thẻ `<script>` không-module dùng **chung một phạm vi toàn cục** và chạy **theo thứ tự xuất hiện**, hệt như nhiều khối nội tuyến hiện nay. Vì vậy:
- Hàm khai báo ở file sau vẫn gọi được từ `onclick` trong HTML (onclick chỉ chạy khi người dùng bấm, lúc đó mọi file đã nạp).
- Rủi ro thật duy nhất là **câu lệnh top-level** (chạy ngay khi nạp) gọi thứ mà file nạp sau mới định nghĩa. Giữ nguyên thứ tự cũ thì rủi ro này không phát sinh; `check-split.js` + 14 ca kiểm thử là lưới bắt.

## 4. Bốn chỗ trong dự án đang liệt kê tệp tĩnh — phải sửa cả bốn

Đã kiểm tra thực tế:

| Chỗ | Hiện tại | Sau khi tách |
|---|---|---|
| `backend/src/app.js` | Một `app.get()` **cho từng tệp** (`/`, `/api.js`, `/sw.js`, `/favicon.ico`, logo) — không có `express.static` | Thêm **một** `app.use('/js', express.static(path.join(webRoot,'js')))` (chỉ đọc, không cần thêm route cho từng file về sau) |
| `start-dev.ps1` | Chép sang `web-public/` theo danh sách tên tệp cố định | Chép thêm **cả thư mục** `js/` |
| `sw.js` `SHELL_FILES` | `['./', './api.js', './favicon.ico']` | Thêm từng file `./js/…` (service worker cần danh sách tường minh để cache khi ngoại tuyến) |
| `backend/scripts/check-frontend.js` | Kiểm khối nội tuyến + `api.js` + `sw.js` | Kiểm thêm **mọi** `js/*.js`; và kiểm **mỗi file `js/*.js` đều có trong `SHELL_FILES` của `sw.js` và có thẻ `<script src>` trong `index.html`** — quên một trong hai là app hỏng khi ngoại tuyến hoặc mất hẳn một tính năng, nên phải bắt bằng máy chứ không bằng trí nhớ |

## 5. Danh sách file (thứ tự nạp = thứ tự số)

Tiền tố số **là** thứ tự nạp, để đọc tên file là biết thứ tự — điều này quan trọng vì thứ tự quyết định tính đúng đắn.

| File | Nội dung (nhóm hàm theo `docs/CODEMAP.md`) |
|---|---|
| `js/01-core.js` | `db`, `persistLocal`, `save`, `queueSync`, `audit`, `esc`, `fmt`, `progressDate`, `todayIso`, `openModal`/`closeModal`, `goPage`, `renderAll`, `updateNet`, gắn sự kiện nav |
| `js/02-quyen.js` | `qualityPermissions`, `loadQualityPermissions`, `myPerms`, `canApproveIn`, `canDeleteIn`, `deleteBtn`, `docCanDecide`, `canCreateDocIn`, `canModifyDoc`, `canManageAssignments`, `canEditProject`, `isLogLead`, `defaultPermsFor`, `LEAD_DEFAULT_PERMS`, `isLeadTitle`, `PERM_LABELS` |
| `js/03-cong-trinh.js` | `renderProjects`, `projectRows`, `openProject`, `saveProject`, `openProjectDetail`, `renderProjectDetail` |
| `js/04-tien-do.js` | `loadProjectProgressPlans`, `renderProjectProgress`, `sCurveSvg`, `openProgressPlan`, `saveProgressPlan`, `deleteProgressPlan`, `openProgressActuals`, `saveProgressActuals`, `ITEM_STATUS` |
| `js/05-nhat-ky.js` | `renderLogs`, `logActionsHtml`, `logAction`, `logBulk`, `openLog`, `saveLog`, `showLogFiles`, `showLogPhotos`, `exportDailyLog`, `syncDailyLogsFromApi`, `LOG_STATUS` |
| `js/06-ho-so-bao-cao.js` | `renderDocs`, `viewDoc`, `openDoc`, `saveDoc`, `docWorkflow`, `docFileLinks`, `openServerFile`, `safeFileBlob`, `syncDocumentsFromApi`, `syncLegacyLocalDocs`, `DOC_STATUS`, và nhóm Báo cáo (`renderReports`, `openReport`, `compileReport`, `renderReportEditor`, `saveReport`, `reportBodyHtml`, `collectReportActuals`, `viewReport`, `printReport`) |
| `js/07-chat-luong.js` | `renderIssues`, `openIssue`, `saveQualityDocument`, `viewIssue`, `printQualityDocument`, `qualityLetterhead` |
| `js/08-nhan-su.js` | `loadProjectTeamDirectory`, `fetchTeam`, `teamTableHtml`, `accountCell`, `openTeamMember`, `onTeamAccountChange`, `permEditorHtml`, `readPermEditor`, `refreshPermDefaults`, `saveTeamMember`, `usernameSuggestions`, `showRenameUsername`, `openAccountFix`, `resetTeamPassword`, `showAccountSlip`, `loadSettingsProjects`, `loadSettingsTeam`, `TITLE_OPTIONS` |
| `js/09-duyet.js` | `openReviewDecision`, `submitReviewDecision`, `reviewBlockHtml`, `returnedChip`, `loadReviewHistory`, `loadInbox`, `renderInbox`, `updateInboxBadge`, `isReviewer`, `applyInboxNavVisibility`, `REVIEW_ACTION` |
| `js/10-thung-rac.js` | `deleteContent`, `confirmDeleteContent`, `loadTrash`, `renderTrash`, `restoreTrash`, `purgeTrash`, `applyTrashNavVisibility`, `DELETE_API` |
| `js/11-tong-quan.js` | `loadPortfolio`, `renderPortfolio`, `loadProjectHealth`, `goAlertTarget`, `alertItemHtml`, `healthChip`, `pctBar`, `renderDashboard` |
| `js/12-dang-nhap.js` | `vinaDoLogin` và mã màn hình đăng nhập, `openChangePassword`, `saveChangePassword`, `forcePasswordChange`, `checkServerMigrations`, `APP_BUILD`, `vinaLogout`, các câu lệnh khởi động cuối trang (`window.addEventListener('load', …)`) |

Ba khối nhỏ hiện nay không có hàm top-level (bộ quan sát font, mã keo ~3 KB) đi vào file **đúng vị trí thứ tự** của nó, đặt tên theo vai trò, ví dụ `js/04b-font-fix.js`.

**Quy tắc phân bổ khi không rõ:** hàm nào không thuộc rõ nhóm nào thì để lại `js/01-core.js`. Không tạo file thứ 13 chỉ để chứa vài hàm lẻ; thà một file hơi lớn còn hơn một cấu trúc giả.

## 6. Lưới an toàn: `backend/scripts/check-split.js`

Chạy: `node backend/scripts/check-split.js <commit-truoc-khi-tach> [--bytes]`

- Lấy `index.html` của commit đó (`git show <commit>:index.html`), trích JS nội tuyến theo thứ tự.
- Lấy JS hiện tại: khối nội tuyến còn lại của `index.html` + `js/*.js` theo thứ tự nạp đọc từ chính các thẻ `<script src>` trong `index.html` (không hard-code danh sách).
- `--bytes`: hai bên nối lại phải **giống từng byte** sau khi bỏ khoảng trắng ở hai đầu mỗi khối → dùng cho Giai đoạn 1 (tách nguyên văn).
- Mặc định: cắt cả hai bên thành **đơn vị top-level** (khai báo hàm / `const` / `let` / `class` / câu lệnh ở mức ngoài cùng), chuẩn hoá xuống dòng, **sắp xếp rồi so** → dùng cho Giai đoạn 2 (di chuyển nguyên khối giữa các file). Báo rõ đơn vị nào thiếu, đơn vị nào thừa, đơn vị nào bị sửa nội dung.

Lý do cần: 14 ca kiểm thử phủ 14 luồng trong ~256 hàm. Script này mới trả lời được câu "có mất mã hay sửa nhầm mã nào không".

## 7. Bốn giai đoạn (mỗi giai đoạn một commit, tự nghiệm thu)

| GĐ | Làm | Nghiệm thu |
|---|---|---|
| 0 | Hạ tầng: mount tĩnh `/js`, `start-dev.ps1` chép thư mục, `sw.js` hỗ trợ danh sách file `js/`, `check-frontend.js` quét `js/*.js`, viết `check-split.js`. **Chưa di chuyển mã** (thư mục `js/` còn rỗng hoặc có 1 file rỗng để kiểm đường phục vụ). | Bộ giao diện 15/15, regression 40/40 (chứng tỏ hạ tầng không phá gì); mở `/js/<file>` trả 200 |
| 1 | Tách 7 khối nội tuyến **nguyên văn** ra file theo thứ tự; `index.html` chỉ còn thẻ `<script src>` | `check-split.js <commit> --bytes` báo **giống từng byte**; `check-frontend.js` 0 lỗi; 15/15; 40/40 |
| 2 | Gom thành ~12 file theo mục 5 bằng cách **di chuyển nguyên khối** từng đơn vị top-level | `check-split.js <commit>` báo tập đơn vị **không đổi**; 15/15; 40/40; mỗi file ≤ ~35 KB |
| 3 | Tài liệu: `docs/CODEMAP.md` (bảng hàm → file), `CLAUDE.md` (thay quy tắc "mã mới vào khối `<script>` cuối" thành "vào file tính năng tương ứng"), `CAP-NHAT`, `KET-QUA`; bump build 3 chỗ | `check-frontend.js` khớp build; chạy trọn bộ giao diện **2 lần**; regression 1 lần |

Nếu một giai đoạn đỏ: dừng, không đi tiếp, sửa cho xanh rồi mới sang giai đoạn sau. Không gộp hai giai đoạn vào một commit.

## 8. Rủi ro và cách xử lý

- **Câu lệnh top-level gọi hàm của file nạp sau** → giữ nguyên thứ tự cũ; `check-split` + 14 ca bắt; nếu vẫn vỡ thì chuyển câu lệnh đó xuống `js/12-dang-nhap.js` (file cuối) và ghi lại lý do.
- **Máy chủ chạy bản cũ sẽ 404 các file `js/`** → `sw.js` bump cache, banner lệch phiên bản đã có; hướng dẫn người dùng `run.bat` + Ctrl+F5 ghi rõ trong `CAP-NHAT`.
- **`web-public/` là bản sao sinh tự động** → chỉ sửa ở gốc; `start-dev.ps1` chép lại mỗi lần chạy.
- **Ngoại tuyến (service worker)**: nếu thiếu file trong `SHELL_FILES`, app hỏng khi mất mạng — sau Giai đoạn 1 phải thử: nạp trang, chặn mạng, tải lại, app vẫn mở được. Kiểm bằng tay một lần ở Giai đoạn 1, không tự động hoá (ca P2 "ngoại tuyến" sẽ phủ sau).
- **Tệp dài một dòng**: nhiều hàm trong `index.html` là một dòng rất dài. Cắt theo biên đơn vị top-level chứ không theo dòng; `node --check` từng file sau mỗi lần cắt.

## 9. Giai đoạn 3 (sau đợt này, phiên riêng)

Nhóm P2 gồm 12 ca kiểm thử giao diện còn lại trong `docs/superpowers/specs/2026-09-28-kiem-thu-giao-dien-design.md` (đính kèm tệp, tiến độ/đường S, báo cáo tuần, XSS, ngoại tuyến, hết hạn token, lệch tên tài khoản, nhật ký hàng loạt, sửa quyền theo phân công, chuyển cấp công ty).
