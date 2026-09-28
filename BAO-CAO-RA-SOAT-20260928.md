# Rà soát & vá lỗi VINA-SUPERVISION — bản 2026-09-28.1

Phạm vi: toàn bộ backend (`backend/src`), giao diện (`index.html`, `api.js`, `sw.js`), bộ kiểm thử.
Cách làm: đọc mã từng route/service, tái hiện lỗi bằng kiểm thử tự động trên CSDL thử riêng (không đụng dữ liệu thật), vá, chạy lại toàn bộ kiểm thử cũ + mới.

## 1. Lỗi đã vá

| # | Mức | Lỗi (đã kiểm chứng) | Hệ quả | Đã sửa |
|---|---|---|---|---|
| B1 | 🔴 | **Tệp tải lên chạy được mã độc (stored XSS).** Máy chủ lưu và phát lại nguyên kiểu tệp do người tải khai báo. Tải lên tệp tên `hop-dong.pdf` nhưng khai báo `text/html` → người khác bấm "Xem" → giao diện mở tệp dạng `blob:` cùng nguồn với ứng dụng → mã trong tệp đọc được token đăng nhập (kể cả của Admin/Giám đốc). Áp dụng cho tệp hồ sơ, tài liệu nhật ký, tệp gốc bảng tiến độ. | Một tài khoản kỹ sư bất kỳ có thể chiếm quyền Admin. | Máy chủ chỉ trả trực tiếp PDF/PNG/JPEG/WebP/GIF; kiểu khác trả `application/octet-stream` + `attachment` + `nosniff` (`utils/fileSafety.js`). Giao diện cũng tự kiểm lại kiểu trước khi mở (`safeFileBlob`). |
| B2 | 🔴 | **Không giới hạn đăng nhập sai.** | Dò mật khẩu không giới hạn. | Sai 8 lần/tài khoản (hoặc 30 lần/IP) trong 15 phút → tạm khóa (HTTP 429). Thời gian phản hồi không lộ tên đăng nhập có tồn tại hay không. |
| B3 | 🔴 | **"Bom nén" Excel:** tệp .xlsx 10 MB có thể giải nén ra hàng GB khi "Đọc từ Excel". | Máy chủ treo/hết RAM, mọi người mất kết nối. | Giới hạn 60 MB sau giải nén mỗi phần, báo lỗi rõ ràng. |
| B4 | 🟠 | **Sửa công trình xóa trường không gửi lên:** thiếu trường nào là ghi rỗng; tiến độ về 0%, trạng thái về ACTIVE. | Mất thông tin hợp đồng/chủ đầu tư khi sửa từ màn hình hoặc thiết bị cũ. | Trường không gửi thì giữ giá trị cũ. |
| B5 | 🟠 | **Hồ sơ đã gửi duyệt/đã duyệt vẫn bị người lập sửa** (chỉ chặn khi đã khóa). | Nội dung đã được Trưởng TVGS duyệt có thể bị đổi ngầm → mất giá trị pháp lý của việc duyệt. | Chỉ sửa/thêm tệp khi còn **Nháp**; muốn sửa phải "Trả lại". Admin/Giám đốc giữ nguyên quyền (như quyết định 26/09). Giao diện ẩn nút Sửa tương ứng. |
| B6 | 🟠 | **Giao việc vấn đề:** Admin bị chặn; có thể giao cho tài khoản không thuộc công trình. | Việc giao cho người không nhìn thấy công trình. | Thêm Admin; kiểm tra người được giao thuộc công trình. |
| B7 | 🟠 | **Báo cáo: "Còn tồn đến cuối kỳ"** đếm theo trạng thái *hiện tại*, không theo ngày cuối kỳ. | Báo cáo tuần/tháng cũ lập lại cho số khác; số liệu sai khi vấn đề đóng sau kỳ. | Đếm theo ngày cuối kỳ. "Hôm nay" tính theo giờ Việt Nam (trước 7h sáng từng bị lệch sang hôm trước). |
| B8 | 🟡 | Nút "Sửa công trình" hiện cho Kỹ sư (một dòng mã sau ghi đè kiểm tra quyền đúng). | Bấm được nhưng lưu báo lỗi. | Bỏ dòng ghi đè. |
| B9 | 🟡 | Thiếu header bảo mật cơ bản. | Có thể bị nhúng khung (clickjacking). | `X-Frame-Options`, `nosniff`, `Referrer-Policy`, ẩn `X-Powered-By`. |
| B10 | 🔴 | `JWT_SECRET` trong `backend/.env` vẫn là **chuỗi mẫu** (đã nêu ở A2 ngày 26/09, chưa đổi). | Ai biết chuỗi mẫu (có trong tài liệu/mẫu công khai) đều giả mạo được token Admin. | **Chưa tự đổi** (đổi sẽ đăng xuất mọi người). Máy chủ ghi cảnh báo khi khởi động; Admin/Giám đốc thấy dải cảnh báo đỏ trên giao diện. **Anh cần tự đổi — xem mục 3.** |

Mã phiên bản tăng lên `2026-09-28.1` → `run.bat` tự khởi động lại backend. Không có migration CSDL mới.

## 2. Kiểm thử

`backend/tests/regression.test.js`: thêm 7 ca cho các lỗi trên (tệp HTML/SVG không chạy được, PDF vẫn xem được; khóa đăng nhập; bom nén; sửa một phần công trình; khóa sửa hồ sơ sau gửi duyệt; giao việc; số tồn cuối kỳ). Kết quả: xem `KET-QUA-KIEM-THU-20260926.md` mục Đợt 6.

