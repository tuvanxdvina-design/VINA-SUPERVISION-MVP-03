# Thiết kế: bộ kiểm thử giao diện tự động (Giai đoạn 1)

Ngày: 2026-09-28 · Trạng thái: chờ duyệt · Liên quan: `CLAUDE.md` (Working agreements — việc lớn kế tiếp), `docs/CODEMAP.md`

## 1. Mục tiêu và lý do

Mục tiêu: có một bộ kiểm thử giao diện chạy được bằng một lệnh, khẳng định 12 luồng người dùng lõi của `index.html` vẫn đúng.

Lý do: việc lớn kế tiếp là **tách `index.html` (~270 KB, 7 khối `<script>`) thành nhiều file JS theo tính năng**. Tách mà không có lưới an toàn thì mọi lỗi hồi quy chỉ lộ ra khi người dùng thật gặp. Bộ regression backend hiện có (`backend/tests/regression.test.js`) chỉ kiểm tra API, không kiểm tra phần dựng DOM, quyền phía client, hay các modal.

Thành công nghĩa là: chạy `backend\scripts\run-ui-tests.cmd`, 12 ca đều xanh trên bản hiện tại; sau đợt tách file, vẫn 12 ca xanh mà **không phải sửa nội dung ca nào** (chỉ được sửa phần nạp script nếu cần).

Ngoài phạm vi (cố ý bỏ): so sánh ảnh chụp giao diện (visual regression), kiểm thử đa trình duyệt/điện thoại, kiểm thử trên CSDL thật, và 12 ca nhóm P2 (để phiên sau).

## 2. Quyết định đã chốt với người dùng (2026-09-28)

| Vấn đề | Chốt |
|---|---|
| Công cụ | `playwright-core` (devDependency, ~4 MB, **không tải trình duyệt**) + runner `node:test`, chạy Chrome đã cài trên máy qua `channel: 'chrome'` |
| Phạm vi | 12 ca nhóm P1 (mục 5); nhóm P2 để phiên sau |
| `data-testid` | Được phép thêm vào `index.html` **chỉ khi** không có `id`/nhãn ổn định; gộp một lần sửa, bump build 3 chỗ |
| Dữ liệu thử | Tách phần dựng CSDL + seed ra module chung, cả regression và bộ UI dùng lại |

## 3. Kiến trúc

```
backend/tests/lib/testDb.js     ← tách ra từ regression.test.js (dùng chung)
backend/tests/ui/helpers.js     ← vỏ Playwright + phiên đăng nhập
backend/tests/ui/*.test.js      ← các ca kiểm thử, nhóm theo màn hình
backend/scripts/run-ui-tests.cmd
```

**`backend/tests/lib/testDb.js`** — chuyển nguyên trạng (không đổi hành vi) các hàm đang nằm trong `regression.test.js`: `hasNativePsql`, `psql`, `psqlFile`, `resetTestDatabase`, nạp `schema-VINA-PROD-01.sql` + migration cũ (`< 20260926`), chèn dữ liệu lỗi giống thực tế, chạy migration mới (`>= 20260926`), `startServer({port, dbUrl})` và chờ `/health`. `regression.test.js` sau đó chỉ `require` module này; tiêu chí chấp nhận của bước tách là **chạy lại toàn bộ regression và số ca pass không đổi**.

**`backend/tests/ui/helpers.js`**
- `withApp(fn)`: dựng CSDL `vina_ui_claude`, chạy backend cổng **3103** (3101 = regression, 3102 = người dùng kiểm tra tay), mở Chrome headless qua `chromium.launch({ channel: 'chrome' })`.
- Context: `serviceWorkers: 'block'` (không để `sw.js` phục vụ bản cache cũ), `baseURL http://127.0.0.1:3103/` — backend tự phục vụ `index.html` ở `/`, nên `API_BASE` là `/api` (không đi qua nhánh cổng 8080 trong `api.js`).
- `loginViaApi(page, who)`: gọi `POST /api/auth/login` rồi `localStorage.setItem('vina_supervision_auth', JSON.stringify({token, user, loggedAt}))` đúng dạng `setAuthSession` trong `api.js`, reload trang. Dùng cho 11 ca.
- `loginViaForm(page, who, pw)`: điền `#loginUsername`, `#loginPassword`, bấm `#loginButton`. Chỉ ca GD-01/GD-02 dùng — để bản thân form đăng nhập cũng được kiểm.
- Khi một ca lỗi: lưu ảnh chụp + văn bản DOM vào `backend/tests/ui-artifacts/<mã ca>.png|.txt`.
- Mọi ca tự tạo dữ liệu riêng qua API trước khi thao tác giao diện (không phụ thuộc thứ tự ca).

**Tài khoản fixture** (mật khẩu `demo`): `admin` (ADMIN), `duong` (DIRECTOR), `hung` (TVGS trưởng @001), `thanhb` (GS viên @001), `son`, `tuan` (chưa phân công). Công trình theo `contract_no` `001/002/003`.

