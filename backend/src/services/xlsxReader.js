// Đọc tệp Excel .xlsx (không cần thư viện ngoài): trả về mảng các dòng của trang tính đầu tiên
// (hoặc trang có tên chỉ định). Mỗi ô là chuỗi, số hoặc null. Ngày trong Excel là số serial.
const zlib = require('zlib');
// Giới hạn dung lượng sau giải nén của mỗi phần trong tệp (chống "bom nén" làm treo máy chủ).
const MAX_PART = 60 * 1024 * 1024;

function unzip(buffer) {
  // Tìm End Of Central Directory
  let eocd = -1;
  for (let i = buffer.length - 22; i >= Math.max(0, buffer.length - 65557); i--) {
    if (buffer.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error('Tệp không phải định dạng .xlsx hợp lệ');
  const count = buffer.readUInt16LE(eocd + 10);
  let ptr = buffer.readUInt32LE(eocd + 16);
  const files = {};
  for (let n = 0; n < count; n++) {
    if (buffer.readUInt32LE(ptr) !== 0x02014b50) break;
    const method = buffer.readUInt16LE(ptr + 10);
    const compSize = buffer.readUInt32LE(ptr + 20);
    const nameLen = buffer.readUInt16LE(ptr + 28);
    const extraLen = buffer.readUInt16LE(ptr + 30);
    const commentLen = buffer.readUInt16LE(ptr + 32);
    const localOffset = buffer.readUInt32LE(ptr + 42);
    const name = buffer.slice(ptr + 46, ptr + 46 + nameLen).toString('utf8');
    const lNameLen = buffer.readUInt16LE(localOffset + 26);
    const lExtraLen = buffer.readUInt16LE(localOffset + 28);
    const start = localOffset + 30 + lNameLen + lExtraLen;
    const data = buffer.slice(start, start + compSize);
    files[name] = () => {
      try { return (method === 0 ? data : zlib.inflateRawSync(data, { maxOutputLength: MAX_PART })).toString('utf8'); }
      catch (e) { throw new Error(e.code === 'ERR_BUFFER_TOO_LARGE' || e.code === 'ERR_OUT_OF_RANGE' ? 'Tệp Excel quá lớn sau giải nén (tối đa 60 MB mỗi trang)' : 'Tệp .xlsx bị hỏng'); }
    };
    ptr += 46 + nameLen + extraLen + commentLen;
  }
  return files;
}

function decode(s) {
  return String(s)
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(+d))
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&amp;/g, '&');
}

function textOf(xml) {
  const parts = [];
  xml.replace(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g, (_, t) => parts.push(decode(t)));
  return parts.join('');
}

function colIndex(ref) {
  const letters = String(ref).replace(/\d+/g, '');
  let n = 0;
  for (const ch of letters) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1;
}

function readXlsx(buffer, sheetName) {
  const files = unzip(buffer);
  const shared = [];
  if (files['xl/sharedStrings.xml']) {
    files['xl/sharedStrings.xml']().replace(/<si>([\s\S]*?)<\/si>/g, (_, si) => shared.push(textOf(si)));
  }
  let sheetPath = 'xl/worksheets/sheet1.xml';
  const sheets = [];
  if (files['xl/workbook.xml'] && files['xl/_rels/workbook.xml.rels']) {
    const rels = {};
    files['xl/_rels/workbook.xml.rels']().replace(/<Relationship\b([^>]*)\/?>/g, (_, attrs) => {
      const id = (attrs.match(/Id="([^"]+)"/) || [])[1];
      const target = (attrs.match(/Target="([^"]+)"/) || [])[1];
      if (id && target) rels[id] = target.replace(/^\/?(xl\/)?/, 'xl/');
    });
    files['xl/workbook.xml']().replace(/<sheet\b([^>]*)\/?>/g, (_, attrs) => {
      const name = decode((attrs.match(/name="([^"]*)"/) || [])[1] || '');
      const rid = (attrs.match(/r:id="([^"]+)"/) || [])[1];
      if (rels[rid]) sheets.push({ name, path: rels[rid] });
    });
    const chosen = (sheetName && sheets.find(s => s.name === sheetName)) || sheets[0];
    if (chosen) sheetPath = chosen.path;
  }
  if (!files[sheetPath]) throw new Error('Không tìm thấy trang tính trong tệp Excel');
  const xml = files[sheetPath]();
  const rows = [];
  xml.replace(/<row\b([^>]*)>([\s\S]*?)<\/row>/g, (_, rowAttrs, body) => {
    const r = +((rowAttrs.match(/\br="(\d+)"/) || [])[1] || rows.length + 1);
    const cells = [];
    body.replace(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g, (m, attrs, inner = '') => {
      const ref = (attrs.match(/\br="([A-Z]+\d+)"/) || [])[1];
      const type = (attrs.match(/\bt="([^"]+)"/) || [])[1] || 'n';
      const v = (inner.match(/<v>([\s\S]*?)<\/v>/) || [])[1];
      let value = null;
      if (type === 's') value = v !== undefined ? shared[+v] ?? '' : '';
      else if (type === 'inlineStr') value = textOf(inner);
      else if (type === 'str') value = v !== undefined ? decode(v) : '';
      else if (type === 'b') value = v === '1';
      else if (v !== undefined && v !== '') value = Number(v);
      const idx = ref ? colIndex(ref) : cells.length;
      cells[idx] = value;
      return m;
    });
    rows[r - 1] = Array.from(cells, c => (c === undefined ? null : c));
  });
  return { sheets: sheets.map(s => s.name), rows: Array.from(rows, r => r || []) };
}

module.exports = { readXlsx };
