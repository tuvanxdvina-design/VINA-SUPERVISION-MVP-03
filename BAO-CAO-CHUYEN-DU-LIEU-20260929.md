# Báo cáo chuyển dữ liệu sang MVP-03

Thời điểm thực hiện: 29/09/2026.

## Phạm vi

- Nguồn chỉ đọc: container `vina-supervision-db`, cơ sở dữ liệu `vina_supervision`.
- Đích: container `vina-supervision-mvp-03-postgres-1`, cơ sở dữ liệu `vina_supervision`.
- Phương pháp: sao lưu toàn vẹn bằng `pg_dump` và phục hồi bằng `pg_restore` để giữ nguyên UUID, khóa ngoại, lịch sử, tài khoản và phân quyền.
- Thư mục `backend/uploads` của cả nguồn và đích đều không có tệp, nên không phát sinh bước sao chép tệp đính kèm.

## Điểm khôi phục

- Dữ liệu đích trước khi nhập: `backups/vina-supervision-2026-09-29-1801-before-import-from-mvp02.dump`.
- Dữ liệu nguồn dùng để nhập: `backups/mvp02-source-before-import-20260929-1802.dump`.
- Cả hai tệp đã được kiểm tra danh mục bằng `pg_restore` trước khi thay dữ liệu đích.

## Đối chiếu sau phục hồi

| Công trình | Nhật ký | Hồ sơ | Chất lượng | Tài khoản phân công | Nhân sự |
|---|---:|---:|---:|---:|---:|
| 001 | 5 | 7 | 6 | 5 | 3 |
| 002 | 1 | 0 | 3 | 2 | 1 |
| 003 | 0 | 0 | 0 | 3 | 0 |

Kết quả trên MVP-03 khớp hoàn toàn với nguồn.

## Nghiệm thu

- PostgreSQL đích hoạt động trên cổng máy `5433`.
- Backend `http://localhost:3002/health`: `OK`, `database=connected`, không có migration chờ.
- Giao diện `http://localhost:8081/`: HTTP 200.
- API với vai trò `DIRECTOR`: đọc được 3 công trình; công trình 001 trả đúng 5 nhật ký, 7 hồ sơ và 6 văn bản chất lượng.
- CORS cho `http://localhost:8081` hoạt động.
- Tài khoản `duong` đăng nhập được bằng mật khẩu tạm và bị buộc đổi mật khẩu ngay lần đăng nhập đầu.
- Kiểm tra cấu trúc frontend: 0 lỗi. Kiểm thử đơn vị JavaScript: 6/6 đạt.

## Việc quản trị còn lại

Sau khi đăng nhập, người dùng phải đổi mật khẩu tạm của `duong`. Bộ kiểm tra xác thực của ứng dụng đã xác nhận môi trường `production` và không còn tài khoản demo đang hoạt động; các tài khoản còn lại giữ nguyên mật khẩu hiện có.

## Nghiệm thu bổ sung desktop/mobile

- Hồi quy backend: 41/41 ca đạt trên cơ sở dữ liệu thử riêng.
- Giao diện desktop: toàn bộ luồng đăng nhập, phân quyền, duyệt, hồ sơ, nhật ký và thùng rác đạt.
- Phát hiện thực tế ở màn hình 390 x 844: hàng tiêu đề làm trang tràn ngang.
- Đã thu gọn riêng header dưới 600 px, giữ nguyên nội dung và vùng chạm.
- Bổ sung ca `GD-13` kiểm tra thanh điều hướng đáy, tràn ngang, khung nội dung, modal và lỗi console.
- Nghiệm thu UI cuối: 18/18 ca đạt, gồm cả desktop và mobile.
- Bản đang chạy: build `2026-10-08.4`, health `OK/connected`, không có migration chờ.

## Truy cập an toàn trên thiết bị di động

- Đã bật Tailscale Serve tại `https://desktop-e9suj00.tailc548b7.ts.net/`.
- Phạm vi truy cập: chỉ các thiết bị đã đăng nhập cùng mạng Tailscale; không bật Funnel và không công khai ứng dụng ra Internet.
- Cấu hình chuyển tiếp: HTTPS cổng 443 tới `http://127.0.0.1:3002`.
- Kiểm tra thực tế: trang chính HTTP 200; `/health` HTTP 200, `status=OK`, `database=connected`, build `2026-10-08.4`, không có migration chờ và không có cảnh báo bảo mật.

