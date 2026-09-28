// Trả tệp người dùng tải lên một cách an toàn.
// Kiểu tệp (Content-Type) do trình duyệt người tải gửi lên nên KHÔNG đáng tin: nếu phát lại nguyên
// "text/html" hoặc "image/svg+xml", mở tệp sẽ chạy mã trong phiên đăng nhập của người xem (lấy token).
// Chỉ các kiểu dưới đây được hiển thị trực tiếp; mọi kiểu khác trả về dạng tải xuống nhị phân.
const INLINE_TYPES = {
  'application/pdf': /\.pdf$/i,
  'image/png': /\.png$/i,
  'image/jpeg': /\.jpe?g$/i,
  'image/webp': /\.webp$/i,
  'image/gif': /\.gif$/i
};

function safeType(type) {
  const t = String(type || '').split(';')[0].trim().toLowerCase();
  return INLINE_TYPES[t] ? t : 'application/octet-stream';
}

function sendStoredFile(res, { name, type, buffer }, download) {
  const t = safeType(type);
  const inline = !download && t !== 'application/octet-stream';
  res.setHeader('Content-Type', t);
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Content-Disposition', `${inline ? 'inline' : 'attachment'}; filename*=UTF-8''${encodeURIComponent(name || 'tai-lieu')}`);
  res.send(buffer);
}

module.exports = { safeType, sendStoredFile, INLINE_TYPES };
