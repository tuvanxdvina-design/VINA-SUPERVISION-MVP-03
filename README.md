# VINA-SUPERVISION MVP-02 — chạy thử nội bộ

Ứng dụng chạy trên máy này: giao diện `http://localhost:8080/`, API `http://localhost:3001/`, PostgreSQL trong Docker. Các cổng chỉ lắng nghe trên `127.0.0.1`.

## Khởi động

Yêu cầu Docker Desktop, Node.js, Python và thư mục `backend/node_modules` đã được cài. Chạy `run.bat` trong thư mục dự án. Tập lệnh khởi động cơ sở dữ liệu, API và giao diện, sau đó kiểm tra kết nối. Có thể chạy lại mà không tạo thêm máy chủ.

Kiểm tra `http://localhost:3001/health`: kết quả cần có `status: OK` và `database: connected`. Nếu khởi động lỗi, xem `runtime-logs/backend.err.log` và `runtime-logs/frontend.err.log`.

## Phạm vi bản chạy thử

- Đăng nhập bằng tài khoản demo có sẵn và mật khẩu `demo`. API từ chối mật khẩu khác, tài khoản không có sẵn và tài khoản bị vô hiệu hóa. Chế độ demo không được dùng khi `NODE_ENV=production`.
- Công trình và nhật ký được đọc từ PostgreSQL. Tạo/cập nhật công trình và tạo/cập nhật nhật ký sẽ đồng bộ từ hàng đợi trình duyệt khi có kết nối và đã đăng nhập. Gửi lại yêu cầu tạo cùng ID không sinh bản ghi trùng.
- Nhật ký mới bắt đầu ở trạng thái `DRAFT`. Các thao tác duyệt/khóa phụ thuộc vai trò trong API.
- Vấn đề, hồ sơ và nhân sự trong giao diện vẫn lưu cục bộ ở trình duyệt; chưa có đồng bộ PostgreSQL cho các phần này. Hãy dùng **Xuất JSON** để giữ bản sao trước khi xóa dữ liệu trình duyệt hoặc đổi máy.

## Giới hạn

Đây là bản chạy thử nội bộ với mật khẩu demo và dữ liệu minh họa. Chưa dùng dữ liệu thật hoặc mở dịch vụ ra mạng công cộng. Quyền truy cập theo từng công trình, xử lý xung đột khi nhiều người sửa cùng lúc, lưu tệp lên máy chủ và quy trình khôi phục sau sự cố cần được hoàn thiện trước khi triển khai thực tế.

Các chuỗi cũ đã mất dấu thành dấu `?` trong nội dung nhật ký PostgreSQL cần đối chiếu bản gốc trước khi sửa; việc đổi mã hóa tệp không thể khôi phục những ký tự đã mất trong dữ liệu.

## Chạy trên nhiều thiết bị

Xem `DEPLOY-MULTISITE.md`. Phương án chạy thử là một máy chủ trung tâm và truy cập riêng qua Tailscale Serve. Trước khi bật truy cập từ xa, bắt buộc đặt mật khẩu riêng, chuyển sang production và phân công từng tài khoản vào đúng công trình.