## Đối chiếu toàn bộ cơ sở dữ liệu nguồn và đích

Thực hiện lúc 21:40 ngày 29/09/2026, theo chế độ chỉ đọc trên cả hai cơ sở dữ liệu:

- Danh mục 26 bảng trong schema `public` của nguồn và đích trùng khớp hoàn toàn.
- Số dòng của cả 26/26 bảng trùng khớp, bao gồm dữ liệu nghiệp vụ, tệp đính kèm, phân quyền theo công trình, nhân sự, tiến độ, lịch sử duyệt và nhật ký kiểm toán.
- Dấu kiểm nội dung trùng khớp ở 25/26 bảng.
- Bảng `users` có cùng 8 tài khoản và cùng toàn bộ thông tin định danh, vai trò, trạng thái hoạt động. Khác biệt duy nhất thuộc tài khoản `duong`: mật khẩu, cờ buộc đổi mật khẩu, phiên bản xác thực và thời điểm cập nhật đã được chủ động thay đổi trên hệ thống đích; đây là thay đổi quản trị đã dự kiến, không phải thiếu dữ liệu.
- Container nguồn `vina-supervision-db` chỉ được đọc, không có thao tác ghi, sửa hoặc xóa.

Kết luận: không phát hiện bảng, bản ghi hoặc nhóm dữ liệu công trình bị bỏ sót trong quá trình chuyển sang MVP-03.

## Bản cài đặt thử nghiệm trên máy tính và điện thoại

- Hoàn thiện PWA cho Windows, Android và iOS: manifest, chế độ `standalone`, biểu tượng 180/192/512 px, Apple touch icon, service worker và nút **Cài ứng dụng** trong trang Thiết lập.
- Biểu tượng ứng dụng được tạo từ logo VICOAD hiện có, giữ dấu hiệu nhận diện xanh lá/xanh đậm và bỏ chữ để hiển thị rõ ở kích thước nhỏ.
- Bổ sung route backend chỉ phục vụ các tài nguyên PWA công khai; `sw.js` đặt `no-cache` để thiết bị nhận bản cập nhật mới.
- Sửa bộ khởi động nhận diện ứng dụng bằng dấu meta ổn định, không còn phụ thuộc chuỗi `MVP-02`; `run.bat` đã chạy lại thành công.
- Hồi quy backend: 41/41 ca đạt. Giao diện: 19/19 ca đạt, gồm desktop, mobile và ca `GD-14` cho manifest/biểu tượng/luồng cài đặt.
- Chrome kiểm tra trực tiếp cả `http://127.0.0.1:3002` và HTTPS Tailscale: manifest không lỗi, không có lỗi chặn cài đặt, service worker đã kiểm soát trang.
- Qua HTTPS Tailscale, `/health`, manifest, biểu tượng 192/512 px và `sw.js` đều trả HTTP 200 đúng kiểu nội dung. Build đang chạy: `2026-10-08.5`, cơ sở dữ liệu kết nối và không có migration chờ.

## Kiểm chứng sao lưu và phục hồi

- Tạo bản sao lưu mới `backups/vina-supervision-2026-09-30-0247-overnight-verify.dump`, dung lượng khoảng 2,2 MB; danh mục archive đọc được bằng `pg_restore`.
- Bổ sung `verify-backup.ps1` với chốt an toàn: chỉ phục hồi vào cơ sở dữ liệu thử có tiền tố `vina_restore_verify_`, không chấp nhận tên cơ sở dữ liệu vận hành.
- Đã phục hồi bản sao lưu vào `vina_restore_verify_20260930_0247`, đối chiếu đủ 26 bảng theo số dòng và dấu kiểm nội dung: 26/26 khớp.
- Cơ sở dữ liệu thử và tệp tạm trong container đã được xóa sau kiểm chứng; cơ sở dữ liệu vận hành và container nguồn cũ không bị thay đổi.

## Kiểm tra dữ liệu nhân sự và phân quyền thực tế