**Cách chạy**: `backend\scripts\run-ui-tests.cmd [ten_csdl] [keep]` → ghi kết quả vào `backend\tests\last-ui-test.txt` (cùng khuôn với `run-regression.cmd`; môi trường này in ra màn hình không đáng tin nên luôn ghi ra file rồi đọc). Thêm vào `.gitignore`: `backend/tests/last-ui-test.txt`, `backend/tests/ui-artifacts/`.

**Quy ước chọn phần tử**, theo thứ tự ưu tiên: `id` có sẵn → `nav button[data-page="..."]` → nhãn tiếng Việt hiển thị → `data-testid` mới thêm. Khẳng định dựa trên **điều người dùng thấy** (văn bản, nút hiện/ẩn, trạng thái bản ghi), không dựa vào tên hàm nội bộ — đó là điều kiện để bộ test sống sót qua đợt tách file.

## 4. Sai lệch hiện biết cần xử lý trong lúc làm

- `sw.js` có thể giữ bản cũ của `index.html`: chặn service worker ở tầng context.
- `localStorage` (đối tượng `db`) còn sót giữa các ca: mỗi ca dùng context mới.
- Chrome trên máy tự cập nhật → nếu một ngày `channel: 'chrome'` vỡ, phương án dự phòng là `npx playwright install chromium` (khi đó mới tải ~160 MB).

## 5. 12 ca kiểm thử nhóm P1

| Mã | Tài khoản | Các bước | Kỳ vọng |
|---|---|---|---|
| GD-01 | `hung` | Đăng nhập sai mật khẩu, rồi đăng nhập đúng bằng form | Lần sai: `#loginError` có nội dung, vẫn ở `#loginScreen`; lần đúng: vào app, hiện tên người dùng, không có banner đỏ lệch build |
| GD-02 | tài khoản mới (tạo qua API) | Đăng nhập lần đầu bằng form | Hiện modal buộc đổi mật khẩu, không bỏ qua được; đổi xong dùng app bình thường |
| GD-03 | `tuan`, `hung`, `admin`, `duong` | Vào app, đọc thanh nav | `tuan`: không có "Việc cần duyệt", "Thùng rác", "Thiết lập"; `hung`: có "Việc cần duyệt"; `admin`/`duong`: có đủ |
| GD-04 | `thanhb` | Mở Dashboard rồi trang Công trình | Chỉ thấy công trình `001`; không thấy `002`, `003` |
| GD-05 | `admin` | Mở Dashboard, bấm một cảnh báo trong danh sách | Có chip sức khỏe cho cả 3 công trình; bấm cảnh báo → chuyển đúng trang và đúng bản ghi |
| GD-06 | `thanhb` | Tạo nhật ký mới (DRAFT), gửi duyệt | DRAFT: có nút sửa/gửi duyệt; sau khi gửi: trạng thái SUBMITTED, không còn nút sửa, không có nút duyệt |
| GD-07 | `hung` | Mở "Việc cần duyệt", duyệt nhật ký của GD-06 | Nhật ký có trong hộp việc; sau khi duyệt: APPROVED, lịch sử duyệt hiện người duyệt |
| GD-08 | `hung` | Trả lại nhật ký: bấm từ chối với ghi chú rỗng, rồi với ghi chú | Rỗng: bị chặn, trạng thái không đổi; có ghi chú: RETURNED và `thanhb` thấy chip "bị trả" |
| GD-09 | `thanhb`, `admin` | Mở nhật ký đã APPROVED | `thanhb`: không có nút sửa; `admin`: sửa được và lưu được |
| GD-10 | `hung`, `admin` | Tạo hồ sơ mới → gửi duyệt → duyệt → khóa | Mã tự sinh đúng dạng (ví dụ `BB-001-002`), đi đủ DRAFT→SUBMITTED→APPROVED→LOCKED; ở LOCKED không còn nút sửa |
| GD-11 | `admin` | Trang Nhân sự: thêm nhân sự chức danh "TVGS trưởng", rồi đổi sang "GS viên" | "TVGS trưởng": danh sách quyền mặc định có APPROVE; "GS viên": không có APPROVE; cả hai đều không có DELETE |
| GD-12 | `thanhb`, `admin` | Xóa một nhật ký (bỏ trống lý do, rồi có lý do) → mở Thùng rác → phục hồi | Lý do rỗng: bị chặn; có lý do: bản ghi rời danh sách, xuất hiện trong Thùng rác, phục hồi thì trở lại; nút xóa vĩnh viễn chỉ `admin` thấy |

## 6. Việc phải làm (thứ tự thực hiện)

