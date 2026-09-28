const express = require('express');
const auth = require('../middleware/auth');
const access = require('../middleware/projectAccess');
const reportService = require('../services/reportService');
const portfolioService = require('../services/portfolioService');

const router = express.Router();
router.use(auth.verifyToken);

// GET /api/reports/compile?project_id=&type=DAILY|WEEKLY|MONTHLY|FINAL&from=YYYY-MM-DD[&to=YYYY-MM-DD]
router.get('/compile', access.query, async (req, res) => {
  try { res.json(await reportService.compile(req.query.project_id, String(req.query.type || '').toUpperCase(), req.query.from, req.query.to)); }
  catch (e) {
    if (e.status) return res.status(e.status).json({ error: e.message });
    console.error('reports:', e.message);
    res.status(500).json({ error: 'Không tổng hợp được số liệu báo cáo' });
  }
});

// GET /api/reports/portfolio — tổng quan tiến độ + cảnh báo.
// Admin/Giám đốc: mọi công trình; người khác: chỉ công trình mình được phân công (lọc ở máy chủ).
router.get('/portfolio', async (req, res) => {
  try {
    const projects = await require('../services/projectService').getAllProjects(req.user.userId);
    res.json(await portfolioService.portfolio(projects));
  } catch (e) {
    console.error('portfolio:', e.message);
    res.status(500).json({ error: 'Không tổng hợp được tình trạng công trình' });
  }
});

// GET /api/reports/health/:projectId — tình trạng + cảnh báo của một công trình
router.get('/health/:projectId', access.projectParam, async (req, res) => {
  try {
    const project = await require('../services/projectService').getProjectById(req.params.projectId);
    if (!project) return res.status(404).json({ error: 'Không tìm thấy công trình' });
    res.json(await portfolioService.projectHealth(project));
  } catch (e) {
    console.error('health:', e.message);
    res.status(500).json({ error: 'Không tính được tình trạng công trình' });
  }
});

module.exports = router;
