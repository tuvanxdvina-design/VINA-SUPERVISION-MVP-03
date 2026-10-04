# Kiểm thử đa thiết bị và đa tài khoản

## Nguyên tắc mô phỏng

- Mỗi thiết bị độc lập dùng một hồ sơ trình duyệt riêng, bộ nhớ cục bộ và token riêng.
- Hai tab trong cùng một hồ sơ trình duyệt phải dùng cùng tài khoản. Khi một tab đổi tài khoản, mọi tab còn lại tự tải lại để không trộn màn hình cũ với token mới.
- Tệp/ảnh chờ ngoại tuyến gắn với tài khoản tạo tệp; tài khoản khác trên cùng thiết bị không được đọc, xóa hoặc đồng bộ tệp đó.
- Mọi ca phá lỗi chạy trên CSDL thử có tên bắt đầu `vina_ui`/`vina_reg`, không dùng dữ liệu thật.

## Các tình huống đã tự động hóa

| Nhóm | Tình huống | Kết quả |
|---|---|---|
| Phiên | Hai tab cùng tài khoản, tab thứ hai đổi sang tài khoản khác | Tab cũ tự tải lại và chuyển đúng vùng dữ liệu; không gửi API bằng token mới trên dữ liệu cũ |
| Phiên | GS và Trưởng TVGS mở hai thiết bị độc lập | GS gửi, Trưởng TVGS nhận/duyệt, GS thấy trạng thái mới mà không đăng xuất |
| Ngoại tuyến | Người A có ảnh/tệp chờ rồi đổi sang người B | B thấy 0 tệp, không đọc/xóa được; quay lại A tệp vẫn còn |
| Mạng | Đứt mạng giữa lúc tải hai ảnh | Ảnh chưa xong còn trong hàng đợi; nối lại đủ đúng hai ảnh, không nhân đôi |
| Thao tác nhanh | Bấm lưu hai lần gần đồng thời | Chỉ một bản cục bộ và một bản máy chủ; nút bị khóa trong lúc lưu |
| Đồng thời | Hai thiết bị sửa cùng bản ghi | Bản lưu sau nhận xung đột; nội dung trên thiết bị được giữ để đối chiếu |
| Quyền | Một người là Trưởng TVGS ở A, GS viên ở B | Menu, nút và quyền duyệt đổi theo công trình |
| Mobile | 390×844 và 844×390 | Không tràn trang; tên chức năng còn hiển thị; hộp thoại nằm trong màn hình |
| Ảnh | Chọn/chụp nhiều ảnh rồi gửi duyệt | Ảnh lưu tập trung; báo cáo cá nhân không biến mất khi chờ duyệt |

## Tình huống nghiệm thu thực địa còn cần thiết bị thật

1. Android Chrome/PWA: chụp liên tiếp 20 ảnh thực tế, khóa màn hình giữa lần tải, mở lại và kiểm tra hàng đợi.
2. iPhone Safari/PWA: chụp ảnh HEIC/ảnh camera, chuyển Wi-Fi sang 4G rồi về Tailscale, kiểm tra thông báo và đồng bộ.
3. Hai GS cùng một ca, hai hạng mục khác nhau; Trưởng TVGS tổng hợp khi một người còn ngoại tuyến.
4. Máy tính quản trị mở báo cáo trong khi Trưởng TVGS duyệt trên điện thoại; tải lại và kiểm tra trạng thái/phiên bản.
5. Đổi mật khẩu hoặc khóa tài khoản khi tài khoản đó còn mở trên thiết bị khác; yêu cầu đăng nhập lại, không lưu thêm dữ liệu bằng phiên cũ.
6. Tailscale mất DNS, mất kết nối máy chủ và máy chủ khởi động lại giữa lần tải; không mất bản nháp/tệp chờ.

## Quy tắc sử dụng nhiều tài khoản

- Cùng một thiết bị nhưng cần mở đồng thời hai tài khoản: dùng hai hồ sơ trình duyệt độc lập hoặc hai thiết bị.
- Không dùng hai tab cùng hồ sơ cho hai tài khoản khác nhau; ứng dụng chủ động đồng bộ chúng về tài khoản đăng nhập sau cùng.
