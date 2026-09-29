// Cắt một đoạn JavaScript thành các "đơn vị top-level" (khai báo hàm/biến/lớp hoặc câu lệnh
// ở mức ngoài cùng). Dùng cho check-split.js và cho việc di chuyển mã giữa các file.
// Bất biến: splitTopLevel(src).join('') === src. Nếu lệch là bộ quét đọc sai, phải ném lỗi ngay
// thay vì trả về kết quả sai lặng lẽ.

// Quét ký tự, bỏ qua nội dung chuỗi/template/regex/chú thích, đếm độ sâu ngoặc.
function splitTopLevel(src) {
  const out = [];
  let start = 0, i = 0, depth = 0;
  let prevSignificant = ''; // ký tự có nghĩa gần nhất, để đoán '/' là regex hay phép chia
  const n = src.length;
  while (i < n) {
    const c = src[i];
    if (c === '/' && src[i + 1] === '/') { const j = src.indexOf('\n', i); i = j < 0 ? n : j; continue; }
    if (c === '/' && src[i + 1] === '*') { const j = src.indexOf('*/', i + 2); i = j < 0 ? n : j + 2; continue; }
    if (c === '"' || c === "'") { i = skipQuoted(src, i, c); prevSignificant = c; continue; }
    if (c === '`') { i = skipTemplate(src, i); prevSignificant = '`'; continue; }
    if (c === '/' && regexAllowedAfter(prevSignificant)) {
      const j = skipRegex(src, i);
      if (j > i) { i = j; prevSignificant = '/'; continue; }
    }
    if (c === '{' || c === '(' || c === '[') { depth++; prevSignificant = c; i++; continue; }
    if (c === '}' || c === ')' || c === ']') { depth--; prevSignificant = c; i++; continue; }
    if (depth === 0 && c === '\n') {
      // Kết thúc đơn vị khi phần đã đọc trông như một câu lệnh hoàn chỉnh và phần còn lại
      // bắt đầu bằng một khai báo/câu lệnh mới.
      const daDoc = src.slice(start, i + 1).trimEnd();
      const ketThucSach = daDoc === '' || /[;}]$/.test(daDoc) || /^\s*\/\//.test(daDoc) || /\*\/$/.test(daDoc);
      const rest = src.slice(i + 1);
      const batDauMoi = /^\s*(?:\/\/|\/\*|(?:async\s+)?function\b|const\b|let\b|var\b|class\b|window\.|document\.|self\.|if\b|for\b|try\b|void\b|[A-Za-z_$][\w$.]*\s*=|[A-Za-z_$][\w$.]*\s*\()/.test(rest);
      if (ketThucSach && batDauMoi && daDoc !== '') {
        out.push(src.slice(start, i + 1));
        start = i + 1;
      }
      i++; continue;
    }
    if (!/\s/.test(c)) prevSignificant = c;
    i++;
  }
  if (start < n) out.push(src.slice(start));
  const joined = out.join('');
  if (joined !== src) throw new Error('splitTopLevel: nối lại không bằng đầu vào (bộ quét đọc sai)');
  return out;
}

function skipQuoted(src, i, q) {
  i++;
  while (i < src.length) {
    if (src[i] === '\\') { i += 2; continue; }
    if (src[i] === q) return i + 1;
    i++;
  }
  return i;
}

function skipTemplate(src, i) {
  i++;
  while (i < src.length) {
    if (src[i] === '\\') { i += 2; continue; }
    if (src[i] === '`') return i + 1;
    if (src[i] === '$' && src[i + 1] === '{') {
      let d = 1; i += 2;
      while (i < src.length && d > 0) {
        if (src[i] === '\\') { i += 2; continue; }
        if (src[i] === '`') { i = skipTemplate(src, i); continue; }
        if (src[i] === '"' || src[i] === "'") { i = skipQuoted(src, i, src[i]); continue; }
        if (src[i] === '{') d++;
        if (src[i] === '}') d--;
        i++;
      }
      continue;
    }
    i++;
  }
  return i;
}

// '/' mở regex khi ký tự có nghĩa trước đó không thể kết thúc một biểu thức.
function regexAllowedAfter(prev) {
  if (!prev) return true;
  return !/[\w$)\]`'"]/.test(prev);
}

function skipRegex(src, i) {
  let j = i + 1, inClass = false;
  while (j < src.length) {
    const c = src[j];
    if (c === '\\') { j += 2; continue; }
    if (c === '\n') return i; // không phải regex
    if (c === '[') inClass = true;
    else if (c === ']') inClass = false;
    else if (c === '/' && !inClass) { j++; while (j < src.length && /[a-z]/.test(src[j])) j++; return j; }
    j++;
  }
  return i;
}

function unitName(unit) {
  const s = unit.trim();
  let m = s.match(/^(?:async\s+)?function\s+([A-Za-z_$][\w$]*)/);
  if (m) return m[1];
  m = s.match(/^(?:const|let|var)\s+([A-Za-z_$][\w$]*)/);
  if (m) return m[1];
  m = s.match(/^class\s+([A-Za-z_$][\w$]*)/);
  if (m) return m[1];
  m = s.match(/^([A-Za-z_$][\w$.]*)\s*=\s*(?:async\s+)?function/);
  if (m) return m[1];
  return s.replace(/\s+/g, ' ').slice(0, 40);
}

module.exports = { splitTopLevel, unitName };
