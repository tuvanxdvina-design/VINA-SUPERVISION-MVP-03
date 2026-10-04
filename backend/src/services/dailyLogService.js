const pool = require('../utils/db');
const { randomUUID, createHash } = require('crypto');
const { lastReviewSql } = require('./reviewService');

function normalizeResources(value) {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 100).map(row => ({
    type: String(row?.type || '').trim().slice(0, 255),
    count: Math.max(0, Math.floor(Number(row?.count) || 0))
  })).filter(row => row.type || row.count);
}
const resourceTotal = rows => rows.reduce((sum, row) => sum + row.count, 0);

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
    const { project_id, log_date, shift, contractor_unit, work_item, technical_staff_count, workforce_details, machine_details, work_summary, weather, worker_count, machine_count, progress, note, recommendation, created_by } = data;
    const logId = data.id || randomUUID();
    const shiftCode = String(shift || 'CA1').trim().toUpperCase().slice(0, 20) || 'CA1';
    const workforce = normalizeResources(workforce_details);
    const machines = normalizeResources(machine_details);
    const result = await pool.query(`
      INSERT INTO daily_logs (id, project_id, log_date, shift, contractor_unit, work_item, technical_staff_count, workforce_details, machine_details, work_summary, weather, worker_count, machine_count, progress, note, recommendation, status, created_by, created_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9::jsonb, $10, $11, $12, $13, $14, $15, $16, 'DRAFT', $17, NOW())
      ON CONFLICT (id) DO NOTHING
      RETURNING *, TO_CHAR(log_date, 'YYYY-MM-DD') AS log_date_text
    `, [logId, project_id, log_date, shiftCode, contractor_unit || null, work_item || null, Math.max(0, Math.floor(Number(technical_staff_count) || 0)), JSON.stringify(workforce), JSON.stringify(machines), work_summary, weather, workforce.length ? resourceTotal(workforce) : Math.max(0, Number(worker_count) || 0), machines.length ? resourceTotal(machines) : Math.max(0, Number(machine_count) || 0), progress, note, recommendation || null, created_by]);
    if (result.rows[0]) return { log: result.rows[0], created: true };
    return { log: await this.getDailyLogById(logId), created: false };
  }

  // Gửi nhật ký nháp để duyệt.
  async submitDailyLog(id, created_by) {
    const result = await pool.query(`
      UPDATE daily_logs
      SET status = 'SUBMITTED', submitted_at = NOW(), version = version + 1, row_version = row_version + 1, updated_at = NOW()
      WHERE id = $1 AND status = 'DRAFT'
      RETURNING *, TO_CHAR(log_date, 'YYYY-MM-DD') AS log_date_text
    `, [id]);
    return result.rows[0];
  }

  // Duyệt nhật ký đã gửi.
  async approveDailyLog(id, approved_by) {
    const result = await pool.query(`
      UPDATE daily_logs
      SET status = 'APPROVED', approved_by = $1, approved_at = NOW(), row_version = row_version + 1, updated_at = NOW()
      WHERE id = $2 AND status = 'SUBMITTED'
      RETURNING *, TO_CHAR(log_date, 'YYYY-MM-DD') AS log_date_text
    `, [approved_by, id]);
    return result.rows[0];
  }

  // Trả nhật ký về trạng thái nháp.
  async rejectDailyLog(id) {
    const result = await pool.query(`
      UPDATE daily_logs
      SET status = 'DRAFT', submitted_at = NULL, approved_at = NULL, approved_by = NULL, row_version = row_version + 1, updated_at = NOW()
      WHERE id = $1 AND status = 'SUBMITTED'
      RETURNING *, TO_CHAR(log_date, 'YYYY-MM-DD') AS log_date_text
    `, [id]);
    return result.rows[0];
  }

  // Khóa nhật ký đã duyệt thành hồ sơ chính thức.
  async lockDailyLog(id) {
    const result = await pool.query(`
      UPDATE daily_logs
      SET status = 'LOCKED', locked_at = NOW(), row_version = row_version + 1, updated_at = NOW()
      WHERE id = $1 AND status = 'APPROVED'
      RETURNING *, TO_CHAR(log_date, 'YYYY-MM-DD') AS log_date_text
    `, [id]);
    return result.rows[0];
  }

  // Chỉ cập nhật nhật ký còn ở trạng thái nháp.
  // Quy tắc sửa: ADMIN/GIÁM ĐỐC (giữ như cũ); hoặc bản DRAFT do mình lập (cần quyền Thêm);
  // hoặc bản DRAFT của người khác khi có quyền Sửa tại công trình.
  async updateDailyLog(id, data, actorId, perms = { role: '', permissions: [] }) {
    const { contractor_unit, work_item, technical_staff_count, workforce_details, machine_details, work_summary, weather, worker_count, machine_count, progress, note, recommendation } = data;
    const shiftCode = data.shift ? String(data.shift).trim().toUpperCase().slice(0, 20) : null;
    const workforce = workforce_details === undefined ? undefined : normalizeResources(workforce_details);
    const machines = machine_details === undefined ? undefined : normalizeResources(machine_details);
    const result = await pool.query(`
      UPDATE daily_logs
      SET work_summary = COALESCE($1, work_summary),
          shift = COALESCE($12, shift),
          contractor_unit = COALESCE($13, contractor_unit),
          work_item = COALESCE($14, work_item),
          technical_staff_count = COALESCE($15, technical_staff_count),
          recommendation = COALESCE($16, recommendation),
          workforce_details = COALESCE($17::jsonb, workforce_details),
          machine_details = COALESCE($18::jsonb, machine_details),
          weather = COALESCE($2, weather),
          worker_count = COALESCE($3, worker_count),
          machine_count = COALESCE($4, machine_count),
          progress = COALESCE($5, progress),
          note = COALESCE($6, note),
          version = version + 1,
          row_version = row_version + 1,
          updated_at = NOW()
      WHERE id = $7
        AND ($19::integer IS NULL OR row_version = $19)
        AND ($9::boolean OR (status = 'DRAFT' AND ((created_by = $8 AND $10::boolean) OR $11::boolean)))
       RETURNING *, TO_CHAR(log_date, 'YYYY-MM-DD') AS log_date_text
    `, [work_summary, weather, workforce ? resourceTotal(workforce) : worker_count, machines ? resourceTotal(machines) : machine_count, progress, note, id, actorId,
        ['ADMIN', 'DIRECTOR'].includes(perms.role), perms.permissions.includes('CREATE'), perms.permissions.includes('EDIT'), shiftCode,
        contractor_unit, work_item, technical_staff_count === undefined ? null : Math.max(0, Math.floor(Number(technical_staff_count) || 0)), recommendation,
        workforce === undefined ? null : JSON.stringify(workforce),
        machines === undefined ? null : JSON.stringify(machines), data.expected_row_version ?? null]);
    return result.rows[0];
  }

  // Chỉ xóa nhật ký còn ở trạng thái nháp.
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
    if (r.rows[0]) await pool.query('UPDATE daily_logs SET row_version = row_version + 1, updated_at = NOW() WHERE id = $1', [logId]);
    return r.rows[0];
  }
  async getFile(logId, fileId) {
    return (await pool.query('SELECT file_name, file_type, content FROM daily_log_files WHERE id = $1 AND daily_log_id = $2', [fileId, logId])).rows[0];
  }
}

module.exports = new DailyLogService();
