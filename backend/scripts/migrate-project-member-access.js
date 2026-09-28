require('dotenv').config();
const pool = require('../src/utils/db');

(async () => {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS project_member_access (
        project_member_id uuid PRIMARY KEY REFERENCES project_members(id) ON DELETE CASCADE,
        access_permissions jsonb NOT NULL DEFAULT '["VIEW"]'::jsonb,
        work_scope text,
        updated_at timestamptz NOT NULL DEFAULT NOW()
      )
    `);
    console.log('project_member_access table is ready');
  } catch (error) {
    console.error('Migration failed:', error.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
})();
