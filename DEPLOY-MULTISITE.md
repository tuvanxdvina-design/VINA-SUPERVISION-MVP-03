# Triển khai chạy thử tại nhiều công trình

## Phương án đề xuất

Dùng một máy Windows tại văn phòng làm máy chủ trung tâm và Tailscale Serve làm đường truy cập riêng. Điện thoại và máy tính công trình cài Tailscale, đăng nhập đúng nhóm, rồi mở cùng một địa chỉ HTTPS. Cách này giữ PostgreSQL và ứng dụng trên một máy, không cần VPS, tên miền công cộng hoặc mở cổng modem.

Ứng dụng MVP-03 phục vụ giao diện và API chung trên cổng 3002. Tailscale Serve chuyển địa chỉ HTTPS riêng tới `http://127.0.0.1:3002`. Theo tài liệu Tailscale, Serve áp dụng chính sách truy cập của tailnet, cấp HTTPS và có thể chạy nền bằng `--bg`.

## Chuẩn bị trước khi mở truy cập

1. Chạy `run.bat`, kiểm tra `http://localhost:3002/health` trả `OK/connected`.
2. Đặt mật khẩu riêng tối thiểu 8 ký tự cho từng tài khoản, tại thư mục `backend`:

   `node scripts/set-user-password.js <username>`

3. Đổi `NODE_ENV=production` trong `backend/.env`, khởi động lại ứng dụng. Chế độ production không chấp nhận mật khẩu demo.
4. Đăng nhập bằng tài khoản Giám đốc hoặc Admin, vào **Nhân sự → Phân công quyền truy cập công trình**. Chỉ phân công đúng công trình người đó tham gia.
5. Cài Tailscale chính thức trên máy chủ và các thiết bị, cấu hình nhóm người dùng/quyền truy cập trong tailnet. Không dùng Funnel vì Funnel mở dịch vụ ra Internet công cộng.
6. Trên máy chủ, chạy PowerShell `enable-tailnet.ps1`. Tập lệnh sẽ từ chối mở nếu còn tài khoản demo hoặc chưa ở production. Ghi lại địa chỉ `https://...ts.net` được trả về.
7. Trên từng điện thoại/máy tính: kết nối Tailscale, mở địa chỉ HTTPS, đăng nhập tài khoản riêng rồi cài ứng dụng theo hướng dẫn dưới đây.

## Cài ứng dụng trên thiết bị

Luôn cài từ địa chỉ HTTPS Tailscale `https://desktop-e9suj00.tailc548b7.ts.net/`, không cài từ địa chỉ `localhost` trên thiết bị người dùng.

### Máy tính Windows

1. Cài và kết nối Tailscale vào đúng mạng của đơn vị.
2. Mở địa chỉ HTTPS bằng Chrome hoặc Edge và đăng nhập VINA-SUPERVISION.
3. Vào **Thiết lập → Ứng dụng trên thiết bị → Cài ứng dụng** và xác nhận cài đặt.
4. Ứng dụng xuất hiện trong Start Menu và có thể ghim vào thanh tác vụ. Gỡ ứng dụng không xóa dữ liệu trên máy chủ.

### Điện thoại Android

1. Cài Tailscale và kết nối đúng mạng.
2. Mở địa chỉ HTTPS bằng Chrome, đăng nhập rồi vào **Thiết lập → Cài ứng dụng**.
3. Nếu Chrome không hiện hộp cài tự động, mở menu trình duyệt và chọn **Cài đặt ứng dụng** hoặc **Thêm vào màn hình chính**.

### iPhone/iPad

1. Cài Tailscale và kết nối đúng mạng.
2. Mở địa chỉ HTTPS bằng Safari và đăng nhập.
3. Trong **Thiết lập**, bấm **Cài ứng dụng** để xem nhắc cài đặt; sau đó mở nút **Chia sẻ** của Safari và chọn **Thêm vào Màn hình chính**.

Sau khi cài, biểu tượng VINA mở ở chế độ ứng dụng độc lập. Tailscale vẫn phải kết nối; khi máy chủ văn phòng tắt, người dùng chỉ mở được phần giao diện đã lưu đệm và không thể đọc dữ liệu mới từ máy chủ.

## Kiểm tra nghiệm thu tối thiểu

- Tài khoản chỉ thấy công trình được phân công; kết thúc phân công thì công trình biến mất sau tải lại.
- Tạo nhật ký, vấn đề và ảnh trên điện thoại; kiểm tra chúng xuất hiện trên máy tính khác.
- Tắt mạng, lập nhật ký/vấn đề; bật mạng và kiểm tra **Đang chờ: 0**.
- Ảnh tối đa 5 MB, định dạng JPEG, PNG hoặc WebP. Gửi lại cùng ảnh không tạo bản trùng.
- Sao lưu gồm cả PostgreSQL và thư mục `backend/uploads`.
- Với tải thực tế 50–100 ảnh/ngày/công trình, phải theo dõi dung lượng ổ chứa `backend/uploads`; cảnh báo vận hành nên đặt ở các mức 70%, 85% và 95%. Luôn giữ tệp `.dump` và gói `-uploads.zip` cùng một mốc thời gian để phục hồi nhất quán.

## Sao lưu và kiểm chứng phục hồi

Tạo bản sao lưu thủ công trên máy chủ:

`powershell -NoProfile -ExecutionPolicy Bypass -File .\backup-db.ps1 -Label manual`

Không coi bản sao lưu là đạt chỉ vì đã có tệp `.dump`. Định kỳ chọn một bản sao lưu và phục hồi vào cơ sở dữ liệu thử biệt lập:

`powershell -NoProfile -ExecutionPolicy Bypass -File .\verify-backup.ps1 -BackupPath .\backups\<ten-tep>.dump -TestDatabase vina_restore_verify_manual`

Tập lệnh chỉ chấp nhận tên cơ sở dữ liệu bắt đầu bằng `vina_restore_verify_`, đối chiếu danh sách bảng, số dòng và dấu kiểm nội dung với dữ liệu đang chạy, rồi tự xóa cơ sở dữ liệu thử. Không dùng tên cơ sở dữ liệu vận hành cho tham số này.

## Tiết kiệm tài nguyên

- Giữ một tiến trình Node.js, một PostgreSQL và máy chủ tệp nhẹ hiện có.
- Không cài object storage, Redis, hàng đợi hoặc hệ thống giám sát riêng ở giai đoạn chạy thử.
- Ảnh lưu theo mã băm và chống trùng; giới hạn 5 MB để giảm dung lượng.
- Service worker chỉ lưu vỏ giao diện, manifest và biểu tượng; không lưu phản hồi API hay dữ liệu nghiệp vụ nhạy cảm.
