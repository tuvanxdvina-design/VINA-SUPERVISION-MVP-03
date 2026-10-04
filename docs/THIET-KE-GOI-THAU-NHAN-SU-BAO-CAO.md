# Thiết kế gói thầu, nhân sự và báo cáo

## 1. Quyết định nghiệp vụ

- Không còn mục "Nhật ký giám sát" độc lập trên giao diện. Bảng `daily_logs` được giữ trong CSDL để tương thích và đổi nghĩa hiển thị thành **Báo cáo ngày cá nhân**.
- Mỗi giám sát viên, kể cả TVGS trưởng, được lập một báo cáo riêng cho từng ca/phạm vi được giao. Khóa chống trùng vẫn là công trình + ngày + ca + người lập, không khóa cả ca.
- TVGS trưởng tổng hợp các báo cáo cá nhân theo ca hoặc cả ngày thành Báo cáo ngày chung. Báo cáo tuần, tháng, quý và hoàn thành dùng chung một phân hệ Báo cáo.
- Hồ sơ pháp lý nằm trong chi tiết Công trình; không tạo thêm một menu ngang hàng trên điện thoại.

## 2. Mô hình dữ liệu đích

### Hồ sơ nhân sự dùng chung

`personnel_profiles` là nguồn dữ liệu duy nhất cho họ tên, tài khoản liên kết, mô tả chứng chỉ và tệp chứng chỉ. `project_personnel` chỉ còn là phân công của hồ sơ đó tại một công trình, gồm chức danh và trạng thái.

Một người có một hồ sơ dùng chung nhưng có nhiều phân công đồng thời. Vai trò hiệu lực, quyền và giao diện được tính theo công trình đang chọn, không lấy loại tài khoản toàn cục để suy diễn chức danh tại mọi công trình.

### Cấu trúc thi công

- `project_packages`: các gói thầu thuộc công trình.
- `project_contractors`: danh mục nhà thầu thuộc công trình.
- `package_contractors`: một gói thầu có nhiều nhà thầu.
- `package_work_items`: các hạng mục thuộc gói thầu; mỗi hạng mục có thể gắn nhà thầu thực hiện.
- `personnel_work_assignments`: một phân công nhân sự được giao một hoặc nhiều gói thầu/hạng mục.

`daily_logs` tham chiếu `package_id`, `contractor_id`, `work_item_id` và vẫn giữ các cột chữ hiện có làm ảnh chụp lịch sử. Vì vậy đổi tên nhà thầu/hạng mục sau này không làm sai báo cáo cũ.

## 3. Chuyển dữ liệu cũ

1. Mỗi công trình đang có `contractor_name` được tạo một gói mặc định và một nhà thầu mặc định; nội dung hợp đồng cũ được giữ nguyên trên công trình trong giai đoạn chuyển tiếp.
2. Báo cáo cũ chưa xác định được gói/hạng mục chính xác thì để khóa ngoại rỗng, giữ nguyên `contractor_unit` và `work_item`; không tự đoán.
3. Nhân sự có tài khoản được hợp nhất chắc chắn theo `user_id`. Nhân sự chưa có tài khoản không tự gộp chỉ vì trùng tên; quản trị chọn hồ sơ nguồn khi phân công sang dự án khác.
4. Tệp chứng chỉ không sao chép nhị phân. Các phân công cùng hồ sơ dùng chung tham chiếu cùng danh sách tệp.

## 4. Giao diện

- Công trình có các vùng: Tổng quan, Gói thầu và hạng mục, Nhân sự, Hồ sơ, Tiến độ, Báo cáo.
- Biểu mẫu thêm nhân sự có hai chế độ trong cùng cửa sổ: **Chọn hồ sơ hiện có** hoặc **Tạo hồ sơ mới**. Chức danh, gói thầu và hạng mục luôn nhập cho riêng công trình hiện tại.
- Form Báo cáo ngày chọn theo chuỗi Gói thầu → Nhà thầu → Hạng mục; chỉ hiện phạm vi đã phân công, trừ Admin/Giám đốc/TVGS trưởng có quyền xem rộng.
- Điện thoại dọc giữ bốn mục chính và menu Thêm có nhãn chữ; điện thoại ngang hiện biểu tượng kèm tên đầy đủ.

## 5. Thứ tự triển khai có kiểm soát

1. Hồ sơ nhân sự dùng chung và chọn hồ sơ có sẵn.
2. Gói thầu, nhà thầu, hạng mục và chuyển dữ liệu cũ.
3. Phân công nhân sự theo gói/hạng mục.
4. Đổi Nhật ký thành Báo cáo ngày cá nhân, bổ sung tổng hợp ca/ngày.
5. Gộp menu Báo cáo và bổ sung quý; hoàn thiện xem/in/chia sẻ.
6. Hoàn thiện biên bản, thư kỹ thuật, chân ký và thứ trong tuần.

Mỗi bước có migration, điểm khôi phục, kiểm thử API theo vai trò, kiểm thử desktop/mobile và kiểm tra dữ liệu sau chuyển đổi riêng.
