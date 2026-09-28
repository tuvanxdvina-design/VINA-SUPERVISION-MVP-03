# Triển khai chạy thử tại nhiều công trình

## Phương án đề xuất

Dùng một máy Windows tại văn phòng làm máy chủ trung tâm và Tailscale Serve làm đường truy cập riêng. Điện thoại và máy tính công trình cài Tailscale, đăng nhập đúng nhóm, rồi mở cùng một địa chỉ HTTPS. Cách này giữ PostgreSQL và ứng dụng trên một máy, không cần VPS, tên miền công cộng hoặc mở cổng modem.

Ứng dụng hiện phục vụ giao diện và API chung trên cổng 3001. Tailscale Serve chuyển địa chỉ HTTPS riêng tới `http://127.0.0.1:3001`. Theo tài liệu Tailscale, Serve áp dụng chính sách truy cập của tailnet, cấp HTTPS và có thể chạy nền bằng `--bg`.

## Chuẩn bị trước khi mở truy cập

1. Chạy `run.bat`, kiểm tra `http://localhost:3001/health` trả `OK/connected`.
2. Đặt mật khẩu riêng tối thiểu 8 ký tự cho từng tài khoản, tại thư mục `backend`:

   `node scripts/set-user-password.js <username>`

3. Đổi `NODE_ENV=production` trong `backend/.env`, khởi động lại ứng dụng. Chế độ production không chấp nhận mật khẩu demo.
4. Đăng nhập bằng tài khoản Giám đốc hoặc Admin, vào **Nhân sự → Phân công quyền truy cập công trình**. Chỉ phân công đúng công trình người đó tham gia.
5. Cài Tailscale chính thức trên máy chủ và các thiết bị, cấu hình nhóm người dùng/quyền truy cập trong tailnet. Không dùng Funnel vì Funnel mở dịch vụ ra Internet công cộng.
6. Trên máy chủ, chạy PowerShell `enable-tailnet.ps1`. Tập lệnh sẽ từ chối mở nếu còn tài khoản demo hoặc chưa ở production. Ghi lại địa chỉ `https://...ts.net` được trả về.
7. Trên từng điện thoại/máy tính: kết nối Tailscale, mở địa chỉ HTTPS, đăng nhập tài khoản riêng và thêm trang vào màn hình chính nếu cần.

## Kiểm tra nghiệm thu tối thiểu

- Tài khoản chỉ thấy công trình được phân công; kết thúc phân công thì công trình biến mất sau tải lại.
- Tạo nhật ký, vấn đề và ảnh trên điện thoại; kiểm tra chúng xuất hiện trên máy tính khác.
- Tắt mạng, lập nhật ký/vấn đề; bật mạng và kiểm tra **Đang chờ: 0**.
- Ảnh tối đa 5 MB, định dạng JPEG, PNG hoặc WebP. Gửi lại cùng ảnh không tạo bản trùng.
- Sao lưu gồm cả PostgreSQL và thư mục `backend/uploads`.

## Tiết kiệm tài nguyên

- Giữ một tiến trình Node.js, một PostgreSQL và máy chủ tệp nhẹ hiện có.
- Không cài object storage, Redis, hàng đợi hoặc hệ thống giám sát riêng ở giai đoạn chạy thử.
- Ảnh lưu theo mã băm và chống trùng; giới hạn 5 MB để giảm dung lượng.
- Service worker chỉ lưu ba tệp giao diện nhỏ, không lưu API hay dữ liệu nhạy cảm.
