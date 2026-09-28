# VINA-SUPERVISION — NEXT STEPS

## 1. Chạy MVP cục bộ
- Windows: chạy `run.bat`, mở `http://localhost:8080`.
- macOS/Linux: chạy `./run.sh`, mở `http://localhost:8080`.
- Có thể mở trực tiếp `index.html`, nhưng HTTP local phù hợp hơn để kiểm thử.

## 2. Kiểm thử nghiệp vụ
- Thiết lập → Nạp dữ liệu mẫu.
- Dashboard → bấm công trình → kiểm tra chi tiết.
- Công trình → thêm/sửa thông tin hợp đồng.
- Nhật ký → lập/sửa nhật ký và kiểm tra ảnh.
- Nhân sự → thêm/sửa và phân công công trình.
- Vấn đề → tạo/đóng.
- Hồ sơ → tạo → khóa → tạo version mới.
- Đổi vai trò để kiểm tra quyền.
- Tắt mạng → tạo nhật ký/vấn đề → bật mạng → kiểm tra hàng đợi mô phỏng.

## 3. Chuyển sang production
1. PostgreSQL theo `schema.sql`.
2. Backend API + đăng nhập/MFA.
3. RBAC + phạm vi công trình phía server.
4. Object Storage cho ảnh/PDF/video.
5. Đồng bộ offline thật + xử lý xung đột.
6. Audit bất biến + hash/timestamp/version.
7. Backup/restore, mã hóa, monitoring.
8. Security/load test + UAT.
