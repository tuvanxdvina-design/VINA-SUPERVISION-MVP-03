# Báo cáo rà soát VINA-SUPERVISION MVP-02 — 26/09/2026

Phạm vi: toàn bộ mã nguồn trong `VINA-SUPERVISION-MVP-02.rar` (frontend `index.html`/`api.js`, backend Node/Express, schema + 9 migration, tập lệnh chạy, bản sao lưu).
Cách kiểm tra: dựng lại PostgreSQL từ schema + migration, chạy backend thật, tái hiện lỗi bằng dữ liệu mô phỏng, kiểm thử API bằng curl và giao diện bằng trình duyệt tự động (desktop + điện thoại).
Giới hạn: không có cơ sở dữ liệu đang chạy của anh (bản sao lưu mới nhất bị hỏng, xem A1), nên dữ liệu thật cần kiểm bằng `backend/scripts/diagnose-duplicates.sql` trước khi cập nhật.

---

## 1. Ba lỗi anh nêu — nguyên nhân gốc và cách đã sửa

### 1.1 "Nguyễn Thành B" lặp lại, sai công việc được giao, hiện "Chưa liên kết tài khoản"

**Nguyên nhân (đã tái hiện được, B hiện 3 dòng):** danh sách nhân sự được ghép ở trình duyệt từ **3 nguồn độc lập**, và ghép bằng **chuỗi họ tên**:

| Nguồn | Lưu ở đâu | Có chức danh? | Có tài khoản? |
|---|---|---|---|
| `project_members` (phân công tài khoản) | PostgreSQL | thường rỗng → "Chưa nhập" | Có |
| `project_personnel` (nhân sự công trình) | PostgreSQL | Có (TVGS trưởng…) | Không có cột liên kết |
| `db.people` (nhập ở trang Nhân sự) | localStorage từng máy | Có | Không |

Chỉ cần tên khác nhau "vô hình" là tách thành nhiều người: gõ Unicode dựng sẵn/tổ hợp (Unikey, copy từ Word), thừa khoảng trắng, hoặc đổi tên ở một nguồn. Kết quả: 1 dòng tài khoản (chức danh trống) + 1–2 dòng nhân sự (chức danh đúng, "Chưa liên kết tài khoản"). Thêm vào đó, khi Admin/Giám đốc tạo công trình, hệ thống tự phân công chính họ → Admin cũng hiện như một "nhân sự" không chức danh.

**Phương án đã cân nhắc:**

| Phương án | Ưu | Nhược | Kết luận |
|---|---|---|---|
| A. Giữ 3 nguồn, chỉ chuẩn hóa tên (NFC, bỏ khoảng trắng) khi ghép | Sửa nhanh, không đổi DB | Vẫn ghép theo tên: đổi tên là tách, hai người trùng tên bị gộp nhầm | Loại |
| **B. Nhân sự là danh sách chính, liên kết tài khoản bằng `user_id`** | Mỗi người 1 dòng; nhân sự không có tài khoản vẫn quản lý được; đổi tên không vỡ liên kết | Cần 1 migration | **Chọn** |
| C. Bắt buộc mọi nhân sự phải có tài khoản | Đơn giản nhất về dữ liệu | Không thực tế: thành viên tổ TVGS trong quyết định không phải ai cũng đăng nhập | Loại |

**Đã làm:**
- Migration `20260926_personnel_account_link.sql`: thêm `project_personnel.user_id`; chuẩn hóa họ tên (NFC + khoảng trắng); gộp dòng trùng (giữ bản cập nhật mới nhất, gộp chứng chỉ, dòng cũ chuyển INACTIVE — không xóa); tự liên kết khi tên khớp **duy nhất** một tài khoản đã phân công vào đúng công trình; chỉ mục chống trùng từ nay về sau; đồng bộ chức danh; bỏ phân công tự sinh của Admin/Giám đốc (họ vẫn có toàn quyền mọi công trình).
- API mới `GET /api/project-personnel/project/:id/team` trả danh sách hợp nhất do máy chủ tính (không ghép ở trình duyệt nữa).
- Mọi đường ghi (thêm nhân sự, phân công tài khoản, liên kết) đều kiểm trùng theo tên chuẩn hóa → **liên kết vào người đã có thay vì tạo dòng mới**.
- Chức danh chỉ còn một nguồn: sửa ở đâu cũng đồng bộ cả hồ sơ nhân sự và phân công.

### 1.2 "Quản lý quyền": danh sách Công trình A lặp lại và không phân quyền được

