# Kết quả kiểm thử — bản 2026-09-26.5

Môi trường thử: khôi phục bản sao lưu thật `vina-supervision-2026-09-25-1053-truoc-20260926.dump` của máy chủ, chạy toàn bộ migration bằng tài khoản `postgres` (đúng như `migrate-db.ps1`), backend chạy bằng tài khoản **không phải superuser** (giống `vina_user` trên máy chủ), trình duyệt Chromium tự động.

## 1. Nguyên nhân "HS-2026-0007 Chưa lên máy chủ" — đã tái hiện

| Tình huống | Kết quả trước khi sửa | Sau khi sửa |
|---|---|---|
| Backend vẫn chạy **mã cũ** (run.bat thấy backend đang chạy nên không khởi động lại) | Hồ sơ kẹt, lý do bị ẩn (`Forbidden: insufficient permissions`) | run.bat tự phát hiện lệch phiên bản và khởi động lại backend; giao diện hiện dải đỏ "Máy chủ đang chạy phiên bản khác"; hồ sơ kẹt hiện rõ lý do + nút Thử lại |
| Mất mạng giữa lúc tải tệp | Lần thử sau tạo **hồ sơ trùng** | Ghi nhớ hồ sơ đã tạo và từng tệp đã tải → thử lại không tạo trùng |
| Tài khoản chưa có quyền "Thêm" / công trình không có trên máy chủ | Kẹt im lặng | Hiện lý do cụ thể |

## 2. Bộ kiểm thử

| Bộ | Nội dung | Kết quả |
|---|---|---|
| `backend/tests/regression.test.js` (14 ca, CSDL thử riêng) | Gộp nhân sự trùng NFD/khoảng trắng; ca nhật ký; phân quyền Thêm/Sửa; tiến độ khớp tính tay; giữ số liệu khi sửa bảng; đọc Excel; hồ sơ + tệp; chặn người ngoài; tệp >15MB; tài khoản/mật khẩu; vai trò Quản lý | **14/14 đạt** |
| Kiểm tra độ nhạy của bộ kiểm thử | Cố ý cài lỗi vào công thức tiến độ | Bộ kiểm thử **bắt được** (1 ca lỗi) |
| `backend/tests/smoke-test.js` trên dữ liệu thật đã migrate | Phiên bản, migration, đăng nhập, nhân sự/hồ sơ/tiến độ/nhật ký từng công trình, GHI THỬ tạo–tải–tải về–xóa hồ sơ | **27/27 đạt** |
| smoke-test với backend **cũ** | Phải báo lỗi | Báo đúng 9 lỗi, chỉ rõ "tắt node và chạy lại run.bat" |
| Kiểm thử giao diện (12 ca) | Nhân sự không trùng; tạo hồ sơ + tệp; hồ sơ cũ + mất mạng giữa chừng → Thử lại không trùng; nhân viên thấy và tải đúng tệp; tiến độ; ô ca; đổi mật khẩu; không lỗi JavaScript | **12/12 đạt** |
| Backend cũ → khởi động lại → hồ sơ kẹt tự lên máy chủ | | **Đạt** (1 hồ sơ, 1 tệp, không trùng) |
| `run.bat` (start-dev.ps1) mô phỏng | Backend bản cũ → dừng tiến trình node cổng 3001 và khởi động bản mới; backend đúng bản → không đụng tới | **Đạt** cả 2 kịch bản |
| `migrate-db.ps1 -AutoBackup` mô phỏng | Có migration mới → sao lưu trước → áp dụng → ghi nhận → cấp quyền | **Đạt** |
| Các tệp .ps1 | Phân tích cú pháp PowerShell; không ký tự ngoài ASCII (tránh lỗi Windows PowerShell 5.1) | **Đạt** (0 byte ngoài ASCII) |

## 3. Anh tự kiểm tra trên máy chủ (sau khi chạy run.bat)

