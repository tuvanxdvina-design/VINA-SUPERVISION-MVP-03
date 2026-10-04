# Ma trận kiểm thử vai trò và nghiệm thu VINA-SUPERVISION

Ngày lập: 01/10/2026. Phạm vi: bản thử nghiệm nội bộ, dữ liệu tập trung, desktop và mobile PWA.

## 1. Vai trò bắt buộc kiểm thử

| Mã | Loại tài khoản | Phạm vi mặc định |
|---|---|---|
| R1 | Admin | Toàn bộ công trình và toàn bộ quyền, kể cả xóa vĩnh viễn |
| R2 | Giám đốc | Toàn bộ công trình; quản lý tài khoản/phân quyền; không xóa vĩnh viễn |
| R3 | Quản lý giúp việc | Chỉ công trình được phân công; mặc định Xem và Tải xuống |
| R4 | TVGS trưởng tại công trình | Xem, Thêm, Sửa, Tải xuống, Duyệt tại đúng công trình được giao làm trưởng |
| R5 | TVGS/giám sát viên | Xem, Thêm, Tải xuống; sửa bản nháp do mình lập; không duyệt |

Mỗi R3-R5 phải kiểm tra thêm ba biến thể: không được phân công, được phân công mặc định, và được cấp quyền tùy chỉnh. Một người phải được thử đồng thời là TVGS trưởng tại công trình A và TVGS tại công trình B.

## 2. Ma trận quyền tối thiểu

| Chức năng | R1 | R2 | R3 | R4 | R5 |
|---|---:|---:|---:|---:|---:|
| Xem mọi công trình | Có | Có | Không | Không | Không |
| Tạo công trình | Có | Có | Không | Không | Không |
| Sửa thông tin/bảng tiến độ gốc | Có | Có | Không | Có, đúng công trình | Không |
| Cập nhật tiến độ thực tế | Có | Có | Khi được cấp Thêm | Có | Có |
| Lập nhật ký/chất lượng/hồ sơ/báo cáo | Có | Có | Khi được cấp Thêm | Có | Có |
| Sửa nội dung người khác | Có | Có | Khi được cấp Sửa | Có | Không mặc định |
| Duyệt/trả lại/khóa | Có | Có | Khi được cấp Duyệt | Có | Không |
| Trình công ty | Không cần | Không cần | Khi được cấp Duyệt | Có | Không |
| Quản lý tài khoản, nhân sự, phân quyền | Có | Có | Không | Không | Không |
| Xóa vào Thùng rác | Có | Có | Khi được cấp Xóa | Không mặc định | Không mặc định |
| Xóa vĩnh viễn | Có | Không | Không | Không | Không |

## 3. Tình huống đăng nhập và tài khoản

| ID | Tình huống | Kết quả cần đạt |
|---|---|---|
| TK-01 | Đăng nhập đúng từng R1-R5 | Vào ứng dụng; hiển thị đúng dữ liệu và menu theo quyền |
| TK-02 | Sai mật khẩu/tài khoản không tồn tại | Cùng một thông báo tiếng Việt; không tiết lộ tài khoản có tồn tại |
| TK-03 | Sai liên tục | Tạm khóa theo giới hạn; không khóa người dùng khác |
| TK-04 | Tài khoản mới/mật khẩu đặt lại | Bắt buộc đổi mật khẩu, không đóng được hộp thoại để bỏ qua |
| TK-05 | Đổi mật khẩu | Phiên cũ mất hiệu lực; mật khẩu cũ không đăng nhập được |
| TK-06 | Vô hiệu hóa tài khoản | Không đăng nhập được; lịch sử dữ liệu cũ giữ nguyên tên người lập |
| TK-07 | Giám đốc tạo/sửa Admin | Bị từ chối; chỉ Admin quản lý được tài khoản Admin |

## 4. Tình huống công trình và phân quyền

| ID | Tình huống | Kết quả cần đạt |
|---|---|---|
| CT-01 | R1/R2 tạo và sửa công trình | Lưu đủ hợp đồng, ngày, giá trị, tệp; không tạo trùng mã/số hợp đồng |
| CT-02 | R3-R5 tạo công trình | Giao diện không hiện nút; API trả 403 |
| CT-03 | R4 sửa công trình đang làm trưởng | Thành công và có Audit Log |
| CT-04 | Cùng R4 nhưng là TVGS tại công trình khác | Không thấy nút Sửa; API trả 403 |
| CT-05 | Người không được phân công truy cập URL/ID trực tiếp | API trả 403; không rò tên hoặc dữ liệu công trình |
| CT-06 | Hết ngày phân công hoặc trạng thái không hoạt động | Công trình biến mất khỏi phạm vi; dữ liệu lịch sử không mất |
| CT-07 | Tùy chỉnh quyền Sửa | Tự bổ sung quyền Thêm; không tự có Duyệt hoặc Xóa |
| CT-08 | Chức danh TVGS trưởng | Mặc định có Duyệt; chức danh có chữ “Phó” không được nhận Duyệt tự động |

