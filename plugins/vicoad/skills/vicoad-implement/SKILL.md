---
name: vicoad-implement
description: "Triển khai hoặc chỉnh sửa code, migration và kiểm thử trong repository VINA Supervision theo yêu cầu đã rõ."
---

# Triển khai thay đổi

Đọc [bối cảnh repo](../../references/project-context.md) khi cần thao tác trong dự án; chỉ đọc phần liên quan. Trả lời tiếng Việt, ngắn và đi thẳng vào việc.

Kiểm tra diff trước khi sửa, giữ nguyên thay đổi của người dùng. Đọc docs/CODEMAP.md và đoạn mã mục tiêu; hoàn thành phần đã được giao mà không hỏi lại quyền sửa thường lệ.
Frontend sửa index.html, api.js, js/ và sw.js gốc; không sửa bản sinh web-public/. Thêm file js cần cập nhật thứ tự script và SHELL_FILES; giữ các file glue đúng vị trí. Backend theo route → service → raw SQL.
Thay đổi runtime theo quy ước build tại backend/src/build.js, index.html và sw.js; cập nhật nhật ký thay đổi/kiểm thử nếu áp dụng. Plugin/tài liệu thuần không cần tăng build ứng dụng hoặc khởi động lại.
Thêm migration mới thay vì sửa migration đã áp dụng. Không chạy run.bat/start-dev.ps1/migrate-db.ps1 chỉ để kiểm tra vì có thể tác động dữ liệu thật.
Kiểm tra cú pháp bằng node backend/scripts/check-frontend.js hoặc node --check file khi phù hợp. Đọc script test và xác minh DB thử có tên riêng trước khi chạy regression/UI: helper test có DROP DATABASE. Không chạy mặc định nếu chưa biết đích. Giữ backend 3001 của người dùng đang chạy.
Chạy kiểm thử liên quan, báo kết quả thật và hạn chế. Không stage tệp ngoài phạm vi; không tự commit nếu người dùng chưa yêu cầu trong phiên hiện tại.