- Sửa điều kiện của `backend/scripts/diagnose-duplicates.sql` để chỉ báo nhân sự thực sự chưa liên kết; trước đó báo cáo liệt kê nhầm cả bốn liên kết hợp lệ.
- Không phát hiện công trình trùng, nhân sự trùng sau chuẩn hóa, tên lỗi Unicode/khoảng trắng, tài khoản trùng họ tên hoặc tài khoản còn mật khẩu demo.
- Không có phân công ACTIVE trùng, quyền tùy chỉnh mồ côi, tài khoản bị khóa còn phân công hoặc phân công ACTIVE ngoài thời hạn.
- Bốn nhân sự có tài khoản tại công trình 001/002 đều liên kết đúng khóa tài khoản; quyền tùy chỉnh hiện có gắn đúng phân công.
- Điểm cần quản trị xác nhận khi nghiệm thu: công trình `003 - Công trình C` chưa có tài khoản nghiệp vụ đang hoạt động; tài khoản `nam` (vai trò TVGS_LEAD) đang hoạt động nhưng chưa được giao công trình nào. Không tự động gán hai đối tượng này vì chưa có căn cứ nghiệp vụ xác nhận họ thuộc về nhau.

## Kiểm tra biên mạng và bảo mật triển khai

- Môi trường đang chạy `production`; không còn tài khoản demo hoạt động và health không có cảnh báo khóa JWT.
- PostgreSQL `5433`, backend `3002` và frontend phụ `8081` đều chỉ lắng nghe trên `127.0.0.1`, không mở trực tiếp ra mạng LAN/Internet.
- Tailscale Serve ở chế độ `tailnet only`, chỉ chuyển tiếp HTTPS riêng tới `http://127.0.0.1:3002`; Funnel không được bật.
- Qua HTTPS Tailscale, máy chủ có các tiêu đề `X-Content-Type-Options: nosniff`, `X-Frame-Options: SAMEORIGIN`, `Referrer-Policy: same-origin` và không lộ `X-Powered-By`.
- Các đường dẫn nhạy cảm `/backend/.env`, `/backend/package.json`, `/backups/test.dump` và `/.git/config` đều trả 404.
- Yêu cầu CORS từ nguồn lạ không nhận `Access-Control-Allow-Origin`; nguồn cục bộ đã cấu hình `http://localhost:8081` được chấp nhận đúng dự kiến.

## Kiểm tra PWA khi mất kết nối

- Mở ứng dụng bằng Chrome qua cả địa chỉ cục bộ và HTTPS Tailscale, chờ service worker kiểm soát trang rồi chuyển trình duyệt sang chế độ offline.
- Sau khi tải lại ngoại tuyến, tiêu đề, màn hình đăng nhập và toàn bộ vỏ JavaScript vẫn nạp được từ bộ nhớ đệm; ứng dụng không hiện trang trắng.
- Yêu cầu `/health` thất bại khi offline đúng thiết kế, chứng minh service worker không lưu đệm phản hồi máy chủ hoặc dữ liệu nghiệp vụ nhạy cảm.
- Bổ sung `backend/scripts/check-pwa.js` và lệnh `npm run test:pwa -- <url>` để lặp lại kiểm tra manifest, khả năng cài đặt, service worker và vỏ ngoại tuyến ở các lần phát hành sau.

## Chuẩn bị đóng gói cài đặt

- Sửa `run.bat` để giữ nguyên mã thoát của `start-dev.ps1`; công cụ cài đặt/tự khởi động sau này sẽ nhận đúng trạng thái thất bại thay vì báo thành công sau lệnh `pause`.
- Chạy lại `run.bat`: mã thoát 0, PostgreSQL healthy, backend build `2026-10-08.5`, không có migration chờ và cả frontend/backend sẵn sàng.
- Bổ sung `backend/.env.example` chỉ chứa tên biến và giá trị thay thế an toàn; không đưa `backend/.env`, mật khẩu, dữ liệu tải lên hoặc bản sao lưu vào gói phân phối.
- Phần máy khách đã có thể phân phối dưới dạng PWA. Chưa tạo installer máy chủ từ schema hiện tại vì `schema-VINA-PROD-01.sql` còn chứa seed dữ liệu thử; cần tách schema production và quy trình khởi tạo tài khoản quản trị trước để tránh phát hành gói cài có tài khoản demo.

