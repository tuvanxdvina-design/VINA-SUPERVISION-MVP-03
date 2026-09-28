const pool = require('../utils/db');
const { randomUUID, createHash } = require('crypto');
const { lastReviewSql } = require('./reviewService');

class DailyLogService {
  // GET all daily logs for a project
  async getDailyLogsByProject(projectId, filters = {}) {
    let query = `
      SELECT dl.*, TO_CHAR(dl.log_date, 'YYYY-MM-DD') AS log_date_text,
             (SELECT COUNT(*)::int FROM attachments a WHERE a.daily_log_id = dl.id) AS photo_count,
             (SELECT COUNT(*)::int FROM daily_log_files f WHERE f.daily_log_id = dl.id) AS file_count,
             ${lastReviewSql('daily_logs', 'dl')} AS last_review,
             COALESCE(dl.author_name, u.full_name) as created_by_name, a.full_name as approved_by_name,
             ($3::boolean OR (dl.status = 'DRAFT' AND ((dl.created_by = $2 AND $4::boolean) OR $5::boolean))) AS can_edit
      FROM daily_logs dl
      LEFT JOIN users u ON dl.created_by = u.id
      LEFT JOIN users a ON dl.approved_by = a.id
      WHERE dl.project_id = $1
    `;
    const p = filters.permissions || { role: '', permissions: [] };
    const params = [projectId, filters.userId, ['ADMIN', 'DIRECTOR'].includes(p.role),
      p.permissions.includes('CREATE'), p.permissions.includes('EDIT')];

    if (filters.status) {
      query += ` AND dl.status = $${params.length + 1}`;
      params.push(filters.status);
    }
    if (filters.log_date) {
      query += ` AND dl.log_date = $${params.length + 1}`;
      params.push(filters.log_date);
    }

    query += ` ORDER BY dl.log_date DESC, dl.shift ASC`;
    const result = await pool.query(query, params);
    return result.rows;
  }

  // GET single daily log
  async getDailyLogById(id) {
    const result = await pool.query(`
      SELECT dl.*, TO_CHAR(dl.log_date, 'YYYY-MM-DD') AS log_date_text,
             (SELECT COUNT(*)::int FROM attachments a WHERE a.daily_log_id = dl.id) AS photo_count,
             COALESCE(dl.author_name, u.full_name) as created_by_name, a.full_name as approved_by_name
      FROM daily_logs dl
      LEFT JOIN users u ON dl.created_by = u.id
      LEFT JOIN users a ON dl.approved_by = a.id
      WHERE dl.id = $1
    `, [id]);
    return result.rows[0];
  }

  // CREATE daily log (DRAFT)
  async createDailyLog(data) {
    const { project_id, log_date, shift, work_summary, weather, worker_count, machine_count, progress, note, created_by } = data;
    const logId = data.id || randomUUID();
    const shiftCode = String(shift || 'CA1').trim().toUpperCase().slice(0, 20) || 'CA1';
    const result = await pool.query(`
      INSERT INTO daily_logs (id, project_id, log_date, shift, work_summary, weather, worker_count, machine_count, progress, note, status, created_by, created_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'DRAFT', $11, NOW())
      ON CONFLICT (id) DO NOTHING
      RETURNING *, TO_CHAR(log_date, 'YYYY-MM-DD') AS log_date_text
    `, [logId, project_id, log_date, shiftCode, work_summary, weather, worker_count, machine_count, progress, note, created_by]);
    if (result.rows[0]) return { log: result.rows[0], created: true };
    return { log: await this.getDailyLogById(logId), created: false };
  }

  // UPDATE daily log (DRAFT â†’ SUBMITTED)
  async submitDailyLog(id, created_by) {
    const result = await pool.query(`
      UPDATE daily_logs
      SET status = 'SUBMITTED', submitted_at = NOW(), version = version + 1
      WHERE id = $1 AND status = 'DRAFT'
      RETURNING *, TO_CHAR(log_date, 'YYYY-MM-DD') AS log_date_text
    `, [id]);
    return result.rows[0];
  }

