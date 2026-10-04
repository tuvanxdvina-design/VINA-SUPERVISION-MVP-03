---
name: vicoad-debug
description: "Điều tra và sửa lỗi có log, exception, API 500, đăng nhập, đồng bộ, Docker hoặc PostgreSQL trong VINA Supervision."
---

# Chẩn đoán lỗi

Đọc [bối cảnh repo](../../references/project-context.md) khi cần thao tác trong dự án; chỉ đọc phần liên quan. Trả lời tiếng Việt, ngắn và đi thẳng vào việc.

Xác định triệu chứng, thao tác tái hiện, môi trường và thời điểm. Đọc log có giới hạn, che thông tin xác thực; không mở .env để in ra.
Theo luồng lỗi từ frontend/api.js tới backend/src/routes, services và utils/db.js. Kiểm tra quyền theo công trình, trạng thái duyệt, hàng đợi offline và tính idempotent khi liên quan.
Lỗi role PostgreSQL: xác minh database/user/container đang được cấu hình qua thông tin không nhạy cảm; không tạo role, reset volume hoặc nạp lại schema thật để thử.
Chứng minh nguyên nhân bằng kiểm tra hẹp rồi sửa tối thiểu nếu được giao sửa; chạy kiểm thử phù hợp ở môi trường thử đã xác minh. Báo nguyên nhân, thay đổi và kiểm tra còn chưa thực hiện.