## Gói cài một tệp cho máy tính người dùng

- Theo phương án chạy thử đã thống nhất, tạo `dist/release/VINA-Client-Setup-2026-10-08.5.exe` cho Windows 10/11.
- Bộ cài kiểm tra Edge; nếu thiếu Tailscale thì gọi đúng gói chính thức `Tailscale.Tailscale` qua Windows Package Manager, sau đó tạo biểu tượng VINA trên Desktop/Start Menu và mở địa chỉ HTTPS ở chế độ cửa sổ ứng dụng.
- Gỡ VINA qua **Settings → Apps** chỉ xóa biểu tượng và thành phần VINA, giữ Tailscale để không ảnh hưởng phần mềm khác.
- Chế độ `-ValidateOnly` đã xác nhận Edge, Tailscale và máy chủ HTTPS phản hồi 200 trên máy thử mà không tạo lối tắt hay thay đổi hệ thống.
- Gói EXE được giải nén kiểm chứng: `install-client.ps1`, `uninstall-client.ps1` và `app-icon.ico` khớp dấu SHA-256 với nguồn, 3/3 thành phần đạt.
- Tệp phát hành dài 180224 byte; SHA-256 `3732474FA391BF9FF70485E15C3EAD4A903516BC0B93D8166A49A83C0143BD23`.
- Bản thử nghiệm chưa ký Authenticode; Windows SmartScreen có thể yêu cầu xác nhận. Bản phát hành chính thức cần chứng thư ký mã của đơn vị.

## Chốt trạng thái lúc 07:50 ngày 30/09/2026

- PostgreSQL đang `healthy`, chỉ công bố tại `127.0.0.1:5433`; dữ liệu nguồn cũ không bị sửa hoặc xóa.
- Ứng dụng cục bộ và HTTPS riêng qua Tailscale đều trả health `OK`, kết nối cơ sở dữ liệu bình thường, build `2026-10-08.5`, không có migration chờ và không có cảnh báo.
- Tailscale Serve vẫn ở chế độ `tailnet only`, chuyển tiếp tới `http://127.0.0.1:3002`; ứng dụng không được mở công khai ra Internet.
- Kiểm thử hồi quy cuối: backend 41/41 ca đạt; giao diện desktop/mobile/PWA 19/19 ca đạt.
- Kiểm tra sẵn sàng production đạt: môi trường `production`, không có tài khoản demo hoạt động.
- Gói cài Windows phát hành tại `dist/release/VINA-Client-Setup-2026-10-08.5.exe`; dung lượng 180224 byte, SHA-256 khớp `3732474FA391BF9FF70485E15C3EAD4A903516BC0B93D8166A49A83C0143BD23`.

## Nội dung cần người dùng nghiệm thu trực tiếp

1. Xác nhận tài khoản nào được giao Công trình 003. Tài khoản `nam` hiện hoạt động nhưng chưa được giao công trình; hệ thống không tự gán khi chưa có căn cứ nghiệp vụ.
2. Đăng nhập tài khoản `duong` bằng mật khẩu tạm đã được cấp và hoàn thành yêu cầu đổi mật khẩu ngay lần đầu.
3. Cài gói EXE trên một máy Windows 10/11 sạch, đăng nhập Tailscale của đơn vị, rồi thử đăng nhập, mở công trình, tải tệp và đăng xuất. Gói đã được kiểm chứng cấu trúc và trên máy phát triển, nhưng chưa thể thay thế nghiệm thu trên máy độc lập.
4. Trên điện thoại thật, đăng nhập cùng mạng Tailscale, cài PWA từ trình duyệt và thử các thao tác hiện trường gồm xem công trình, ảnh và tệp. Kiểm thử tự động mobile/PWA đã đạt nhưng camera, quyền tệp và chất lượng mạng cần thử trên thiết bị thực tế.
5. Bản thử nghiệm Windows chưa ký số nên SmartScreen có thể hiện cảnh báo. Trước phát hành chính thức cần chứng thư ký mã của đơn vị.
6. Chưa đóng gói máy chủ thành một EXE vì schema hiện tại còn seed thử nghiệm. Chỉ thực hiện bước này sau khi tách schema production và quy trình khởi tạo tài khoản quản trị, nhằm tránh đưa tài khoản mẫu vào môi trường thật.

