# VICOAD cho VINA Supervision

Trả lời tiếng Việt, hành động trong phạm vi người dùng giao; chỉ hỏi khi thiếu thông tin chặn triển khai hoặc cần quyết định quan trọng. Giữ thay đổi có sẵn. Hướng dẫn này bổ sung quy ước kỹ thuật tại CLAUDE.md và docs/CODEMAP.md; yêu cầu người dùng hiện tại có ưu tiên với thỏa thuận công cụ cũ.

## Định tuyến yêu cầu

Chọn và đọc SKILL.md phù hợp dưới plugins/vicoad/skills/ (đường dẫn tính từ repo), không nạp cả 7:

| Yêu cầu | Skill |
|---|---|
| Hỏi nhanh/giải thích ngắn | vicoad-quick |
| Phân tích nguyên nhân, phương án, yêu cầu | vicoad-analyze |
| Lỗi/log/API/Docker/PostgreSQL | vicoad-debug |
| Thiết kế DB/API/quyền/module | vicoad-design |
| Thực hiện sửa code/migration/test | vicoad-implement |
| Review diff, hồi quy, bảo mật | vicoad-review |
| Nhật ký/nghiệm thu/báo cáo/hồ sơ TVGS | vicoad-tvgs |

Yêu cầu sửa lỗi: debug rồi implement. Kết hợp tvgs với design/implement nếu cần; đừng kết thúc ở kế hoạch khi người dùng đã giao triển khai. Các tên $vicoad-* là cách gọi tắt trong yêu cầu; nếu plugin chưa cài, đọc file tương ứng trực tiếp theo bảng trên. Đây là routing bằng hướng dẫn, không tự đổi model.

Không chạy run.bat/start-dev.ps1/migrate-db.ps1 để kiểm tra plugin. Không thay production/DB thật hoặc restart backend đang dùng khi chưa thuộc phạm vi. Plugin/tài liệu thuần không đổi build runtime và không cần bộ test DB. Chi tiết: plugins/vicoad/references/project-context.md.

## Làm việc theo gói

Trước khi tìm kiếm toàn repo, đọc `docs/CURRENT-STATE.md` và chọn đúng một gói trong `docs/WORK-PACKAGES.md`. Chỉ mở các tệp và chạy nhóm test thuộc gói đó; mở rộng sang gói khác khi đã chứng minh có liên kết. Cuối phiên cập nhật `docs/CURRENT-STATE.md` bằng kết quả, việc còn lại và lệnh kiểm tra đã chạy. Không chép lại lịch sử dài từ `STABILITY-REPORT.md` vào trao đổi.