```powershell
cd backend
node tests\smoke-test.js admin            # chỉ đọc
node tests\smoke-test.js admin --write    # thêm bước ghi thử rồi tự xóa
```
Kết quả phải là `KẾT QUẢ: n/n mục đạt`. Mục nào LỖI có ghi cách xử lý.

## 4. Lưu ý dữ liệu thật (Công trình A)

- Hùng và Sơn đã lập nhật ký nhưng **không còn được phân công** vào Công trình A → không xem được công trình. Vào Nhân sự → mục "Đã lập nhật ký… chưa được phân công" → "Phân công vào công trình".
- Nguyễn Thành B chưa có tài khoản → bấm vào tên → Loại tài khoản → Tạo tài khoản mới.

## Đợt 5 — bản 2026-09-27.1

| Bộ | Kết quả |
|---|---|
| Kiểm thử máy chủ (19 ca, thêm: quy trình nhật ký đúng người đúng quyền, gửi/duyệt hàng loạt, tài liệu nhật ký, nhân viên chỉ thấy quyền của mình, báo cáo 4 loại + chốt số liệu + duyệt) | **19/19 đạt** |
| Cố ý gỡ kiểm tra quyền duyệt và che quyền nhân viên | Bộ kiểm thử **bắt được** cả 2 lỗi |
| Giao diện đợt 5 (17 ca: ẩn Thiết lập, quyền của tôi, tiêu đề/ô nhật ký, Lưu và gửi duyệt, gửi/duyệt hàng loạt, lập–lưu–in–duyệt báo cáo tuần) | **17/17 đạt** |
| Giao diện nhật ký kèm tệp (tài liệu + ảnh lên máy chủ, ảnh thêm khi sửa, xóa base64 khỏi trình duyệt) | **5/5 đạt** |
| Hồi quy các đợt trước (giao diện 12 ca, smoke-test 27 mục) | **Đạt** |
| Sao lưu kèm thư mục ảnh (mô phỏng PowerShell) | **Đạt** |

## Đợt 6 — bản 2026-09-28.1 (vá bảo mật, xem `BAO-CAO-RA-SOAT-20260928.md`)

| Bộ | Kết quả |
|---|---|
| Kiểm thử máy chủ (26 ca = 19 cũ + 7 mới: tệp HTML/SVG không chạy được & PDF vẫn xem được; khóa đăng nhập sai; bom nén Excel; sửa một phần công trình; khóa sửa hồ sơ sau gửi duyệt; giao việc vấn đề; số tồn cuối kỳ) | **26/26 đạt** |
| Cú pháp JavaScript `index.html` (6 khối) + `api.js` + toàn bộ `backend/src` | **0 lỗi** |
| Giao diện (backend riêng cổng 3102, CSDL thử): Kỹ sư không thấy nút Sửa công trình; tệp khai báo `text/html` bị ép tải về; PDF mở trực tiếp; nút Sửa hồ sơ ẩn khi đã gửi duyệt | **Đạt** |

## Đợt 14 — bản 2026-10-07.1 (khôi phục tự làm mới danh sách, thông báo đăng nhập tiếng Việt, chặn xóa nhầm CSDL)

| Bộ | Kết quả |
|---|---|
| Kiểm thử máy chủ (40 ca = 39 cũ + 1 mới: đăng nhập sai trả thông báo tiếng Việt, và sai mật khẩu / không có tài khoản cùng một thông báo để không lộ tài khoản) | **40/40 đạt** |
| Kiểm thử giao diện (15 ca) sau khi sửa | **15/15 đạt** |
| Độ nhạy: sửa trước ca kiểm thử rồi mới sửa ứng dụng | Đúng quy trình — GD-12 **đỏ** khi còn đòi Ctrl+F5 và ca regression mới **đỏ** khi thông báo còn tiếng Anh; sau khi sửa ứng dụng thì cả hai xanh |
| Cú pháp `index.html` (7 khối) + `api.js` + `sw.js` + khớp build 3 chỗ | **0 lỗi**, build 2026-10-07.1 |
| Chốt an toàn hai script kiểm thử | Gọi `run-ui-tests.cmd zz_guard_test` (CSDL thật có bảng dấu) **trước khi sửa: CSDL bị xóa hẳn**; sau khi thêm chốt: script từ chối (exit 2), CSDL và bảng dấu còn nguyên. `run-regression.cmd zz_khong_hop_le` cũng bị từ chối, không tạo/không xóa gì |