## 5. Nhật ký và báo cáo ngày

| ID | Tình huống | Kết quả cần đạt |
|---|---|---|
| NK-01 | Nhiều TVGS lập cùng ngày/ca | Mỗi tài khoản có một bản riêng; không ghi đè nhau |
| NK-02 | Cùng tài khoản lập trùng ngày/ca | Bị chặn tạo trùng, không phát sinh bản thứ hai |
| NK-03 | Nhân lực/máy móc nhiều loại | Lưu đủ từng loại; tổng số máy chủ tính đúng |
| NK-04 | Nháp → gửi → trả lại → sửa → gửi lại → duyệt → khóa | Đúng trạng thái, người và nút ở từng bước; lưu đủ ý kiến |
| NK-05 | TVGS tự duyệt bản mình lập | Bị từ chối nếu không có quyền Duyệt tại công trình |
| NK-06 | TVGS trưởng duyệt công trình khác | Không thấy việc; gọi API trực tiếp bị từ chối |
| NK-07 | Trưởng nhóm tổng hợp báo cáo ngày | Có đủ báo cáo riêng của từng người; xem lại từng bản; tổng không nhân đôi |
| NK-08 | Mất mạng khi lập nhật ký và ảnh | Lưu hàng đợi IndexedDB; nối mạng đồng bộ một lần; không mất tệp |
| NK-09 | Hai thiết bị sửa cùng một bản | Phát hiện phiên bản/xung đột; không âm thầm ghi đè dữ liệu mới hơn |

## 6. Chất lượng, hồ sơ và báo cáo

| ID | Tình huống | Kết quả cần đạt |
|---|---|---|
| HS-01 | Khai báo hồ sơ từ Chi tiết công trình | Công trình được chọn đúng; lưu và hiện ngay trong công trình |
| HS-02 | Sửa hồ sơ nháp của chính người lập | R5 được sửa; tệp bổ sung dùng chung trên thiết bị khác |
| HS-03 | Hồ sơ đã gửi/duyệt/khóa | Người lập không sửa; người có Duyệt quyết định đúng quy trình |
| HS-04 | Mở khóa hồ sơ | Tăng phiên bản; giữ phiên bản và Audit Log trước đó |
| HS-05 | Văn bản chất lượng | Lưu đủ thành phần, kết luận, chữ ký, thư kỹ thuật và tệp ký |
| HS-06 | Báo cáo ngày/tuần/tháng/hoàn thành | Kỳ và số liệu tổng hợp đúng nhật ký, tiến độ, vấn đề và hồ sơ |
| HS-07 | Trình công ty | TVGS trưởng không tự quyết định sau khi trình; R1/R2 nhận đủ lý do |
| HS-08 | Người ngoài công trình tải tệp bằng URL trực tiếp | Bị từ chối |
| HS-09 | HTML/SVG hoặc tệp giả mạo | Không được trình duyệt thực thi như nội dung cùng nguồn |

## 7. Nhân sự và chứng chỉ

| ID | Tình huống | Kết quả cần đạt |
|---|---|---|
| NS-01 | R1/R2 thêm/sửa nhân sự, liên kết tài khoản | Một người một dòng trong công trình; không ghép nhầm chỉ theo tên |
| NS-02 | Chứng chỉ một người ở nhiều công trình | Nhập/tải một lần, cùng tài khoản xem được ở các công trình khác |
| NS-03 | Một người nhiều vai trò theo công trình | Nhãn vai trò và quyền đổi đúng khi chuyển công trình |
| NS-04 | R3-R5 sửa nhân sự/phân quyền | Không có nút và API trả 403 |
| NS-05 | Gỡ phân công | Không mất nhật ký/hồ sơ đã lập; không còn truy cập dữ liệu mới |

## 8. Tệp, dung lượng và dữ liệu

| ID | Tình huống | Kết quả cần đạt |
|---|---|---|
| DL-01 | 50, 100 và trên 100 ảnh/tệp trong dự án thử | Dữ liệu tập trung đầy đủ; danh sách vẫn dùng được; không đầy localStorage |
| DL-02 | Ảnh lớn từ camera điện thoại | Tối ưu dung lượng nhưng chữ/số hồ sơ vẫn đọc được |
| DL-03 | Tệp vượt giới hạn | Báo rõ tên tệp và giới hạn; dữ liệu biểu mẫu đã lưu không bị mất |
| DL-04 | Tải lại cùng tệp | Không tạo bản nhị phân trùng không cần thiết |
| DL-05 | Sao lưu và khôi phục | Khôi phục đủ CSDL, ảnh, chứng chỉ, hồ sơ và liên kết |

