const express = require('express');
const authMiddleware = require('../middleware/auth');
const rbac = require('../middleware/rbac');
const roleService = require('../services/roleService');

const router = express.Router();

router.use(authMiddleware.verifyToken);

// GET /api/roles
router.get('/', async (req, res) => {
  try {
    const roles = await roleService.getAllRoles();
    res.json(roles);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/roles/:id
router.get('/:id', async (req, res) => {
  try {
    const role = await roleService.getRoleById(req.params.id);
    res.json(role || {});
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/roles (admin only)
router.post('/', rbac.checkRole([rbac.ROLES.ADMIN]), async (req, res) => {
  try {
    const role = await roleService.createRole(req.body);
    res.status(201).json(role);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;