# Bối cảnh VINA Supervision

Khảo sát 2026-09-29; xác minh lại mã hiện hành khi sử dụng. Tìm repo qua backend/package.json, backend/server.js, docs/CODEMAP.md; không cố định đường dẫn máy. Nếu plugin được cài ở cache, repo là thư mục làm việc, không phải thư mục plugin.

- Node/Express 5, CommonJS, pg/raw SQL. backend/server.js → backend/src/app.js → routes → services. PostgreSQL trong Docker; tài liệu dự án ghi phiên bản 14, kiểm tra cấu hình khi cần.
- Giao diện JavaScript thuần, index.html + api.js + js/01-core.js…14-dang-nhap.js và các file glue; sw.js quản lý cache. web-public/ là bản sinh.
- Schema gốc đã cũ; xem migrations/ và docs/CODEMAP.md. Đọc CLAUDE.md để lấy quy ước kỹ thuật, nhưng chỉ dẫn hiện tại của người dùng có ưu tiên; không áp dụng hạn chế công cụ cũ trái với yêu cầu hiện tại.
- Quyền theo công trình nằm ở permissionService.js, giao diện ở js/02-quyen.js. Xác minh mã khi đổi quy tắc. Luồng duyệt, snapshot báo cáo và thùng rác cần giữ dấu vết audit.
- run.bat/start-dev.ps1 có thể chạy migration/khởi động dịch vụ: không dùng để kiểm tra plugin. Không sửa production, DB thật, restart backend 3001 hoặc reset Docker volume trong công việc plugin.
- backend/tests/lib/testDb.js có DROP DATABASE: trước test cần xác minh tên DB thử riêng và script đầu vào. Test scripts nằm ở backend/scripts/; kiểm tra cú pháp frontend không cần DB.
- Không đọc/in .env, token, mật khẩu hoặc đưa backups/uploads vào commit. Không tự sửa file lạ hoặc thay đổi đã có của người dùng.

## Chọn workflow và mức công sức

Chọn một skill chính theo mục đích, chỉ kết hợp tvgs khi cần nghiệp vụ. Câu hỏi ngắn → quick; phân tích/so sánh → analyze; lỗi cụ thể → debug; thiết kế → design; yêu cầu sửa/làm → implement; đánh giá diff → review; hồ sơ/nghiệp vụ → tvgs. Yêu cầu sửa lỗi: debug rồi implement, không dừng sau chẩn đoán.

Chỉ nạp file liên quan, dùng diff và tìm kiếm có mục tiêu. Bắt đầu với mức xử lý thấp nhất đủ hoàn thành; tăng độ sâu khi lỗi liên thành phần, quyền/trạng thái hoặc migration phức tạp. Đây là điều chỉnh workflow, không tự chuyển model, không bảo đảm tỷ lệ tiết kiệm tài nguyên. Không tạo lịch chạy, subagent hoặc dịch vụ nền từ việc chọn workflow.