## 9. Giao diện và thiết bị

| ID | Tình huống | Kết quả cần đạt |
|---|---|---|
| UI-01 | Desktop 1366×768 và 1920×1080 | Menu nhóm rõ; bảng, hộp thoại và nút không chồng lấn |
| UI-02 | Điện thoại dọc 390×844 | Chỉ 4 chức năng chính và Thêm; mọi nút có tên; không tràn ngang toàn trang |
| UI-03 | Điện thoại ngang 844×390 | Thanh bên hiện biểu tượng và đầy đủ tên |
| UI-04 | Mục Thêm theo R1-R5 | Chỉ liệt kê chức năng tài khoản được phép dùng |
| UI-05 | Cỡ chữ hệ thống 125%-200% | Nhãn/nút không bị cắt, thao tác chạm tối thiểu 44 px |
| UI-06 | Android Chrome và iPhone Safari/PWA | Cài, mở độc lập, cập nhật service worker và đăng nhập bình thường |
| UI-07 | Tailscale mất/kết nối lại | Báo trạng thái rõ; không báo sai “bộ nhớ đầy”; tự đồng bộ sau khi nối lại |
| UI-08 | GS trên điện thoại chọn thời tiết, chọn/chụp nhiều ảnh rồi gửi duyệt | Thời tiết giữ đúng; đủ ảnh trên máy chủ; báo cáo vẫn hiện trong danh sách cá nhân ở trạng thái Chờ duyệt |

## 9A. Đồng thời và xung đột dữ liệu

| ID | Tình huống | Kết quả cần đạt |
|---|---|---|
| CC-01 | Hai thiết bị cùng mở và sửa một công trình | Thiết bị lưu sau nhận `409 EDIT_CONFLICT`; không ghi đè bản mới |
| CC-02 | Hai GS cùng sửa một báo cáo ngày cá nhân | Chỉ bản dùng `row_version` hiện hành được lưu; bản còn lại được giữ trên thiết bị |
| CC-03 | Hồ sơ/báo cáo đang mở thì thiết bị khác sửa, duyệt, mở lại hoặc thêm tệp | Phiên bản tăng; màn hình cũ không được ghi đè |
| CC-04 | Biên bản/thư kỹ thuật đang mở trên hai thiết bị | Bản cũ chuyển trạng thái xung đột và giữ nội dung để đối chiếu |
| CC-05 | Mất mạng, sửa ngoại tuyến, máy chủ đã có bản mới rồi kết nối lại | Không tự chọn dữ liệu; thông báo rõ bản ghi xung đột |

## 9B. Phiên đăng nhập và thiết bị dùng chung

| ID | Tình huống | Kết quả cần đạt |
|---|---|---|
| SS-01 | Hai tab cùng hồ sơ, một tab đổi tài khoản | Tab còn lại tự tải lại; không trộn dữ liệu cũ với token mới |
| SS-02 | Hai hồ sơ/thiết bị đăng nhập hai tài khoản | Hai phiên độc lập, không tự đăng xuất hoặc đổi vai trò của nhau |
| SS-03 | A có tệp ngoại tuyến rồi B đăng nhập cùng thiết bị | B không đọc, đếm, xóa hoặc đồng bộ được tệp của A |
| SS-04 | Mạng đứt giữa tải nhiều ảnh rồi nối lại | Chỉ tải phần còn thiếu, đủ tệp và không nhân đôi |
| SS-05 | Bấm Lưu/Gửi nhiều lần khi máy chậm | Chỉ một thao tác được xử lý, không tạo bản trùng hoặc treo biểu mẫu |

## 10. Tiêu chí hoàn tất mỗi lượt nghiệm thu

1. Chạy backend regression, UI, mobile và PWA trên CSDL thử riêng; không dùng CSDL thật.
2. Không có ca bị bỏ qua; kết quả phải ghi số đạt/thất bại và lý do.
3. Ca lỗi phải có ảnh chụp, nội dung trang và lỗi console trong `backend/tests/ui-artifacts`.
4. Thay đổi cấu trúc dữ liệu phải có bản sao lưu CSDL và thư mục tệp trước migration.
5. Nghiệm thu thực địa tối thiểu bằng một Android, một iPhone, một máy tính quản trị và hai tài khoản TVGS đồng thời.