  // APPROVE daily log (SUBMITTED â†’ APPROVED)
  async approveDailyLog(id, approved_by) {
    const result = await pool.query(`
      UPDATE daily_logs
      SET status = 'APPROVED', approved_by = $1, approved_at = NOW()
      WHERE id = $2 AND status = 'SUBMITTED'
      RETURNING *, TO_CHAR(log_date, 'YYYY-MM-DD') AS log_date_text
    `, [approved_by, id]);
    return result.rows[0];
  }

  // REJECT daily log (SUBMITTED â†’ DRAFT)
  async rejectDailyLog(id) {
    const result = await pool.query(`
      UPDATE daily_logs
      SET status = 'DRAFT', submitted_at = NULL, approved_at = NULL, approved_by = NULL
      WHERE id = $1 AND status = 'SUBMITTED'
      RETURNING *, TO_CHAR(log_date, 'YYYY-MM-DD') AS log_date_text
    `, [id]);
    return result.rows[0];
  }

  // LOCK daily log (APPROVED â†’ LOCKED)
  async lockDailyLog(id) {
    const result = await pool.query(`
      UPDATE daily_logs
      SET status = 'LOCKED', locked_at = NOW()
      WHERE id = $1 AND status = 'APPROVED'
      RETURNING *, TO_CHAR(log_date, 'YYYY-MM-DD') AS log_date_text
    `, [id]);
    return result.rows[0];
  }

  // UPDATE draft daily log (chá»‰ khi DRAFT)
  // Quy tắc sửa: ADMIN/GIÁM ĐỐC (giữ như cũ); hoặc bản DRAFT do mình lập (cần quyền Thêm);
  // hoặc bản DRAFT của người khác khi có quyền Sửa tại công trình.
  async updateDailyLog(id, data, actorId, perms = { role: '', permissions: [] }) {
    const { work_summary, weather, worker_count, machine_count, progress, note } = data;
    const shiftCode = data.shift ? String(data.shift).trim().toUpperCase().slice(0, 20) : null;
    const result = await pool.query(`
      UPDATE daily_logs
      SET work_summary = COALESCE($1, work_summary),
          shift = COALESCE($12, shift),
          weather = COALESCE($2, weather),
          worker_count = COALESCE($3, worker_count),
          machine_count = COALESCE($4, machine_count),
          progress = COALESCE($5, progress),
          note = COALESCE($6, note),
          version = version + 1,
          updated_at = NOW()
      WHERE id = $7 AND ($9::boolean OR (status = 'DRAFT' AND ((created_by = $8 AND $10::boolean) OR $11::boolean)))
       RETURNING *, TO_CHAR(log_date, 'YYYY-MM-DD') AS log_date_text
    `, [work_summary, weather, worker_count, machine_count, progress, note, id, actorId,
        ['ADMIN', 'DIRECTOR'].includes(perms.role), perms.permissions.includes('CREATE'), perms.permissions.includes('EDIT'), shiftCode]);
    return result.rows[0];
  }

  // DELETE daily log (chá»‰ khi DRAFT)
  async deleteDailyLog(id) {
    await pool.query(`DELETE FROM daily_logs WHERE id = $1 AND status = 'DRAFT'`, [id]);
  }

  async listFiles(logId) {
    return (await pool.query('SELECT id, file_name, file_type, file_size, uploaded_at FROM daily_log_files WHERE daily_log_id = $1 ORDER BY uploaded_at', [logId])).rows;
  }
  async addFile(logId, name, type, buffer, userId) {
    const sha = createHash('sha256').update(buffer).digest('hex');
    const r = await pool.query(`
      INSERT INTO daily_log_files (daily_log_id, file_name, file_type, file_size, sha256, content, uploaded_by)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      ON CONFLICT (daily_log_id, sha256) DO UPDATE SET file_name = EXCLUDED.file_name
      RETURNING id, file_name, file_type, file_size, uploaded_at, (xmax = 0) AS created`, [logId, name, type, buffer.length, sha, buffer, userId]);
    return r.rows[0];
  }
  async getFile(logId, fileId) {
    return (await pool.query('SELECT file_name, file_type, content FROM daily_log_files WHERE id = $1 AND daily_log_id = $2', [fileId, logId])).rows[0];
  }
}

module.exports = new DailyLogService();
