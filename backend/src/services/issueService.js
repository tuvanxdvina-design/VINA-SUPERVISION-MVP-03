const pool = require('../utils/db');
const { randomUUID } = require('crypto');

class IssueService {
  async getAllIssues(projectId, filters = {}) {
    let query = `
      SELECT i.*, TO_CHAR(i.due_date, 'YYYY-MM-DD') AS due_date_text, COALESCE(i.author_name, u.full_name) as created_by_name, a.full_name as assigned_to_name, r.full_name as resolved_by_name
      FROM issues i
      LEFT JOIN users u ON i.created_by = u.id
      LEFT JOIN users a ON i.assigned_to = a.id
      LEFT JOIN users r ON i.resolved_by = r.id
      WHERE i.project_id = $1
    `;
    const params = [projectId];

    if (filters.status) {
      query += ` AND i.status = $${params.length + 1}`;
      params.push(filters.status);
    }

    query += ` ORDER BY i.created_at DESC`;
    const result = await pool.query(query, params);
    return result.rows;
  }

  async getIssueById(id) {
    const result = await pool.query(`
      SELECT i.*, TO_CHAR(i.due_date, 'YYYY-MM-DD') AS due_date_text, COALESCE(i.author_name, u.full_name) as created_by_name
      FROM issues i
      LEFT JOIN users u ON i.created_by = u.id
      WHERE i.id = $1
    `, [id]);
    return result.rows[0];
  }

  async createIssue(data) {
    const { project_id, title, description, severity, created_by, issue_code, due_date, source_type } = data;
    const id = data.id || randomUUID();
    const result = await pool.query(`
      INSERT INTO issues (id, project_id, title, description, details, severity, status, created_by, issue_code, due_date, source_type, created_at)
      VALUES ($1, $2, $3, $4, $5::jsonb, $6, 'OPEN', $7, $8, $9, $10, NOW())
      ON CONFLICT (id) DO NOTHING
      RETURNING *
    `, [id, project_id, title, description, JSON.stringify(data.details || {}), severity, created_by, issue_code || null, due_date || null, source_type || null]);
    if (result.rows[0]) return { issue: result.rows[0], created: true };
    return { issue: await this.getIssueById(id), created: false };
  }

  async assignIssue(id, assigned_to) {
    const result = await pool.query(`
      UPDATE issues
      SET assigned_to = $1, assigned_at = NOW(), row_version = row_version + 1, updated_at = NOW()
      WHERE id = $2
      RETURNING *
    `, [assigned_to, id]);
    return result.rows[0];
  }

  async resolveIssue(id, resolved_by, resolution_note) {
    const result = await pool.query(`
      UPDATE issues
      SET status = 'RESOLVED', resolved_by = $1, resolved_at = NOW(), resolution_note = $2, row_version = row_version + 1, updated_at = NOW()
      WHERE id = $3 AND status = 'OPEN'
      RETURNING *
    `, [resolved_by, resolution_note, id]);
    if (result.rows[0]) return { issue: result.rows[0], changed: true };
    return { issue: await this.getIssueById(id), changed: false };
  }

  async updateIssue(id, data) {
    const { title, description, severity, issue_code, due_date, source_type } = data;
    const result = await pool.query(`
      UPDATE issues
      SET title = COALESCE($1, title),
          description = COALESCE($2, description),
          severity = COALESCE($3, severity),
          issue_code = COALESCE($4, issue_code),
          due_date = COALESCE($5, due_date),
          source_type = COALESCE($6, source_type),
          details = COALESCE($7::jsonb, details),
          row_version = row_version + 1,
          updated_at = NOW()
      WHERE id = $8 AND ($9::integer IS NULL OR row_version = $9)
      RETURNING *
    `, [title, description, severity, issue_code, due_date || null, source_type, data.details === undefined ? null : JSON.stringify(data.details || {}), id, data.expected_row_version ?? null]);
    return result.rows[0];
  }

  async reopenIssue(id, reopenedBy) {
    const result = await pool.query(`
      UPDATE issues
      SET status = 'OPEN', resolved_by = NULL, resolved_at = NULL, resolution_note = NULL, row_version = row_version + 1, updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `, [id]);
    return result.rows[0];
  }

  async deleteIssue(id) {
    await pool.query(`DELETE FROM issues WHERE id = $1`, [id]);
  }
}

module.exports = new IssueService();
