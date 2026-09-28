const pool = require('../utils/db');
const { randomUUID } = require('crypto');

function projectValues(data) {
  return [
    data.project_code || data.contract_no,
    data.contract_no,
    data.name,
    data.province ?? '',
    data.address ?? '',
    data.owner_name || null,
    data.contractor_name || null,
    data.contract_date || null,
    data.start_date || null,
    data.end_date || null,
    data.contract_value ?? null,
    data.contract_content || null,
    data.progress ?? 0,
    data.status || 'ACTIVE',
    data.contractor_contract_no || null,
    data.contractor_contract_date || null,
    data.contractor_contract_value ?? null,
    data.contractor_contract_content || null
  ];
}

class ProjectService {
  async getAllProjects(userId) {
    const result = await pool.query(`
      SELECT p.* FROM projects p
      JOIN users u ON u.id = $1
      JOIN roles r ON r.id = u.role_id
      WHERE r.name IN ('ADMIN', 'DIRECTOR') OR EXISTS (
        SELECT 1 FROM project_members pm
        WHERE pm.project_id = p.id AND pm.user_id = $1
          AND pm.status = 'ACTIVE'
          AND (pm.start_date IS NULL OR pm.start_date <= CURRENT_DATE)
          AND (pm.end_date IS NULL OR pm.end_date >= CURRENT_DATE)
      )
      ORDER BY p.created_at DESC
    `, [userId]);
    return result.rows;
  }

  async getProjectById(id) {
    const result = await pool.query('SELECT * FROM projects WHERE id = $1', [id]);
    return result.rows[0];
  }

  async createProject(data) {
    const id = data.id || randomUUID();
    const values = [id, ...projectValues(data), data.created_by];
    const client = await pool.connect();
    try {
    await client.query('BEGIN');
    const result = await client.query(`
      INSERT INTO projects (
        id, project_code, contract_no, name, province, address,
        owner_name, contractor_name, contract_date, start_date, end_date,
        contract_value, contract_content, progress, status,
        contractor_contract_no, contractor_contract_date, contractor_contract_value, contractor_contract_content,
        created_by, location, description
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11,
        $12, $13, $14, $15, $16, $17, $18, $19, $20, $5, $13
      )
      ON CONFLICT (id) DO NOTHING
      RETURNING *
    `, values);
    if (result.rows[0]) {
      // Không tự phân công người tạo: chỉ ADMIN/GIÁM ĐỐC được tạo công trình và họ đã có quyền
      // trên mọi công trình. Tự phân công làm họ xuất hiện như "nhân sự" của công trình.
      await client.query('COMMIT');
      return { project: result.rows[0], created: true };
    }
    const existing = await client.query('SELECT * FROM projects WHERE id = $1', [id]);
    await client.query('COMMIT');
    return { project: existing.rows[0], created: false };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async updateProject(id, data) {
    // Trường không gửi lên thì giữ giá trị cũ (trước đây bị ghi đè thành rỗng / tiến độ về 0).
    const current = await this.getProjectById(id);
    if (!current) return null;
    const sent = Object.fromEntries(Object.entries(data || {}).filter(([, v]) => v !== undefined));
    const values = projectValues({ ...current, ...sent });
    const result = await pool.query(`
      UPDATE projects SET
        project_code = $1, contract_no = $2, name = $3,
        province = $4, address = $5, owner_name = $6, contractor_name = $7,
        contract_date = $8, start_date = $9, end_date = $10,
        contract_value = $11, contract_content = $12,
        progress = $13, status = $14,
        contractor_contract_no = $15, contractor_contract_date = $16,
        contractor_contract_value = $17, contractor_contract_content = $18,
        location = $4, description = $12,
        updated_at = NOW()
      WHERE id = $19
      RETURNING *
    `, [...values, id]);
    return result.rows[0];
  }
}

module.exports = new ProjectService();
