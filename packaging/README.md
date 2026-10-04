# Gói cài VINA-SUPERVISION Client cho Windows

## Tệp phát hành thử nghiệm

`dist/release/VINA-Client-Setup-2026-10-14.4.exe`

Gói dành cho điện thoại theo phương án PWA thử nghiệm:

`dist/release/VINA-Mobile-Install-2026-10-14.4.zip`

Điện thoại vẫn phải cài và đăng nhập Tailscale của đơn vị trước. Sau đó mở địa chỉ VINA bằng Chrome (Android) hoặc Safari (iPhone) và chọn **Thêm vào màn hình chính** theo hướng dẫn trong gói.

Gói cài thực hiện các bước sau:

1. Kiểm tra Windows 10/11 và Microsoft Edge.
2. Nếu thiếu Tailscale, cài gói chính thức `Tailscale.Tailscale` qua Windows Package Manager.
3. Tạo biểu tượng VINA-SUPERVISION trên Desktop và Start Menu.
4. Mở ứng dụng bằng Edge ở chế độ cửa sổ độc lập, không cần thao tác cài PWA trong trình duyệt.
5. Đăng ký mục gỡ cài đặt trong **Settings → Apps**. Gỡ VINA không gỡ Tailscale để tránh ảnh hưởng ứng dụng khác.
6. Mỗi lần mở VINA, kiểm tra kết nối máy chủ trước; nếu Tailscale chưa kết nối, hiển thị hướng dẫn tiếng Việt thay cho lỗi DNS của trình duyệt.

Người dùng vẫn phải xác nhận quyền quản trị khi Windows cài Tailscale và đăng nhập Tailscale một lần. Đây là yêu cầu bảo mật của VPN, không nên tự động bỏ qua.

## Kiểm tra trước khi phát hành

Chạy:

`powershell -NoProfile -ExecutionPolicy Bypass -File .\packaging\client\install-client.ps1 -ValidateOnly`

Xây lại bộ cài:

`powershell -NoProfile -ExecutionPolicy Bypass -File .\packaging\build-client-installer.ps1`

Bản thử nghiệm chưa được ký Authenticode nên Windows SmartScreen có thể yêu cầu chọn **More info → Run anyway**. Bản phát hành chính thức cần chứng thư ký mã của đơn vị.
