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

## Cập nhật build 2026-10-10.1 (30/09/2026)

- Đồng bộ đầy đủ loại hợp đồng, hình thức giá, số ngày thực hiện TVGS và số ngày hoạt động nhà thầu. Ngày kết thúc/số ngày được tính hai chiều; giá trị tiền hiển thị theo định dạng Việt Nam.
- Bổ sung tệp scan chứng chỉ nhân sự lưu tập trung, giới hạn 15 MB; bổ sung tệp quyết định ngay tại từng dòng thay thế nhân sự trong hồ sơ công trình.
- Nhật ký cho phép nhiều giám sát viên lập bản riêng trong cùng ngày/ca; chỉ chặn trùng đối với chính tài khoản đó. Báo cáo ngày tổng hợp tất cả bản riêng và thống kê theo người lập.
- Form nhật ký lưu riêng: đơn vị thi công, hạng mục, thời tiết, cán bộ kỹ thuật, nhân công, máy móc, công việc và kiến nghị. Đơn vị thi công tự lấy từ nhà thầu của công trình và vẫn cho phép điều chỉnh.
- Sửa khóa đồng bộ để thao tác "Lưu và gửi duyệt" chờ lượt đồng bộ đang chạy, thay vì kiểm tra quá sớm; sửa nút tải lại hộp duyệt có trạng thái phản hồi; đăng nhập bằng phím Enter.
- Sửa `start-dev.ps1` để thật sự sao chép toàn bộ thư mục `js` sang `web-public`; trước đây `-LiteralPath` làm ký tự `*` không được mở rộng nên giao diện có thể vẫn dùng mã cũ.
- Migration: `migrations/20261010_contract_personnel_daily.sql`. Điểm khôi phục đã kiểm tra: `backups/vina-supervision-2026-09-30-1450-truoc-migration-20261010.dump` và tệp `-uploads.zip` cùng tên.
- Kiểm thử tách biệt: backend 45/45 đạt; giao diện 20/20 đạt; PWA không có lỗi cài đặt chặn. Sau triển khai: health `OK`, database `connected`, build `2026-10-10.1`, migration chờ `0`; giao diện `http://localhost:8081/` trả HTTP 200 và đã chứa trường nhật ký mới.

## Cập nhật build 2026-10-11.1 (30/09/2026)

- Hồ sơ chứng chỉ được dùng chung theo tài khoản nhân sự đã liên kết. Quản trị có thể bổ sung mô tả và tệp chứng chỉ từ hồ sơ nhân sự của công trình; dữ liệu đó xuất hiện ở các công trình khác của cùng người mà không phải nhập lại.
- Vai trò được xác định theo từng công trình. Cùng một tài khoản có thể là TVGS trưởng tại công trình A và giám sát viên tại công trình B; nhãn vai trò và quyền thao tác thay đổi theo công trình đang chọn.
- Nhân lực và máy móc trong nhật ký được lưu theo nhiều dòng loại/số lượng. Tổng số được máy chủ tính lại từ chi tiết để tránh sai lệch giữa tổng và từng loại.
- Nhiều giám sát viên tiếp tục được lập báo cáo riêng trong cùng ngày/ca. TVGS trưởng có nút tổng hợp báo cáo ngày, xem nội dung của từng người, lưu và gửi báo cáo tổng hợp qua quy trình duyệt hiện có.
- Migration: `migrations/20261011_daily_log_resources.sql`. Điểm khôi phục đã kiểm tra: `backups/vina-supervision-2026-09-30-1953-truoc-migration-20261011.dump` và `backups/vina-supervision-2026-09-30-1953-truoc-migration-20261011-uploads.zip`.
- Kiểm thử tách biệt: backend 46/46 đạt; giao diện 20/20 đạt; PWA có service worker hoạt động, vỏ ứng dụng mở được ngoại tuyến và không có lỗi cản trở cài đặt. Sau triển khai: health `OK`, database `connected`, build `2026-10-11.1`, migration chờ `0`, cảnh báo bảo mật `0`.

## Cập nhật build 2026-10-12.1 (30/09/2026)

