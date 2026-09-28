# Báo cáo ổn định hóa VINA-SUPERVISION MVP-02

Ngày 22/09/2026. Mục tiêu hiện tại: chạy thử nội bộ.

## Đã thực hiện

1. Sửa lỗi mã hóa tiếng Việt của giao diện, chuẩn hóa các tệp đã sửa về UTF-8, bảo toàn logic HTML/JavaScript.
2. Tạo `run.bat` và `start-dev.ps1` để khởi động và kiểm tra PostgreSQL, API, giao diện; giới hạn các cổng ở `127.0.0.1`. Kiểm tra sức khỏe API phản ánh kết nối cơ sở dữ liệu.
3. Chặn đăng nhập sai mật khẩu và tự tạo tài khoản; dùng mật khẩu `demo` chỉ cho tài khoản demo có sẵn trong môi trường phát triển. Bảo vệ API công trình bằng token và quyền vai trò; không cho tự chọn vai trò trong giao diện.
4. Thêm các trường công trình còn thiếu bằng migration `migrations/20260922_project_fields.sql`, sửa dữ liệu khởi tạo `project_members`, đồng bộ tạo/cập nhật công trình từ trình duyệt sang PostgreSQL.
5. Đồng bộ tạo/cập nhật nhật ký; dùng ID do trình duyệt tạo để gửi lại an toàn sau mất kết nối. Chỉ ghi lịch sử CREATE khi thực sự thêm bản ghi.
6. Sao lưu cơ sở dữ liệu trước thay đổi cấu trúc tại `backups/vina-supervision-2026-09-22-before-project-fields.dump`. Kiểm tra tích hợp trên cơ sở dữ liệu thử riêng `vina_supervision_trial_20260922`.

## Kết quả kiểm tra

- Backend chính sau khởi động lại: `/health` trả `OK/connected`; 3 công trình và 4 nhật ký của công trình đầu vẫn đọc được. API công trình từ chối yêu cầu không đăng nhập với HTTP 401.
- Trên cơ sở dữ liệu thử: tạo và cập nhật công trình qua giao diện thành công; hàng đợi trở về 0. Gửi lại POST tạo cùng ID không thêm công trình thứ hai.
- Trên cơ sở dữ liệu thử: gửi POST tạo nhật ký cùng ID hai lần trả HTTP 201 rồi 200; cơ sở dữ liệu có 1 nhật ký và 1 lịch sử CREATE.
- `node --check` đạt cho `api.js`, 5 đoạn JavaScript nội tuyến trong `index.html` và các tệp backend vừa chỉnh sửa.

## Cần xác minh và hoàn thiện

- Vấn đề, hồ sơ, nhân sự vẫn lưu cục bộ. Cần thiết kế và kiểm tra đồng bộ trước khi coi dữ liệu các phần này là dữ liệu dùng chung.
- Chưa kiểm thử đầy đủ tình huống hai người sửa cùng bản ghi, toàn bộ quy trình duyệt nhật ký, lưu tệp, và khôi phục từ bản sao lưu.
- Một số nội dung nhật ký cũ trong PostgreSQL có dấu `?` thay chữ tiếng Việt. Cần đối chiếu nguồn gốc để sửa chính xác.
- Xác thực mật khẩu demo và phân quyền hiện tại chỉ phù hợp chạy thử nội bộ. Cần tài khoản/mật khẩu riêng và kiểm soát theo từng công trình trước khi dùng dữ liệu thật.
