const pool = require('../utils/db');

// Audit logger middleware
exports.auditLog = async (entityType, entityId, action, oldValues, newValues, userId) => {
  try {
    await pool.query(
      `INSERT INTO audit_logs (entity_type, entity_id, action, old_values, new_values, performed_by, performed_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
      [entityType, entityId, action, oldValues, newValues, userId]
    );
  } catch (err) {
    console.error('Audit log error:', err.message);
  }
};

// Middleware to attach audit helper to request
exports.auditMiddleware = (req, res, next) => {
  req.audit = exports.auditLog;
  next();
};