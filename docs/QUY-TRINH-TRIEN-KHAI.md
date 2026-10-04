# Quy trình xem xét, triển khai và kiểm soát thay đổi

Áp dụng bắt buộc cho mọi thay đổi của VINA-SUPERVISION từ ngày 01/10/2026.

## 1. Nguyên tắc

1. Không sửa khi chưa xác định được vấn đề, người dùng bị ảnh hưởng và kết quả cần đạt.
2. Khoanh vùng nhỏ nhất có thể; không kết hợp refactor hoặc thay đổi không liên quan.
3. Xem xét vấn đề từ nghiệp vụ, dữ liệu, phân quyền, bảo mật, desktop, mobile, ngoại tuyến, vận hành và khôi phục.
4. Với thay đổi có nhiều cách làm, phải so sánh tối thiểu hai phương án khả thi. Không chọn chỉ vì triển khai nhanh.
5. Dữ liệu tập trung và khả năng khôi phục quan trọng hơn tiện lợi ngắn hạn.
6. Giao diện chỉ ẩn/hiện để hỗ trợ người dùng; API và cơ sở dữ liệu luôn là lớp kiểm soát quyền cuối cùng.
7. Không đưa vào bản chạy khi kiểm thử liên quan chưa đạt hoặc còn lỗi chưa phân loại.

## 2. Hồ sơ quyết định trước triển khai

Mỗi hạng mục phải trả lời đủ các câu hỏi sau:

| Nhóm | Nội dung bắt buộc |
|---|---|
| Vấn đề | Hiện tượng, điều kiện tái hiện, bằng chứng và phạm vi ảnh hưởng |
| Mục tiêu | Hành vi đúng sau thay đổi; tiêu chí đo được |
| Dữ liệu | Bảng/tệp bị tác động; nguy cơ mất, trùng, sai liên kết hoặc không đồng bộ |
| Người dùng | Vai trò và công trình nào bị ảnh hưởng; quyền nào phải được cho phép hoặc từ chối |
| Phương án | Ít nhất hai cách làm, kể cả giữ nguyên nếu hợp lý |
| Lựa chọn | Lý do chọn; điểm mạnh, giới hạn và chi phí vận hành |
| Phục hồi | Có cần sao lưu/migration không; cách quay về trạng thái trước |
| Kiểm thử | Ca đơn vị, tích hợp, giao diện, mobile, ngoại tuyến và nghiệm thu thủ công cần chạy |

## 3. Tiêu chí lựa chọn phương án

Chấm từng phương án theo thang 1-5. Không lựa chọn nếu có tiêu chí an toàn dữ liệu hoặc phân quyền dưới 3.

| Tiêu chí | Trọng số |
|---|---:|
| Đúng nghiệp vụ và dễ giải thích | 25% |
| An toàn, toàn vẹn và khả năng khôi phục dữ liệu | 25% |
| Phân quyền và bảo mật | 20% |
| Dễ sử dụng trên desktop/mobile | 15% |
| Hoạt động khi mạng yếu hoặc ngoại tuyến | 5% |
| Dễ bảo trì và kiểm thử | 5% |
| Chi phí tài nguyên, triển khai và vận hành | 5% |

Nếu hai phương án có điểm gần nhau, ưu tiên phương án ít thay đổi cấu trúc dữ liệu hơn và phù hợp mẫu thiết kế hiện có hơn.

## 4. Các cổng triển khai

### Cổng A - Xác nhận phạm vi

- Tái hiện được vấn đề hoặc có yêu cầu nghiệp vụ đủ rõ.
- Xác định tệp, API, bảng dữ liệu và vai trò liên quan.
- Kiểm tra thay đổi chưa bị hạng mục khác giải quyết hoặc mâu thuẫn.

### Cổng B - Chọn phương án

- So sánh phương án bằng tiêu chí ở mục 3.
- Ghi rõ giả định và vấn đề chưa biết.
- Nếu vấn đề chưa rõ và lựa chọn có thể làm sai dữ liệu/nghiệp vụ, dừng để hỏi người dùng.

### Cổng C - Bảo vệ dữ liệu

- Thay đổi schema hoặc dữ liệu thật: sao lưu CSDL và thư mục tệp trước migration.
- Kiểm tra bản sao lưu tồn tại, có dung lượng hợp lý và công cụ khôi phục đọc được.
- Migration phải chạy lặp lại an toàn hoặc có cơ chế phát hiện đã áp dụng.

### Cổng D - Triển khai từng phần

- Sửa theo phạm vi nhỏ, mỗi bước có thể kiểm tra độc lập.
- Kiểm tra cú pháp và kiểm thử gần phần vừa sửa trước.
- Khi ca gần thất bại, khoanh đúng phần đó; không mở rộng sửa sang vùng khác để thử vận may.

### Cổng E - Kiểm thử tổng thể

- Backend regression trên CSDL thử riêng.
- Giao diện theo đủ vai trò trong `TEST-MATRIX-ROLES.md`.
- Desktop, mobile dọc, mobile ngang và PWA.
- API phải từ chối thao tác trái quyền ngay cả khi gọi trực tiếp.
- Kiểm tra health, phiên bản frontend/backend và migration chờ.

### Cổng F - Đưa vào bản chạy

- Tăng phiên bản backend, frontend và service-worker cache đồng bộ.
- Khởi động lại bằng tập lệnh chuẩn; không xóa container hoặc dữ liệu nguồn khác.
- Kiểm tra giao diện thật đang phục vụ đúng mã mới, không chỉ kiểm tra tệp nguồn.
- Kiểm tra Tailscale vẫn ở `tailnet only`, không dùng Funnel.

### Cổng G - Hậu kiểm

- Ghi kết quả, bản sao lưu, kiểm thử và vấn đề còn lại vào `STABILITY-REPORT.md`.
- Theo dõi lỗi mới, tốc độ, dung lượng và hàng đợi ngoại tuyến.
- Nếu phát hiện sai dữ liệu, dừng triển khai tiếp, bảo toàn bằng chứng và dùng điểm khôi phục.

## 5. Điều kiện bắt buộc phải dừng

1. Chưa hiểu rõ quy tắc nghiệp vụ và các phương án có thể tạo kết quả dữ liệu khác nhau.
2. Không xác định được cơ sở dữ liệu/container/tệp nguồn nào đang bị tác động.
3. Không tạo hoặc không kiểm tra được điểm khôi phục khi thay đổi có rủi ro dữ liệu.
4. Backend, phân quyền hoặc kiểm thử hồi quy liên quan thất bại.
5. Frontend/backend lệch phiên bản hoặc còn migration chờ.
6. Thay đổi vô tình mở dịch vụ ra Internet công cộng.

## 6. Mẫu báo cáo mỗi hạng mục

```text
Hạng mục:
Vấn đề và bằng chứng:
Phạm vi:
Phương án A:
Phương án B:
Phương án được chọn và lý do:
Rủi ro dữ liệu/phân quyền:
Điểm khôi phục:
Kiểm thử từng phần:
Kiểm thử tổng thể:
Kết quả triển khai:
Việc cần nghiệm thu trực tiếp:
```

## 7. Tài liệu kiểm soát liên quan

- `docs/TEST-MATRIX-ROLES.md`: ma trận vai trò và các tình huống nghiệm thu.
- `STABILITY-REPORT.md`: lịch sử thay đổi, kiểm thử, bản sao lưu và trạng thái triển khai.
- `DEPLOY-MULTISITE.md`: triển khai nội bộ qua Tailscale và cài đặt trên thiết bị.

