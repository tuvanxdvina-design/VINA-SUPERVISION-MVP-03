---
name: vicoad-design
description: "Thiết kế module, database, API, phân quyền hoặc quy trình duyệt TVGS mới hoặc thay đổi lớn trong VINA Supervision."
---

# Thiết kế chức năng

Đọc [bối cảnh repo](../../references/project-context.md) khi cần thao tác trong dự án; chỉ đọc phần liên quan. Trả lời tiếng Việt, ngắn và đi thẳng vào việc.

Đối chiếu kiến trúc hiện có trước khi đề xuất công nghệ. Mô tả tác nhân, dữ liệu, trạng thái, quyền theo công trình và tiêu chí chấp nhận.
Thiết kế API theo Express routes/services với SQL pg hiện có, không tự đưa ORM hoặc framework frontend vào. Nêu lỗi trạng thái, audit, đồng bộ offline/idempotency và ảnh hưởng hồ sơ đã khóa khi liên quan.
Schema thực = schema gốc + migrations; migration mới cần transaction, khả năng chạy lại, tác động dữ liệu và hướng khôi phục. Chỉ thiết kế/tạo tệp theo phạm vi; không áp dụng lên DB thật.
Với nghiệp vụ nhật ký/nghiệm thu/báo cáo, đọc thêm vicoad-tvgs. Ưu tiên bước triển khai nhỏ có kiểm chứng; không tự nhận đã đổi model.
