const pool = require('../utils/db');

// RBAC middleware: check role permissions
exports.checkRole = (allowedRoles) => {
  return async (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Unauthorized' });
      }
      
      // Get role name from role_id
      const roleResult = await pool.query(
        `SELECT name FROM roles WHERE id = $1`,
        [req.user.roleId]
      );
      
      if (roleResult.rows.length === 0) {
        return res.status(403).json({ error: 'Role not found' });
      }
      
      const roleName = roleResult.rows[0].name;
      
      if (!allowedRoles.includes(roleName)) {
        return res.status(403).json({ error: 'Forbidden: insufficient permissions' });
      }
      
      req.role = roleName;
      next();
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  };
};

// Role definitions
exports.ROLES = {
  ADMIN: 'ADMIN',
  DIRECTOR: 'DIRECTOR',
  MANAGER: 'MANAGER',
  TVGS_LEAD: 'TVGS_LEAD',
  ENGINEER: 'ENGINEER'
};