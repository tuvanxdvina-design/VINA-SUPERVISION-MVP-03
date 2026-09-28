// Nhận diện bảng tiến độ từ các dòng (Excel hoặc dán từ Excel) → danh sách hạng mục có cấu trúc.
// Nguyên tắc: không đoán im lặng. Mọi dòng bị bỏ qua / nghi vấn đều có cảnh báo để người dùng xem trước khi lưu.

function norm(v) {
  return String(v ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D')
    .toLowerCase().replace(/\s+/g, ' ').trim();
}

const COLUMN_KEYS = {
  code: ['stt', 'tt', 'ma hieu', 'ma cv', 'ma', 'wbs', 'so tt'],
  name: ['hang muc', 'ten cong viec', 'cong viec', 'noi dung', 'ten hang muc', 'dau muc', 'task', 'name'],
  unit: ['don vi', 'dvt', 'unit'],
  quantity: ['khoi luong', 'kl', 'quantity'],
  weight: ['gia tri', 'thanh tien', 'ty trong', 'trong so', 'du toan', 'weight', 'value'],
  start: ['bat dau', 'ngay bd', 'tu ngay', 'ngay khoi cong', 'khoi cong', 'start'],
  end: ['ket thuc', 'ngay kt', 'den ngay', 'ngay hoan thanh', 'hoan thanh', 'finish', 'end'],
  duration: ['thoi gian', 'so ngay', 'thoi han', 'duration']
};

function matchColumn(header) {
  const h = norm(header);
  if (!h) return null;
  // Ưu tiên cụm dài để "ngay hoan thanh" không bị hiểu nhầm là cột khác
  let best = null;
  for (const [key, words] of Object.entries(COLUMN_KEYS)) {
    for (const w of words) {
      const hit = w.length <= 3 ? (h === w || h.startsWith(w + ' ') || h.startsWith(w + '.')) : h.includes(w);
      if (hit && (!best || w.length > best.len)) best = { key, len: w.length };
    }
  }
  return best?.key || null;
}

function detectHeader(rows) {
  for (let r = 0; r < Math.min(rows.length, 20); r++) {
    const map = {};
    (rows[r] || []).forEach((cell, c) => {
      const key = matchColumn(cell);
      if (key && map[key] === undefined) map[key] = c;
    });
    if (map.name !== undefined && (map.start !== undefined || map.end !== undefined)) return { row: r, map };
  }
  return null;
}

function pad(n) { return String(n).padStart(2, '0'); }
function iso(y, m, d) {
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) return null;
  return `${y}-${pad(m)}-${pad(d)}`;
}

function parseDate(v) {
  if (v === null || v === undefined || v === '') return null;
  if (typeof v === 'number' || /^\d{5}(\.\d+)?$/.test(String(v).trim())) {
    const n = Math.floor(Number(v));
    if (n > 20000 && n < 80000) {
      const dt = new Date(Date.UTC(1899, 11, 30) + n * 86400000);
      return dt.toISOString().slice(0, 10);
    }
    return null;
  }
  const s = String(v).trim();
  let m = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (m) return iso(+m[1], +m[2], +m[3]);
  m = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})$/);
  if (m) { let y = +m[3]; if (y < 100) y += 2000; return iso(y, +m[2], +m[1]); } // Việt Nam: ngày/tháng/năm
  return null;
}

function parseNumber(v) {
  if (v === null || v === undefined || v === '') return null;
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  let s = String(v).replace(/\s|%|đ|vnd|VNĐ/gi, '');
  if (!s) return null;
  const hasDot = s.includes('.'), hasComma = s.includes(',');
  if (hasDot && hasComma) {
    if (s.lastIndexOf(',') > s.lastIndexOf('.')) s = s.replace(/\./g, '').replace(',', '.');
    else s = s.replace(/,/g, '');
  } else if (hasDot) {
    if (/^\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, '');
  } else if (hasComma) {
    s = /^\d{1,3}(,\d{3})+$/.test(s) ? s.replace(/,/g, '') : s.replace(',', '.');
  }
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function addDays(isoDate, days) {
  const d = new Date(isoDate + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

const ROMAN = /^(?=[MDCLXVI])M*(C[MD]|D?C{0,3})(X[CL]|L?X{0,3})(I[XV]|V?I{0,3})\.?$/i;

function parseRows(rows) {
  const header = detectHeader(rows);
  if (!header) {
    return { ok: false, error: 'Không tìm thấy dòng tiêu đề. Bảng cần có cột "Hạng mục/Công việc" và cột "Bắt đầu" hoặc "Kết thúc" (xem tệp mẫu).', items: [], warnings: [] };
  }
  const { map } = header;
  const cell = (row, key) => (map[key] === undefined ? null : row[map[key]]);
  const raw = [];
  const warnings = [];
  for (let r = header.row + 1; r < rows.length; r++) {
    const row = rows[r] || [];
    const name = String(cell(row, 'name') ?? '').replace(/\s+/g, ' ').trim();
    if (!name) continue;
    const code = String(cell(row, 'code') ?? '').trim();
    let start = parseDate(cell(row, 'start'));
    let end = parseDate(cell(row, 'end'));
    const duration = parseNumber(cell(row, 'duration'));
    if (start && !end && duration > 0) end = addDays(start, Math.round(duration) - 1);
    if (!start && end && duration > 0) start = addDays(end, -(Math.round(duration) - 1));
    raw.push({
      line: r + 1, code, name,
      unit: String(cell(row, 'unit') ?? '').trim() || null,
      quantity: parseNumber(cell(row, 'quantity')),
      weight: parseNumber(cell(row, 'weight')),
      start_date: start, end_date: end,
      raw_start: cell(row, 'start'), raw_end: cell(row, 'end')
    });
  }
  const items = [];
  raw.forEach((it, i) => {
    const later = raw.slice(i + 1);
    const isGroup = (it.code && later.some(x => x.code && x.code.startsWith(it.code + '.'))) || ROMAN.test(it.code) ||
      /^(tong cong|tong|cong)\b/.test(norm(it.name));
    const problems = [];
    if (!it.start_date) problems.push(`ngày bắt đầu "${it.raw_start ?? ''}" không đọc được`);
    if (!it.end_date) problems.push(`ngày kết thúc "${it.raw_end ?? ''}" không đọc được`);
    if (it.start_date && it.end_date && it.end_date < it.start_date) problems.push('ngày kết thúc trước ngày bắt đầu');
    items.push({ ...it, include: !isGroup && problems.length === 0, is_group: isGroup, problems });
    if (isGroup) warnings.push(`Dòng ${it.line} "${it.name}": nhận là nhóm/tổng, không tính để tránh cộng trùng.`);
    else if (problems.length) warnings.push(`Dòng ${it.line} "${it.name}": ${problems.join('; ')} — chưa tính, sửa rồi đánh dấu tính.`);
  });
  const included = items.filter(i => i.include);
  const columns = Object.fromEntries(Object.entries(map).map(([k, c]) => [k, String(rows[header.row][c] ?? '')]));
  if (map.weight === undefined) warnings.push('Không có cột Giá trị/Tỷ trọng: tiến độ kế hoạch sẽ tính theo thời gian thực hiện từng hạng mục.');
  return { ok: included.length > 0, error: included.length ? null : 'Không có hạng mục hợp lệ để tính.', header_row: header.row + 1, columns, items, warnings };
}

function parseText(text) {
  const rows = String(text || '').replace(/\r/g, '').split('\n').map(line => line.split('\t'));
  return parseRows(rows);
}

module.exports = { parseRows, parseText, parseDate, parseNumber };