Kết luận: hệ thống đã sẵn sàng cho giai đoạn chạy thử có kiểm soát theo Phương án 1. Phần còn lại chủ yếu là nghiệm thu nghiệp vụ và thiết bị thật; không còn lỗi kiểm thử tự động hoặc lỗi health đã biết tại thời điểm chốt.

## Khắc phục thông báo ERR_NAME_NOT_RESOLVED trên máy khách

- Kiểm tra tại máy chủ xác nhận Tailscale đang chạy, tên `desktop-e9suj00.tailc548b7.ts.net` phân giải đúng về `100.123.127.12` và Tailscale Serve vẫn chuyển tiếp tới backend. Lỗi thuộc trạng thái kết nối/DNS Tailscale trên máy khách, không phải lỗi backend hay mất tên máy chủ.
- Bổ sung trình khởi chạy kiểm tra `/health` trước khi mở Edge. Nếu máy khách chưa kết nối, trình khởi chạy mở Tailscale và hiển thị hướng dẫn tiếng Việt thay cho trang lỗi DNS của trình duyệt.
- Tạo gói sửa `dist/release/VINA-Client-Setup-2026-10-08.6.exe`. Giải nén kiểm chứng 4/4 thành phần khớp nguồn; SHA-256 `C343591F64B2CD7555BB8CF6389596726C46B7E037BE1FC829E7F1ED4295E477`.

## Khắc phục đầy bộ nhớ khi tải tài liệu và ảnh hiện trường

- Đo tại thời điểm xử lý: ổ `D:` còn khoảng 132 GB; cơ sở dữ liệu khoảng 14 MB, gồm khoảng 1,3 MB tệp hồ sơ và 1,2 MB tệp tiến độ. Cảnh báo “bộ nhớ tài liệu đã đầy” xuất phát từ giới hạn `localStorage` của trình duyệt, không phải ổ máy chủ hết chỗ.
- Loại bỏ việc nhúng tệp hợp đồng, bảng tiến độ ban đầu, ảnh và tài liệu nhật ký mới vào `localStorage`. Tệp chờ khi mất mạng được giữ trong IndexedDB; dữ liệu nghiệp vụ cục bộ chỉ còn metadata nhỏ.
- Bổ sung chuyển đổi một lần cho tệp base64 của phiên bản cũ sang IndexedDB. Chỉ xóa chuỗi cũ sau khi IndexedDB xác nhận ghi thành công.
- Ảnh JPEG/PNG/WebP lớn được tối ưu trên thiết bị, cạnh dài tối đa khoảng 2560 px; nếu bản tối ưu không nhỏ hơn thì giữ tệp gốc. Giới hạn đầu vào ảnh 20 MB, ảnh sau tối ưu tối đa 8 MB; tài liệu công trình tối đa 25 MB/tệp.
- Thêm kho tệp hợp đồng công trình tập trung trong `backend/uploads`, metadata ở bảng `project_files`, chống trùng bằng SHA-256 và kiểm soát tải xuống theo quyền công trình.
- Ảnh nhật ký được gửi nhị phân trực tiếp, không còn tăng khoảng 33% do base64 khi truyền/lưu tạm. Nhật ký không được gửi duyệt, kể cả thao tác hàng loạt, khi còn ảnh hoặc tài liệu chờ đồng bộ.
- Bảng Đồng bộ Offline hiển thị riêng số bản ghi và số tệp/ảnh đang chờ trên thiết bị.
- Đã tạo bản sao lưu trước migration: `backups/vina-supervision-2026-09-30-0927-truoc-migration.dump` và gói ảnh tương ứng `-uploads.zip`; migration `20261009_project_files.sql` áp dụng thành công.
- Kết quả kiểm thử: backend 43/43 ca đạt; giao diện desktop/mobile/PWA 20/20 ca đạt; ca GD-15 xác nhận Blob nằm trong IndexedDB, không xuất hiện trong `localStorage`; health build `2026-10-09.1`, không có migration chờ.