**Nguyên nhân (3 lớp):**
1. **Lặp công trình:** công trình tạo trên thiết bị bị máy chủ từ chối (trùng mã/số hợp đồng → HTTP 409) nằm mãi trong hàng đợi và vẫn hiện trong danh sách. Chọn nhầm bản này để phân công → máy chủ báo lỗi khóa ngoại (500) vì công trình không tồn tại trên máy chủ.
2. **Lặp giao diện:** cùng một nhóm người hiện 3 lần trên một màn hình (ô chọn "Nhân sự GS đã phân công" + khung sửa + bảng bên dưới).
3. **Tick quyền nhưng không có tác dụng:** quyền Xem/Sửa/Thêm/Tải xuống chỉ được máy chủ kiểm ở phân hệ Chất lượng; Nhật ký vẫn xét theo vai trò. Ngoài ra khi chưa tùy chỉnh, máy chủ mặc định chỉ có "Xem" → kỹ sư được phân công không tạo được văn bản chất lượng.

**Đã làm:**
- Công trình chưa có trên máy chủ được gắn cờ "Chưa đồng bộ / Máy chủ từ chối: …", **không đưa vào ô chọn phân công**, không thử gửi lại vô hạn (hiện số "Bị từ chối" ở Dashboard). Dữ liệu vẫn giữ trên thiết bị để anh sửa mã rồi gửi lại.
- Máy chủ trả 404 rõ ràng "Công trình chưa có trên máy chủ" thay vì lỗi 500.
- Bộ quyền hiệu lực thống nhất (`permissionService.js`) áp dụng cho **Nhật ký** (lập, sửa, ảnh) và **Chất lượng**:
  - Chưa tùy chỉnh → **mặc định theo vai trò**: Trưởng TVGS = Xem/Thêm/Sửa/Tải xuống; Kỹ sư = Xem/Thêm/Tải xuống (giữ đúng hành vi cũ của nhật ký).
  - Tùy chỉnh → đúng các ô đã tick. Có nút quay lại "Theo mặc định vai trò".
  - Admin/Giám đốc: toàn quyền.
- Màn hình Thiết lập gọn lại: chọn công trình → bảng nhân sự (mỗi người 1 dòng) → bấm vào người để chọn quyền.

### 1.3 Bấm vào nhân sự → hiện Quyền truy cập để chọn

Đã thiết kế lại (trang **Nhân sự**, **Chi tiết công trình** và **Thiết lập** dùng chung một bảng + một cửa sổ):

- Bảng: Nhân sự | Chức danh tại công trình | Tài khoản | Quyền truy cập (nhãn Xem/Thêm/Sửa/Tải xuống, ghi rõ "mặc định vai trò") | Chứng chỉ.
- Bấm một dòng → cửa sổ gồm: họ tên, chức danh, chứng chỉ; **Tài khoản đăng nhập** (liên kết / thu hồi quyền, giữ tên trong danh sách); **Quyền truy cập tại công trình** (Theo mặc định vai trò / Tùy chỉnh + 4 ô chọn + "Làm việc ở đâu"); nút Lưu, Rút khỏi công trình.
- Ô chọn tài khoản tự loại các tài khoản đã gắn với người khác trong cùng công trình.
- Kỹ sư/GS viên bấm vào chỉ xem, không sửa được.
- Nhật ký: ô chọn công trình khi lập mới chỉ liệt kê công trình mà tài khoản có quyền "Thêm".

---

## 2. Các điểm chưa thống nhất / rủi ro khác (chưa sửa — cần anh quyết)

Mức: 🔴 xử lý trước khi dùng dữ liệu thật · 🟠 trong 2 tuần · 🟡 cải tiến.

