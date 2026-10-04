# Gói công việc VINA-SUPERVISION

Mỗi phiên chỉ chọn một gói chính. Đọc thêm gói liên quan khi lỗi đi qua ranh giới API/dữ liệu.

| Gói | Phạm vi | Tệp chính | Kiểm tra ưu tiên |
|---|---|---|---|
| P01 Nền tảng và đăng nhập | phiên, tài khoản, quyền, xung đột | `api.js`, `js/02-quyen.js`, `js/14-dang-nhap.js`, `backend/src/middleware`, `backend/src/routes/auth.js` | GD-01..04, GD-16, GD-20..22 |
| P02 Công trình và nhân sự | hồ sơ công trình, phân công, chứng chỉ | `js/03-cong-trinh.js`, `js/09-nhan-su.js`, routes/services project/personnel | GD-04, GD-11, GD-16 |
| P03 Báo cáo ngày và ngoại tuyến | biểu mẫu, ảnh, đồng bộ, duyệt cá nhân | `js/00-tep-ngoai-tuyen.js`, `js/05-nhat-ky.js`, `api.js`, dailyLog/attachment services | GD-06..09, GD-15, GD-19, GD-21..24 |
| P04 Hồ sơ và báo cáo tổng hợp | hồ sơ pháp lý, báo cáo kỳ, in/xuất | `js/06-ho-so.js`, `js/07-bao-cao.js`, document/report services | GD-10, regression báo cáo/hồ sơ |
| P05 Chất lượng | biên bản, thư kỹ thuật, chữ ký, chi tiết mẫu | `js/08-chat-luong.js`, issue routes/services | regression chất lượng, GD-16 |
| P06 Tiến độ và tổng quan | bảng tiến độ, cảnh báo, portfolio | `js/04-tien-do.js`, `js/13-tong-quan.js`, progress/portfolio services | GD-05, regression tiến độ |
| P07 Giao diện và PWA | responsive, menu, cache, cài mobile | `index.html`, `sw.js`, `manifest.webmanifest`, `js/15-cai-dat-ung-dung.js` | GD-13, GD-14, GD-17, `test:pwa` |
| P08 Vận hành và phát hành | chạy dịch vụ, migration, backup, bộ cài | `start-dev.ps1`, `migrate-db.ps1`, `packaging/`, `docker-compose.yml` | health, validate-only, SHA256 |

## Quy tắc phiên

1. Đọc `CURRENT-STATE.md`, chọn gói và ghi phạm vi một câu.
2. Tìm trong các tệp của gói trước; không quét `dist`, `backups`, `uploads`, `_archive`.
3. Chạy test ca lỗi trước, rồi test gói, cuối cùng toàn bộ khi chuẩn bị phát hành.
4. Chỉ tăng build khi thay mã chạy; migration phải sao lưu trước.
5. Kết thúc bằng cập nhật trạng thái ngắn, không tạo tài liệu trùng lặp.