## 3. Việc anh cần làm (≈5 phút)

1. **Đổi khóa ký token**: mở `backend\.env`, thay dòng `JWT_SECRET=...` bằng chuỗi ngẫu nhiên. Tạo chuỗi bằng PowerShell:
   `-join ((48..57)+(65..90)+(97..122) | Get-Random -Count 48 | % {[char]$_})`
2. **Xóa khỏi thư mục dự án** `Token eyJ….txt` (token còn hạn) và `Pas user.xlsx` (danh sách mật khẩu) — cất nơi an toàn ngoài thư mục chia sẻ.
3. Chạy `.\run.bat`, trên trình duyệt nhấn Ctrl+F5.
4. Kiểm tra: `cd backend; node tests\smoke-test.js admin`.

## 4. So với các phần mềm quản lý TVGS/QLCL đang dùng trên thị trường — thiếu gì

Hệ thống hiện có: công trình, nhân sự & phân quyền theo công trình, nhật ký (nhiều ca, duyệt/khóa), văn bản chất lượng, hồ sơ pháp lý, tiến độ (Excel, KH/TT, SPI), báo cáo ngày/tuần/tháng/hoàn thành. Nền tảng tốt. Các chức năng mà phần mềm cùng loại thường có và ở đây chưa có:

| Ưu tiên | Phân hệ | Nội dung | Lý do |
|---|---|---|---|
| 1 | **Nghiệm thu** | Nhà thầu gửi *Phiếu yêu cầu nghiệm thu* → TVGS kiểm tra theo **checklist** hạng mục → *Biên bản nghiệm thu* (công việc / vật liệu đầu vào / giai đoạn / hoàn thành) theo **Nghị định 207/2026/NĐ-CP** (hiệu lực 01/7/2026, thay thế Nghị định 06/2021/NĐ-CP) và văn bản hướng dẫn; gắn hạng mục tiến độ, ảnh, kết quả; đạt → cập nhật % thực tế. | Là công việc chính hằng ngày của TVGS; hiện phải làm ngoài hệ thống, "Hồ sơ" chỉ lưu tệp. |
| 2 | **Vật liệu & thí nghiệm** | Lô vật liệu vào công trường, lấy mẫu, phiếu kết quả thí nghiệm, đạt/không đạt, cảnh báo mẫu chưa có kết quả. | Căn cứ bắt buộc cho nghiệm thu. |
| 3 | **NCR / Yêu cầu khắc phục** | Nâng "Vấn đề" thành phiếu có hạn xử lý, người chịu trách nhiệm phía nhà thầu, ảnh trước/sau, trạng thái quá hạn, nhắc việc. | Đã có sẵn khung (hạn, giao việc) — chi phí thấp. |
| 4 | **Tài khoản bên ngoài** | Nhà thầu (gửi yêu cầu nghiệm thu, trả lời NCR), Chủ đầu tư (chỉ xem, tải báo cáo). | Giảm gửi giấy/Zalo qua lại. |
| 5 | **Thông báo** | Email/Zalo OA/đẩy trên điện thoại khi có việc chờ duyệt, NCR quá hạn, thiếu nhật ký. | Quy trình duyệt hiện chỉ chạy khi người duyệt tự mở trang. |
| 6 | **Ảnh hiện trường có dấu thời gian/vị trí** | Ghi thời gian chụp, GPS, đóng dấu lên ảnh, cảnh báo ảnh cũ. | Chứng cứ hiện trường. |
| 7 | **Ký số** | Ký biên bản/báo cáo bằng chữ ký số (USB token / ký từ xa). | Dài hạn; cần nhà cung cấp CA. |

**Căn cứ pháp lý (cập nhật):** Nghị định 207/2026/NĐ-CP ngày 15/6/2026 quy định chi tiết Luật Xây dựng về quản lý chất lượng, thi công xây dựng và bảo trì công trình — hiệu lực từ 01/7/2026, thay thế Nghị định 06/2021/NĐ-CP. Nghị định mới bổ sung quy định về ứng dụng công nghệ thông tin/BIM trong quản lý thi công, quản lý chất lượng và nghiệm thu — thuận lợi cho việc số hóa nhật ký, biên bản nghiệm thu trên hệ thống. Trước khi làm phân hệ Nghiệm thu cần đối chiếu **toàn văn** Nghị định 207/2026 (và thông tư hướng dẫn nếu có) để lấy đúng: thành phần nghiệm thu, nội dung biên bản, điều kiện nghiệm thu, danh mục hồ sơ hoàn thành, yêu cầu nhật ký thi công. Nguồn: [vanban.chinhphu.vn](https://vanban.chinhphu.vn/?pageid=27160&docid=218450), [moc.gov.vn](https://moc.gov.vn/pl/pages/ChiTietVanBan.aspx?vID=714&TypeVB=1).

Hạ tầng nên xử lý song song: tệp đang lưu trong PostgreSQL (CSDL và bản sao lưu phình nhanh khi nhiều ảnh/PDF — nên chuyển sang thư mục/Object Storage khi > ~20 GB); dùng Git thay cho ~60 tệp `.bak`; từ vựng trạng thái thống nhất (A8), xử lý xung đột khi 2 người sửa cùng lúc (A12).

**Đề xuất bước tiếp theo:** làm phân hệ **Nghiệm thu** (ưu tiên 1) kèm **NCR** (ưu tiên 3) trong cùng một đợt, vì dùng chung checklist, ảnh và luồng duyệt đã có.
