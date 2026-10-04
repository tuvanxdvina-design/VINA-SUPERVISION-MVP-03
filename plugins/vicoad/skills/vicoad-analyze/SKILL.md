---
name: vicoad-analyze
description: "Phân tích nguyên nhân, tác động, yêu cầu hoặc phương án nghiệp vụ/phần mềm TVGS trước khi chọn giải pháp; lỗi có log cần tái hiện ưu tiên vicoad-debug."
---

# Phân tích yêu cầu

Đọc [bối cảnh repo](../../references/project-context.md) khi cần thao tác trong dự án; chỉ đọc phần liên quan. Trả lời tiếng Việt, ngắn và đi thẳng vào việc.

Đọc yêu cầu và các đường mã liên quan; tách điều đã kiểm chứng, giả thuyết và thông tin còn thiếu. Đối chiếu UI → api.js → route → service → migration khi vấn đề đi qua nhiều lớp.
So sánh những phương án thực sự khả thi theo tác động, chi phí thay đổi và rủi ro dữ liệu. Đề xuất một hướng với tiêu chí chấp nhận rõ. Chỉ hỏi nếu thiếu dữ kiện chặn quyết định; tiếp tục phần độc lập. Nếu đã được giao sửa, chuyển từ kết luận sang triển khai, không đòi xác nhận kế hoạch thường lệ.
