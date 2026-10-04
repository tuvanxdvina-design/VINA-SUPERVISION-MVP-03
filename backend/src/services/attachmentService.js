const pool = require('../utils/db');
const fs = require('fs/promises');
const path = require('path');
const { createHash } = require('crypto');

const uploadRoot = path.resolve(process.env.UPLOAD_DIR || path.join(__dirname, '..', '..', 'uploads'));
const formats = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };

async function list(logId) {
  const result = await pool.query(`
    SELECT id, file_name, file_type, file_size, uploaded_at
    FROM attachments WHERE daily_log_id = $1 ORDER BY uploaded_at, id
  `, [logId]);
  return result.rows;
}

async function get(logId, attachmentId) {
  const result = await pool.query(`
    SELECT id, file_name, file_type, file_size, file_hash
    FROM attachments WHERE daily_log_id = $1 AND id = $2
  `, [logId, attachmentId]);
  return result.rows[0];
}

async function saveBuffer(logId, userId, fileName, mime, bytes) {
  if (!formats[mime]) throw Object.assign(new Error('Chỉ nhận ảnh JPEG, PNG hoặc WebP'), { status: 400 });
  if (!bytes.length || bytes.length > 8 * 1024 * 1024) throw Object.assign(new Error('Ảnh không hợp lệ hoặc vượt 8 MB'), { status: 400 });
  const validMagic = mime === 'image/jpeg' && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff ||
    mime === 'image/png' && bytes.subarray(0, 8).equals(Buffer.from('89504e470d0a1a0a', 'hex')) ||
    mime === 'image/webp' && bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP';
  if (!validMagic) throw Object.assign(new Error('Nội dung ảnh không đúng định dạng'), { status: 400 });
  const log = await pool.query('SELECT status FROM daily_logs WHERE id = $1', [logId]);
  if (log.rows[0]?.status !== 'DRAFT') throw Object.assign(new Error('Chỉ thêm ảnh vào nhật ký DRAFT'), { status: 409 });
  const hash = createHash('sha256').update(bytes).digest('hex');
  const storedName = `${hash}.${formats[mime]}`;
  await fs.mkdir(uploadRoot, { recursive: true });
  try { await fs.writeFile(path.join(uploadRoot, storedName), bytes, { flag: 'wx' }); }
  catch (error) { if (error.code !== 'EEXIST') throw error; }
  const result = await pool.query(`
    INSERT INTO attachments (daily_log_id, file_name, file_type, file_size, file_url, file_hash, uploaded_by)
    VALUES ($1, $2, $3, $4, $5, $6, $7)
    ON CONFLICT (daily_log_id, file_hash) WHERE daily_log_id IS NOT NULL AND file_hash IS NOT NULL DO NOTHING
    RETURNING id, file_name, file_type, file_size, uploaded_at
  `, [logId, path.basename(fileName || 'anh-hien-truong').slice(0, 255), mime, bytes.length, storedName, hash, userId]);
  if (result.rows[0]) return { attachment: result.rows[0], created: true };
  const old = await pool.query('SELECT id, file_name, file_type, file_size, uploaded_at FROM attachments WHERE daily_log_id=$1 AND file_hash=$2', [logId, hash]);
  return { attachment: old.rows[0], created: false };
}

async function save(logId, userId, fileName, dataUrl) {
  const match = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/]+={0,2})$/.exec(dataUrl || '');
  if (!match || !formats[match[1]]) throw Object.assign(new Error('Chỉ nhận ảnh JPEG, PNG hoặc WebP'), { status: 400 });
  const bytes = Buffer.from(match[2], 'base64');
  if (!bytes.length || bytes.length > 5 * 1024 * 1024 || bytes.toString('base64') !== match[2]) {
    throw Object.assign(new Error('Ảnh không hợp lệ hoặc vượt 5 MB'), { status: 400 });
  }
  return saveBuffer(logId, userId, fileName, match[1], bytes);
}

async function content(logId, attachmentId) {
  const attachment = await get(logId, attachmentId);
  if (!attachment) return null;
  const ext = formats[attachment.file_type];
  if (!ext || !/^[0-9a-f]{64}$/.test(attachment.file_hash)) return null;
  const bytes = await fs.readFile(path.join(uploadRoot, `${attachment.file_hash}.${ext}`));
  return { ...attachment, data_url: `data:${attachment.file_type};base64,${bytes.toString('base64')}` };
}

module.exports = { list, save, saveBuffer, content };