1. `npm i -D playwright-core` trong `backend/`, thêm script `test:ui`.
2. Tách `backend/tests/lib/testDb.js`, sửa `regression.test.js` dùng module đó, **chạy lại regression để chứng minh không hỏng**.
3. Viết `backend/tests/ui/helpers.js` + `run-ui-tests.cmd`, cập nhật `.gitignore`.
4. Viết GD-01 → GD-12: viết ca, chạy, sửa selector (hoặc thêm `data-testid`) cho đến khi xanh; nếu một ca phát hiện lỗi thật của app thì báo người dùng trước khi sửa app.
5. Nếu có sửa `index.html`: bump build 3 chỗ (`backend/src/build.js`, `APP_BUILD`, `sw.js`), chạy `node backend\scripts\check-frontend.js`.
6. Cập nhật `docs/CODEMAP.md` (mục Tests), `CAP-NHAT-20260926.md`, `KET-QUA-KIEM-THU-20260926.md`; commit; nhắc người dùng chạy `.\run.bat` + Ctrl+F5 (chỉ khi có bump build).

## 7. Giai đoạn 2 (đã xong 29/09/2026, xem `2026-09-28-tach-index-html-design.md`)

Tách `index.html` thành các file JS theo tính năng. Bộ 12 ca P1 đã dùng làm điều kiện nghiệm thu — xanh trước/sau, không sửa nội dung ca nào.

## 8. Nhóm P2 (12 ca, làm sau khi P1 + tách file đã xong)

Chốt lúc lập kế hoạch P1 (2026-09-28), thứ tự triển khai không quan trọng bằng thứ tự trong bảng — nhóm theo tính năng để gộp lượt chạy.

| Mã | Tài khoản | Các bước | Kỳ vọng |
|---|---|---|---|
| GD-13 | `hung` | Trình một nhật ký/hồ sơ vượt thẩm quyền lên công ty (escalate), ghi chú bắt buộc | Ghi chú rỗng bị chặn; sau khi trình: chỉ `admin`/`duong` còn thấy nút quyết định, `hung` không tự duyệt lại được |
| GD-14 | `thanhb` | Đính kèm 1 ảnh + 1 PDF vào nhật ký | Danh sách tệp đúng; PDF/ảnh mở xem tại chỗ (inline); tệp `.html`/`.svg` (nếu thử) buộc tải về, không mở tại chỗ |
| GD-15 | `admin`, `thanhb` | Sửa thông tin hợp đồng công trình | `admin` lưu → tải lại vẫn còn; `thanhb` không thấy nút sửa |
| GD-16 | `hung` | Kế hoạch tiến độ: thêm hạng mục, lưu, nhập số liệu thực tế | Lưu xong có đường S (SVG); nhập thực tế → % hoàn thành đổi theo |
| GD-17 | `hung` | Lập báo cáo tuần từ dữ liệu nhật ký | Trình soạn có số liệu tổng hợp đúng; sau khi lưu, sửa dữ liệu nguồn không làm đổi số đã lưu (snapshot) |
| GD-18 | `thanhb` | Tạo vấn đề chất lượng → in phiếu → đóng vấn đề | Phiếu in có letterhead; đóng xong đổi trạng thái, không sửa được nữa |
| GD-19 | `thanhb` | Nhập nội dung nhật ký chứa `<img src=x onerror=alert(1)>` | Hiển thị dưới dạng văn bản thô, không có hộp thoại `alert` nào bật lên |
| GD-20 | `thanhb` | Chặn mạng (`page.context().setOffline(true)`) → tạo vấn đề mới → bật mạng lại | Lúc mất mạng: vào hàng đợi đồng bộ cục bộ, không lỗi; sau khi có mạng: tự đồng bộ lên máy chủ, hàng đợi rỗng |
| GD-21 | tài khoản bất kỳ | Token hết hạn/không hợp lệ, gọi một API bất kỳ nhận 401 | Tự đưa về màn hình đăng nhập, không kẹt màn hình trắng hay vòng lặp lỗi |
| GD-22 | `admin` | Đổi tên nhân sự trên hồ sơ khác với tên tài khoản đăng nhập | Hiện chip cảnh báo lệch tên; bấm "Đúng người" đóng băng tên tác giả cũ trên các bản ghi đã có trước đó |
| GD-23 | `thanhb` | Lập nhiều nhật ký cùng lúc qua thao tác hàng loạt (`logBulk`) | Tạo đủ số ngày yêu cầu, không trùng ca, không tạo thiếu/thừa |
| GD-24 | `admin` | Vào Thiết lập, đổi quyền tùy chỉnh của một thành viên tại một công trình | Có hiệu lực ngay: đăng nhập lại bằng tài khoản đó (hoặc tải lại quyền) thấy đúng quyền vừa đổi |

Ghi chú khi triển khai: các nhóm hàm liên quan nay nằm ở `js/04-tien-do.js` (GD-16), `js/06-ho-so.js`+`js/07-bao-cao.js` (GD-14, GD-17), `js/08-chat-luong.js` (GD-18, GD-19), `js/09-nhan-su.js`+`js/10-tai-khoan.js` (GD-22, GD-24), `js/11-duyet.js` (GD-13), `js/05-nhat-ky.js` (GD-20, GD-23), `js/12-dang-nhap.js`/`js/02-quyen.js` (GD-21) — nhờ đợt tách Giai đoạn 2, tra selector rẻ hơn hẳn so với đọc `index.html` 270 KB.
