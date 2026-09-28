const pool = require('../utils/db');

class RoleService {
  async getAllRoles() {
    const result = await pool.query('SELECT * FROM roles ORDER BY name');
    return result.rows;
  }

  async getRoleById(id) {
    const result = await pool.query('SELECT * FROM roles WHERE id = $1', [id]);
    return result.rows[0];
  }

  async createRole(data) {
    const { name, description } = data;
    const result = await pool.query(`
      INSERT INTO roles (name, description)
      VALUES ($1, $2)
      RETURNING *
    `, [name, description]);
    return result.rows[0];
  }

  async updateRole(id, data) {
    const { name, description } = data;
    const result = await pool.query(`
      UPDATE roles 
      SET name = COALESCE($1, name),
          description = COALESCE($2, description),
          updated_at = NOW()
      WHERE id = $3
      RETURNING *
    `, [name, description, id]);
    return result.rows[0];
  }
}

module.exports = new RoleService();