| # | Mức | Phát hiện (đã kiểm chứng) | Hệ quả | Đề xuất |
|---|---|---|---|---|
| A1 | 🔴 | `backups/…2026-09-23-production-ready.dump` **hỏng**: là UTF-16 do dùng dấu `>` của PowerShell; 2.264 byte đã bị thay ký tự lỗi, `pg_restore` không đọc được. | Bản sao lưu "sẵn sàng production" không khôi phục được. | Dùng `backup-db.ps1` (đã kèm, tự kiểm tra tệp sau khi sao lưu). Sao lưu lại ngay. |
| A2 | 🔴 | Trong thư mục dự án có `Token eyJ….txt` (JWT còn hạn) và `Pas user.xlsx` (tên tệp cho thấy chứa mật khẩu — tôi không mở). `JWT_SECRET` là chuỗi mẫu `your_super_secret_key_change_in_production_123456`. | Ai có thư mục/khóa này có thể giả mạo token Admin. | Xóa 2 tệp khỏi thư mục dự án; đổi `JWT_SECRET` thành chuỗi ngẫu nhiên ≥32 ký tự (mọi người phải đăng nhập lại). |
| A3 | 🔴 | **Lệch schema:** `schema-VINA-PROD-01.sql` thiếu nội dung của 9 migration; API ghi cột `issues.source_type` nhưng không migration nào tạo; bảng quyền được tạo ngầm lúc chạy; `docker-compose.yml` dùng user `postgres/postgres` còn `.env` dùng `vina_user`. | Cài mới trên máy khác sẽ lỗi (không kết nối được, tạo văn bản chất lượng lỗi 500). | Đã thêm `scripts/migrate.js` (ghi nhận migration đã chạy) và bổ sung cột/bảng thiếu vào migration 20260926. Nên gộp lại thành 1 schema chuẩn sau khi ổn định. |
| A4 | 🔴 | **Dữ liệu chỉ nằm trên trình duyệt:** Hồ sơ pháp lý + tệp đính kèm, tệp hợp đồng TVGS/nhà thầu, chi tiết văn bản chất lượng (loại văn bản, thành phần, chữ ký, bản ký scan) lưu base64 trong localStorage. Hàng đợi `docs` không có hàm đồng bộ. Văn bản chất lượng chỉ gửi tiêu đề/nội dung/mức độ; trạng thái "Đã phát hành/Đã ký" không lên máy chủ. | localStorage giới hạn ~5–10 MB: vài tệp PDF là đầy, lưu thất bại âm thầm; đổi máy/xóa trình duyệt là mất; máy khác không thấy. | So sánh: (a) giữ + Xuất JSON — rủi ro mất cao; **(b) lưu tệp trên máy chủ `backend/uploads` + bảng metadata, trường chi tiết lưu JSONB — khuyến nghị**; (c) Object Storage — chưa cần ở quy mô hiện tại. |
| A5 | 🟠 | **Quy trình nhật ký (Quyết định B) chưa dùng được:** giao diện không có nút Gửi/Duyệt/Khóa (API có nhưng không được gọi) → mọi nhật ký mãi ở DRAFT. Admin/Giám đốc sửa được cả nhật ký **đã khóa** — *quyết định 26/09: giữ nguyên, đã ghi riêng `UPDATE_LOCKED` trong lịch sử*. Chưa có luồng "sửa sau duyệt → duyệt lại". API submit/approve/lock trả 200 + `{}` khi sai trạng thái. | Không có căn cứ pháp lý "đã duyệt/đã khóa". | Thêm nút Gửi/Duyệt/Khóa theo vai trò; trả 409 khi sai trạng thái. |
| A6 | ✅ | Ràng buộc `UNIQUE(project_id, log_date, shift)` không chặn trùng khi `shift` rỗng. | Trùng nhật ký ngày. | **Đã sửa 26/09** theo quyết định nhiều ca/ngày: migration 20260927 + ô chọn ca, 1 nhật ký/ca/ngày. |
| A7 | 🟠 | **Mã hồ sơ sinh ở trình duyệt:** `CL-năm-000N`, `HS-năm-000N` đếm theo số bản ghi trên từng máy (Quyết định A chưa áp dụng). | Hai máy sinh trùng mã → máy chủ từ chối (409), bản ghi kẹt hàng đợi. | Sinh mã trên máy chủ bằng `document_sequences` khi đồng bộ; thiết bị chỉ hiện mã tạm "Chờ cấp số". |
| A8 | 🟠 | **Từ vựng trạng thái lẫn lộn:** công trình `ACTIVE` (máy chủ) vs `ĐANG THI CÔNG` (giao diện); văn bản `OPEN/RESOLVED` vs `ĐANG XỬ LÝ/CLOSED/SIGNED`; hồ sơ `ĐÃ XÁC NHẬN` vs `DRAFT/LOCKED`. Ô "Hồ sơ chính thức" ở Dashboard đếm `ĐÃ KHÓA` nên hồ sơ từ máy chủ luôn = 0. | Thống kê sai, lọc sai. | DB chỉ lưu mã (ACTIVE, DRAFT…); giao diện dịch sang tiếng Việt qua 1 bảng nhãn. |
| A9 | 🟠 | Quyền ở giao diện không khớp máy chủ: nút "Sửa công trình" hiện cho Kỹ sư rồi báo lỗi; Hồ sơ cho Kỹ sư tạo ở máy nhưng API hồ sơ chỉ nhận Kỹ sư/Trưởng TVGS, Admin bị chặn; API hồ sơ chưa dùng bộ quyền theo công trình. | Người dùng bấm được nhưng không lưu được. | Áp dụng `permissionService` cho Hồ sơ và Công trình; giao diện ẩn/hiện theo `/project-members/my-permissions`. |
| A10 | 🟠 | Tài khoản: tạo mới luôn gán mật khẩu `demo_hash` → ở `NODE_ENV=production` không đăng nhập được cho tới khi chạy `set-user-password.js`; không có giao diện tạo tài khoản/đặt lại mật khẩu; xóa tài khoản là xóa cứng (vướng khóa ngoại); `GET /api/users/:id` không giới hạn vai trò. | Vận hành phụ thuộc dòng lệnh; lộ SĐT/email. | Trang quản lý tài khoản (tạo + mật khẩu tạm bắt đổi lần đầu, vô hiệu hóa thay cho xóa); giới hạn `GET /users/:id`. |
| A11 | 🟡 | Tập lệnh "sửa lỗi font" chạy `MutationObserver` quét toàn bộ trang sau mỗi thay đổi. | Chậm trên điện thoại, che giấu lỗi gốc. | Đã sửa các chuỗi lỗi còn lại trong `api.js`/`index.html`; sau 1–2 tuần không thấy lỗi thì bỏ tập lệnh này. Nội dung đã thành `?` trong DB không khôi phục được. |
| A12 | 🟡 | Đồng bộ offline: "ghi sau thắng" (không so `version`), UPDATE nhật ký chưa có serverId bị bỏ qua âm thầm. | Hai người sửa cùng lúc mất dữ liệu. | Gửi kèm `version`, máy chủ trả 409 nếu lệch, giao diện cho chọn giữ bản nào. |
| A13 | 🟡 | ~60 tệp `.bak`, bản sao `web-public`, `index-inline-check.js` lẫn trong mã nguồn. | Dễ sửa nhầm tệp, dễ lộ dữ liệu khi chia sẻ thư mục. | Dùng Git (miễn phí); xóa `.bak`. |

