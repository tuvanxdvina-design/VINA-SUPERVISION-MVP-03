# VICOAD Plugin v0.1

7 Skills hỗ trợ VINA Supervision, không cần API key hay dịch vụ nền. Tự chọn workflow qua mô tả skill khi đã cài plugin; tại repo, AGENTS.md định tuyến tới cùng các file nên có thể dùng ngay khi mở task ở đúng thư mục.

## Dùng hằng ngày

Mở repo có backend/, js/, migrations/ và AGENTS.md (không mở _archive-VINA-MVP-03). Viết yêu cầu tự nhiên hoặc dùng các câu mẫu:

- `$vicoad-quick Giải thích đoạn mã này.`
- `$vicoad-analyze Phân tích vì sao nhật ký chưa đồng bộ.`
- `$vicoad-debug Sửa lỗi API 500; đây là log đã che token.`
- `$vicoad-design Thiết kế nghiệm thu vật liệu đầu vào.`
- `$vicoad-implement Triển khai thay đổi theo yêu cầu sau…`
- `$vicoad-review Rà soát diff hiện tại, tập trung quyền công trình.`
- `$vicoad-tvgs Soạn báo cáo tuần từ các dữ kiện sau…`

Đây là lời gọi skill trong chat, không phải lệnh PowerShell hay slash command đã đăng ký. Khi chưa cài vào thư viện plugin, AGENTS.md đọc skill trực tiếp. Không cần cài toàn cục để dùng routing trong repo. Muốn xuất hiện trong thư viện plugin cần đăng ký marketplace/cài plugin riêng; v0.1 này chưa thay cấu hình cá nhân của Codex.

Skill tự chọn cách xử lý, không tự đổi model. Dùng mức suy luận vừa cho việc thường; chỉ tăng khi thiết kế quyền, migration phức tạp hoặc lỗi khó. Không hứa mức tiết kiệm cố định.

## Kiểm tra

Manifest: .codex-plugin/plugin.json; 7 thư mục skills/* với SKILL.md và agents/openai.yaml (allow_implicit_invocation: true). Tham chiếu dùng đường dẫn tương đối trong plugin để vẫn hoạt động nếu cài vào cache. Plugin không sửa DB hay dịch vụ chạy thật; thay đổi tài liệu/plugin không cần tăng build ứng dụng.
