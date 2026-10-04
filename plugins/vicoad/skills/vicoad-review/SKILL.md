---
name: vicoad-review
description: "Rà soát diff, lỗi hồi quy, quyền truy cập, SQL và bảo mật của VINA Supervision; mặc định báo phát hiện, chỉ sửa khi được yêu cầu."
---

# Rà soát thay đổi

Đọc [bối cảnh repo](../../references/project-context.md) khi cần thao tác trong dự án; chỉ đọc phần liên quan. Trả lời tiếng Việt, ngắn và đi thẳng vào việc.

Đọc diff và mã gọi trực tiếp, ưu tiên lỗi có tình huống tái hiện. Kiểm tra phân quyền ở server theo project, đường truy cập chéo công trình, chuyển trạng thái và audit nếu nằm trong phạm vi.
Đối chiếu escape HTML bằng esc(), SQL tham số hóa, tệp tải lên qua fileSafety/sendStoredFile, token và dữ liệu offline. Với frontend kiểm tra script order/cache/build khi thay đổi có ảnh hưởng.
Mỗi phát hiện nêu mức độ, tệp/dòng, điều kiện xảy ra và tác động; phân biệt lỗi đã chứng minh với câu hỏi. Không đưa đề xuất phong cách thành lỗi nghiêm trọng. Nếu không thấy lỗi, nói rõ phạm vi đã đọc và test đã/chưa chạy. Chỉ sửa khi yêu cầu bao gồm sửa.