---

## 3. Lộ trình đề xuất

| Tuần | Việc | Đầu ra | KPI nghiệm thu |
|---|---|---|---|
| T0 (hôm nay) | Sao lưu đúng cách → chạy chẩn đoán → cập nhật bản sửa này → kiểm tra | Nhân sự không lặp, phân quyền có tác dụng | 0 dòng ở mục 2 của `diagnose-duplicates.sql`; 100% nhân sự hiện 1 lần; kỹ sư bị bỏ quyền "Thêm" nhận 403 khi lập nhật ký |
| T0 | Xử lý A1, A2 | Sao lưu hợp lệ, khóa bí mật mới | `pg_restore -l` đọc được tệp; token cũ bị từ chối |
| T1 | A5, A6, A9 | Nhật ký có Gửi/Duyệt/Khóa; quyền thống nhất | 1 nhật ký đi đủ DRAFT→LOCKED; không sửa được bản LOCKED |
| T2 | A4, A7 | Hồ sơ/tệp/văn bản chất lượng lưu máy chủ, mã cấp ở máy chủ | Mở trên máy thứ 2 thấy đủ tệp; 0 mã trùng |
| T3 | A8, A10, A12 | Trạng thái thống nhất, quản lý tài khoản, xử lý xung đột | Dashboard khớp số liệu DB; UAT với 2 người sửa đồng thời |

## 4. Rủi ro khi cập nhật bản sửa này & cách xử lý

| Rủi ro | Khả năng | Cách xử lý |
|---|---|---|
| Gộp trùng giữ nhầm chức danh (giữ bản cập nhật mới nhất) | Trung bình | Migration in ra từng nhóm bị gộp; dòng cũ chỉ chuyển INACTIVE, khôi phục được; chạy chẩn đoán trước để biết trước |
| Kỹ sư từng bị lưu quyền chỉ "Xem" (giao diện cũ mặc định tick "Xem" khi sửa chức danh) nay không lập được nhật ký | Trung bình | Vào Nhân sự → bấm người đó → chọn "Theo mặc định vai trò" |
| Admin/Giám đốc biến khỏi danh sách nhân sự công trình | Chắc chắn (có chủ đích) | Vẫn toàn quyền; nếu thật sự là thành viên tổ TVGS, thêm lại bằng "Phân công" kèm chức danh |
| Migration lỗi giữa chừng | Thấp | Chạy trong 1 transaction (lỗi là hoàn tác toàn bộ); đã sao lưu trước |