## Đợt 13 — 28/09/2026 (bộ kiểm thử giao diện tự động; KHÔNG đổi mã ứng dụng, không đổi build)

Môi trường: CSDL thử `vina_ui_claude` dựng từ `schema-VINA-PROD-01.sql` + toàn bộ migration + dữ liệu lỗi giống thực tế; backend cổng 3103; Chrome cài trên máy điều khiển bằng `playwright-core` (headless), service worker bị chặn, mỗi ca một browser context riêng. Không đụng CSDL thật.

| Bộ | Kết quả |
|---|---|
| Kiểm thử giao diện `backend/tests/ui/` — 14 ca (GD-01…GD-12b + HZ-01, HZ-02) | **15/15 đạt** (15 ca kể cả GD-12b), ~47 giây |
| Chạy lại lần thứ hai liên tiếp để lọc ca chập chờn | **15/15 đạt**, ~46 giây — không có ca lúc xanh lúc đỏ |
| Kiểm thử máy chủ `backend/tests/regression.test.js` sau khi tách module dựng CSDL dùng chung (`backend/tests/lib/testDb.js`) | **39/39 đạt** — bằng đúng số đo trước khi tách |
| Độ nhạy của bộ kiểm thử (cố ý cài lỗi rồi hoàn nguyên) | Bắt được cả 3 lần: đổi mật khẩu sai thành đúng ở ca đăng nhập → GD-01 đỏ; đảo kỳ vọng "người không có quyền Xóa không thấy Thùng rác" → GD-03 đỏ; bỏ `APPROVE` khỏi `LEAD_DEFAULT_PERMS` trong `index.html` → GD-11 đỏ |

Ba hành vi thật của ứng dụng được ca kiểm thử ghi lại (không phải lỗi, nhưng khác với giả định ban đầu): bấm "Duyệt"/"Trả lại" mở cửa sổ "Xem xét và phê duyệt" chứ không hỏi xác nhận nhanh; khung "Quyền truy cập tại công trình" chỉ hiện với nhân sự đã liên kết tài khoản; sau khi khôi phục từ Thùng rác phải tải lại trang mới thấy bản ghi (ứng dụng tự nhắc).

## Đợt 12 — bản 2026-10-06.1 (quyền Xóa, Thùng rác)

| Bộ | Kết quả |
|---|---|
| Kiểm thử máy chủ (39 ca = 37 cũ + 2 mới: người lập / Trưởng TVGS không xóa được; xóa phải có lý do; nhật ký kèm tệp vào Thùng rác và khôi phục nguyên nội dung tệp; không khôi phục 2 lần; trùng ngày/ca khi khôi phục → báo rõ; cấp quyền Xóa theo công trình; nhân viên chỉ thấy thùng rác công trình mình; chỉ Admin xóa vĩnh viễn, vẫn giữ dòng vết; bảng tiến độ khôi phục đủ số liệu thực tế và là bảng hiện hành; văn bản chất lượng khôi phục) | **39/39 đạt** (1 lỗi đếm mục con phát hiện và sửa trong lúc thử) |
| Giao diện: nhân viên — 0 nút Xóa, không có Thùng rác; Admin — nút Xóa trên từng dòng, bắt buộc lý do, xóa → danh sách giảm, Thùng rác hiện đủ người xóa/lúc/lý do, Khôi phục → trở lại | **Đạt** |

## Đợt 10 — bản 2026-10-04.1 (tổng quan tiến độ, cảnh báo, báo cáo so với bảng tiến độ)