- Điều hướng mobile luôn có tên đi cùng biểu tượng. Điện thoại dọc dùng thanh điều hướng dưới có thể cuộn; điện thoại ngang và máy tính bảng dùng thanh bên rộng 190 px, không còn chế độ chỉ hiển thị biểu tượng 72 px.
- Thay biểu tượng điều hướng bằng các ký hiệu quen thuộc, có nhãn chữ làm căn cứ chính để người dùng không phải đoán chức năng.
- Hồ sơ không còn là phân hệ rời trên menu. Người dùng vào `Công trình → Chi tiết`, xem danh sách hồ sơ, bấm `Khai báo hồ sơ`, `Xem` hoặc `Sửa`; màn quản lý đầy đủ vẫn được mở từ nút `Xem tất cả` của chính công trình.
- Đổi mật khẩu được chuyển từ đầu trang vào `Thiết lập → Tài khoản và phiên làm việc`; đầu trang chỉ giữ thao tác Đăng xuất.
- Giữ Nhật ký là chức năng độc lập vì đây là nơi nhập liệu thường xuyên của giám sát viên. Báo cáo là lớp tổng hợp theo ngày/tuần/tháng/hoàn thành từ nhiều nhật ký và dữ liệu liên quan; không gộp hai luồng nhập và tổng hợp vào cùng một màn hình.
- Kiểm thử: backend 46/46 đạt trên CSDL thử riêng; giao diện 20/20 đạt, trong đó kiểm tra responsive tại 390×844 và 844×390; PWA không có lỗi cản trở cài đặt. Sau triển khai: health `OK`, database `connected`, build `2026-10-12.1`, migration chờ `0`.

## Cập nhật build 2026-10-13.1 (01/10/2026)

- Tổ chức menu máy tính thành ba nhóm: Công việc, Điều hành và Hệ thống. Điện thoại dọc chỉ giữ bốn chức năng chính (Tổng quan, Công trình, Nhật ký, Cần duyệt) và nút `Thêm`; danh sách `Thêm` tự loại các chức năng tài khoản không có quyền.
- Ẩn các nút tạo công trình, nhật ký, nội dung chất lượng, báo cáo và nhân sự khi tài khoản không có quyền tương ứng; API vẫn là lớp kiểm soát cuối cùng, không dựa vào việc ẩn nút.
- Sửa quyền cập nhật thông tin công trình và bảng tiến độ gốc theo vai trò tại chính công trình đó. Tài khoản loại TVGS trưởng nhưng đang là GS viên tại công trình khác không còn được sửa công trình đó; Admin/Giám đốc vẫn toàn quyền.
- Lập ma trận nghiệm thu đầy đủ tại `docs/TEST-MATRIX-ROLES.md`, gồm 5 loại tài khoản, quyền tùy chỉnh, đa công trình, quy trình duyệt, ngoại tuyến, tệp, mobile, Tailscale, sao lưu và khôi phục.
- Kiểm thử trên CSDL thử riêng: backend 47/47 đạt; giao diện 22/22 đạt, bao gồm ma trận đủ Admin, Giám đốc, Quản lý, TVGS trưởng, TVGS và menu mobile theo quyền; PWA không có lỗi cản trở cài đặt.
- Sau triển khai: health `OK`, database `connected`, build `2026-10-13.1`, migration chờ `0`; Tailscale Serve vẫn ở chế độ `tailnet only` và chuyển tiếp HTTPS tới `127.0.0.1:3002`.

## Cập nhật build 2026-10-14.1 (01/10/2026)

- Bổ sung khóa phiên bản kỹ thuật `row_version` độc lập với số lần phát hành nghiệp vụ cho công trình, báo cáo ngày cá nhân, hồ sơ/báo cáo và văn bản chất lượng.
- Thiết bị gửi kèm phiên bản đã đọc khi cập nhật. Nếu một thiết bị khác đã lưu trước, máy chủ trả `409 EDIT_CONFLICT`; bản đang chờ trên thiết bị được giữ lại để đối chiếu, không tự động ghi đè dữ liệu mới hơn.
- Các thay đổi trạng thái duyệt, mở lại, khóa và thay đổi tệp đính kèm cũng tăng phiên bản bản ghi. Khách cài đặt cũ chưa gửi phiên bản vẫn tiếp tục hoạt động trong giai đoạn chuyển tiếp.
- Migration: `migrations/20261014_optimistic_concurrency.sql`. Điểm khôi phục đã kiểm tra: `backups/vina-supervision-2026-10-01-1158-truoc-row-version-20261014.dump` (3.593,4 KB) và tệp `-uploads.zip` cùng tên.
- Kiểm thử trên CSDL thử riêng: backend 48/48 đạt, gồm mô phỏng hai thiết bị cùng sửa cả bốn loại bản ghi; giao diện 22/22 đạt; kiểm tra mã giao diện 0 lỗi; PWA có service worker và không có lỗi cản trở cài đặt.
- Sau triển khai: health `OK`, database `connected`, build `2026-10-14.1`, migration chờ `0`, cảnh báo bảo mật `0`; bốn bảng đều có `row_version`. Tailscale Serve vẫn `tailnet only`, chuyển tiếp HTTPS tới `127.0.0.1:3002`.

## Cập nhật build 2026-10-14.2 (01/10/2026)

