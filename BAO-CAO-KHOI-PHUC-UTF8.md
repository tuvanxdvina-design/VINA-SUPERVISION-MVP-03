# Báo cáo khôi phục mã hóa `index.html`

Ngày kiểm tra: 22/09/2026.

File đã sửa: `D:\Setup\QLGS-HeThong\ChatGPT\VINA-SUPERVISION-MVP-02\index.html`.

## Kết quả

- Khôi phục 764 token mojibake theo byte UTF-8 bị giải mã sai và dựng lại 10 chuỗi đã mất dấu thành `?` theo ngữ cảnh. Danh sách đầy đủ gồm vị trí dòng, chuỗi trước và sau nằm trong `encoding-report.json`.
- File cuối hợp lệ UTF-8, không BOM. SHA-256: `3F342C215B36C765F71CFDF66FFF2617A16D54F1D5BD738BDC730B017CB1BE69`.
- Đã lưu file gốc tại `index.html.bak-before-full-utf8-repair` trong cùng thư mục dự án.
- Không sửa cấu trúc HTML hoặc toán tử JavaScript. Các thay đổi tập trung vào văn bản tĩnh, nội dung chuỗi, comment và ký hiệu hiển thị.

## Ví dụ chuỗi đã sửa

| Dòng | Trước | Sau |
| --- | --- | --- |
| 111 | `Äá»“ng bá»™ Offline` | `Đồng bộ Offline` |
| 114 | `Nháº¥n vÃ o cÃ´ng trÃ¬nh...` | `Nhấn vào công trình...` |
| 214 | `Äang chá»` | `Đang chờ` |
| 483 | `Nh?p ??y ?? t?n ??ng nh?p v? m?t kh?u.` | `Nhập đầy đủ tên đăng nhập và mật khẩu.` |
| 659 | `Kh?ng ??ng b? nh?t k? c?ng tr?nh` | `Không đồng bộ nhật ký công trình` |
| 670 | `Äá»“ng bá»™ nháº­t kÃ½ PostgreSQL` | `Đồng bộ nhật ký PostgreSQL` |

## Kiểm tra cú pháp

Trích cả 5 khối `<script>` nội tuyến thành các file JavaScript riêng và chạy `node --check` trên từng file: **5/5 đạt, không có lỗi cú pháp**. Hai file kiểm tra JavaScript đã có sẵn trong dự án (`index-inline-check.js`, `index-check.js`) cũng đạt `node --check`.

## Cần xác minh thủ công

- Mười chuỗi từng chứa dấu `?` không thể khôi phục chính xác bằng giải mã byte; các câu đã được dựng lại theo ngữ cảnh. Xem các mục `method: contextual reconstruction` trong `encoding-report.json`.
- Dữ liệu cũ trong `localStorage` có thể vẫn chứa chữ hoặc trạng thái mojibake. Việc sửa file nguồn không tự chuyển đổi dữ liệu đã lưu trong trình duyệt. Nên mở giao diện và kiểm tra đăng nhập, danh sách công trình, nhật ký, trạng thái hồ sơ và đồng bộ với dữ liệu thật.
- Kiểm tra cú pháp không xác nhận hành vi chạy cùng backend hay dữ liệu người dùng. Chưa thực hiện kiểm thử tương tác trên trình duyệt.