| Bộ | Kết quả |
|---|---|
| Kiểm thử máy chủ (36 ca = 33 cũ + 3 mới: Admin thấy mọi công trình / thành viên chỉ công trình được giao / không xem được công trình khác; hạng mục quá hạn + chậm + chưa cập nhật → Đỏ, cập nhật đúng kế hoạch → hết cảnh báo; báo cáo tuần có bảng hạng mục trong kỳ, id để nhập thực tế, cảnh báo, không so với kế hoạch tương lai, nhập thấp hơn KH → có cảnh báo chậm). Ngày thử tính tương đối theo hôm nay. | **36/36 đạt** |
| Giao diện: Admin — 3 công trình, thẻ Đỏ/Vàng/Xanh, bảng KH/TT, SPI, dự báo xong, nhật ký, chờ duyệt, danh sách cảnh báo; thành viên — chỉ 2 công trình được giao, tiêu đề "Tiến độ công trình được phân công"; báo cáo tuần — chuyển "Nhập / điều chỉnh", nhập 40% → lệch tính lại, lưu → ghi vào bảng tiến độ và báo cáo chốt 40%; không lỗi JavaScript | **Đạt** |
| Sửa trong lúc thử | Công trình chưa có ngày khởi công, bảng tiến độ và nhật ký bị báo "thiếu nhật ký" đỏ → nay chưa đánh giá nhật ký cho tới khi khởi công | — |

## Đợt 8 — bản 2026-10-02.1 (quyền duyệt theo công trình, trình công ty, tên đăng nhập tự đặt)

| Bộ | Kết quả |
|---|---|
| Kiểm thử máy chủ (32 ca = 29 cũ + 3 mới: cùng một người TVGS trưởng ở công trình B / GS viên ở A → chỉ duyệt được ở B, tùy chỉnh bỏ quyền Duyệt; trình công ty bắt buộc nội dung, Trưởng TVGS không tự duyệt bản đã trình, Admin nhận kèm nội dung; tên đăng nhập kiểm tra trùng không phân biệt hoa/thường, số điện thoại/email, đổi tên, đăng nhập bằng tên mới) | **32/32 đạt** |
| Giao diện: Kỹ sư không có quyền duyệt → không có mục Việc cần duyệt; TVGS trưởng ở B → có mục, chỉ thấy việc của B, có 3 nút (Phê duyệt / Yêu cầu chỉnh sửa / Trình công ty), ở A không có nút Duyệt; Admin chỉ thấy việc được trình + mục Theo dõi; đổi chức danh → quyền mặc định đổi ngay (có Duyệt khi là TVGS trưởng); gợi ý tên đăng nhập + báo trùng; nhãn cảnh báo tài khoản gắn nhầm | **Đạt** |

## Đợt 7 — bản 2026-10-01.1 (tài khoản nhân sự, duyệt có ý kiến, Việc cần duyệt)

| Bộ | Kết quả |
|---|---|
| Kiểm thử máy chủ (29 ca = 26 cũ + 3 mới: tạo tài khoản từ Nhân sự → bị chặn tới khi đổi mật khẩu, đặt lại mật khẩu → lại phải đổi; báo cáo gửi → Trưởng TVGS nhận → trả lại bắt buộc có nội dung → người lập thấy lý do → gửi lại → phê duyệt, lịch sử 4 bước, người ngoài không xem được; nhật ký trả lại bắt buộc có nội dung kể cả hàng loạt) | **29/29 đạt** |
| Cú pháp JavaScript `index.html` (7 khối) + `api.js` + `backend/src` | **0 lỗi** |
| Giao diện: người chưa có tài khoản mặc định "Tạo mới" (không còn chọn sẵn tài khoản người khác); lưu → phiếu tài khoản; Trưởng TVGS thấy số đỏ + dải thông báo → Xem xét → trả lại khi trống bị chặn → trả lại có nội dung; người lập thấy số đỏ, nội dung yêu cầu, nhãn "Bị trả lại", lý do ở đầu cửa sổ sửa; tài khoản mật khẩu tạm bị khóa trong cửa sổ đổi mật khẩu (không đóng được) | **Đạt** |