- Sửa bước tải lại sau xung đột: công trình, báo cáo ngày cá nhân và văn bản chất lượng có hàng đợi `CONFLICT` không còn bị bản máy chủ ghi đè. Nội dung cục bộ được giữ nguyên để người dùng đối chiếu.
- Bổ sung nhãn `Cần đối chiếu` ngay tại bản ghi và sửa Tổng quan để chỉ đúng phân hệ cần mở, thay vì luôn hướng người dùng sang Công trình.
- Bổ sung ca giao diện GD-18 mô phỏng ba loại bản ghi xung đột và xác nhận tải lại không làm mất nội dung trên thiết bị.
- Lần chạy toàn bộ đầu tiên đạt 22/23 do GD-07 đổi tài khoản trước khi thao tác gửi duyệt bất đồng bộ hoàn tất. Dấu vết cho thấy hộp duyệt hoạt động đúng; ca cô lập đạt. Điều kiện kiểm thử đã được sửa để chờ đúng trạng thái `Chờ duyệt`, sau đó toàn bộ giao diện đạt 23/23.
- Sau triển khai: backend `2026-10-14.2`, database `connected`, migration chờ `0`. Thay đổi `.2` không đổi cấu trúc hoặc dữ liệu nên không chạy migration và không tạo thêm bản sao lưu.

## Cập nhật build 2026-10-14.3 (01/10/2026)

- Thay ô gợi ý thời tiết bằng danh sách chọn chuẩn, hoạt động ổn định trên Chrome Android, Safari iPhone và giao diện máy tính. Giá trị cũ ngoài danh mục vẫn được giữ khi mở sửa.
- Biểu mẫu báo cáo ngày cho phép chọn nhiều ảnh hoặc chụp liên tiếp; các lần chụp được cộng dồn vào danh sách chờ, có tên/dung lượng và nút bỏ từng ảnh. Ảnh tiếp tục được tối ưu trước khi đưa vào hàng đợi ngoại tuyến.
- Sau khi gửi duyệt, giao diện nhận phiên bản bản ghi mới rồi tải lại nguồn chuẩn từ máy chủ. Báo cáo cá nhân vẫn hiện ngay ở trạng thái `Chờ duyệt`; số ảnh phản ánh đúng dữ liệu đã lưu tập trung.
- Thanh đầu trang hiện họ tên, tên đăng nhập và quyền toàn hệ thống. Mục nhập thường xuyên được đổi tên rõ thành `Báo cáo ngày`; dữ liệu và API `daily_logs` được giữ nguyên để không phát sinh migration/rủi ro dữ liệu.
- Bổ sung ca GD-19 ở kích thước 390×844: chọn `Mưa nhỏ`, tải hai ảnh, gửi duyệt, tải lại và xác nhận báo cáo vẫn hiện trước khi Trưởng TVGS duyệt; API xác nhận đủ hai ảnh.
- Kiểm thử trên CSDL thử riêng: backend 48/48 đạt; giao diện 24/24 đạt; kiểm tra mã giao diện 0 lỗi; PWA có manifest/service worker hợp lệ, vỏ ứng dụng hoạt động ngoại tuyến và không có lỗi cản trở cài đặt.
- Đã tạo `dist/release/VINA-Client-Setup-2026-10-14.3.exe` cho Windows và `dist/release/VINA-Mobile-Install-2026-10-14.3.zip` cho Android/iPhone theo phương án PWA. Bộ cài Windows qua kiểm tra Edge, Tailscale và máy chủ HTTP 200.
- Sau triển khai: health `OK`, database `connected`, build `2026-10-14.3`, migration chờ `0`, cảnh báo bảo mật `0`. Tailscale Serve ở chế độ `tailnet only`, HTTPS chuyển tiếp tới `127.0.0.1:3002`; không mở công khai Internet.

## Cập nhật build 2026-10-14.4 (02/10/2026)

- Cô lập phiên khi dùng nhiều tài khoản: đổi tài khoản ở một tab làm các tab cùng hồ sơ tự tải lại; chặn yêu cầu API nếu tài khoản hiện tại khác tài khoản lúc tab được mở.
- Hàng đợi ảnh/tệp ngoại tuyến gắn với tài khoản. Tài khoản khác trên cùng thiết bị không đọc, đếm, xóa hoặc đồng bộ được tệp đang chờ.
- Khóa thao tác lưu báo cáo ngày trong lúc xử lý để bấm liên tiếp không tạo bản trùng hoặc làm treo biểu mẫu.
- Bổ sung GD-20..24: đổi tài khoản giữa tab, cô lập tệp, hai thiết bị GS/Trưởng TVGS, mất mạng giữa tải ảnh và bấm lưu liên tiếp.
- Kiểm thử trên CSDL thử riêng: backend `48/48`, giao diện `29/29`, PWA đạt; không có migration mới.
- Dịch vụ thử nghiệm đã chạy build `2026-10-14.4`: health `OK`, database `connected`, migration chờ `0`, cảnh báo bảo mật `0`.
- Tổ chức công việc thành 8 gói tại `docs/WORK-PACKAGES.md`; trạng thái bàn giao ngắn nằm tại `docs/CURRENT-STATE.md` để phiên sau không phải rà toàn dự án.
