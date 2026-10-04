// Tổng hợp số liệu báo cáo TVGS (ngày / tuần / tháng / hoàn thành) từ dữ liệu đã có trong hệ thống.
// Số liệu được "chụp" (snapshot) vào hồ sơ báo cáo khi lưu để báo cáo đã duyệt không đổi theo dữ liệu sau này.
const pool = require('../utils/db');
const progressService = require('./projectProgressService');
const portfolioService = require('./portfolioService');

const TYPES = ['DAILY', 'WEEKLY', 'MONTHLY', 'FINAL'];
const DAY = 86400000;
const iso = d => d.toISOString().slice(0, 10);
// "Hôm nay" theo giờ Việt Nam (UTC+7): trước 7h sáng, giờ UTC vẫn là ngày hôm trước
const todayVN = () => iso(new Date(Date.now() + 7 * 3600000));
const addDays = (s, n) => iso(new Date(new Date(s + 'T00:00:00Z').getTime() + n * DAY));

function period(type, from, to, project) {
  const valid = s => /^\d{4}-\d{2}-\d{2}$/.test(s || '');
  if (type === 'DAILY') { if (!valid(from)) throw Object.assign(new Error('Chọn ngày báo cáo'), { status: 400 }); return [from, from]; }
  if (type === 'WEEKLY') {
    if (!valid(from)) throw Object.assign(new Error('Chọn một ngày trong tuần báo cáo'), { status: 400 });
    const d = new Date(from + 'T00:00:00Z'); const dow = (d.getUTCDay() + 6) % 7; // Thứ Hai = 0
    const mon = addDays(from, -dow); return [mon, addDays(mon, 6)];
  }
  if (type === 'MONTHLY') {
    const m = String(from || '').match(/^(\d{4})-(\d{2})/); if (!m) throw Object.assign(new Error('Chọn tháng báo cáo'), { status: 400 });
    const start = `${m[1]}-${m[2]}-01`; const end = iso(new Date(Date.UTC(+m[1], +m[2], 0))); return [start, end];
  }
  // FINAL: toàn bộ thời gian thực hiện
  const start = valid(from) ? from : (project.start_date || project.contract_date || String(project.created_at).slice(0, 10));
  const end = valid(to) ? to : todayVN();
  return [start, end];
}

async function compile(projectId, type, from, to) {
  if (!TYPES.includes(type)) throw Object.assign(new Error('Loại báo cáo không hợp lệ'), { status: 400 });
  const project = (await pool.query(`SELECT id, project_code, contract_no, name, province, address, owner_name, contractor_name,
      TO_CHAR(contract_date,'YYYY-MM-DD') contract_date, TO_CHAR(start_date,'YYYY-MM-DD') start_date, TO_CHAR(end_date,'YYYY-MM-DD') end_date,
      contract_value, contractor_contract_no, progress, status, created_at FROM projects WHERE id = $1`, [projectId])).rows[0];
  if (!project) throw Object.assign(new Error('Không tìm thấy công trình'), { status: 404 });
  if (type === 'FINAL' && !from) {
    const first = (await pool.query(`SELECT TO_CHAR(MIN(log_date),'YYYY-MM-DD') d FROM daily_logs WHERE project_id = $1`, [projectId])).rows[0]?.d;
    if (!project.start_date && first) project.start_date = first;
  }
  const [start, end] = period(type, from, to, project);
  if (end < start) throw Object.assign(new Error('Kỳ báo cáo không hợp lệ'), { status: 400 });

  const logs = (await pool.query(`
    SELECT dl.id, TO_CHAR(dl.log_date,'YYYY-MM-DD') AS date, dl.shift, dl.contractor_unit, dl.work_item,
           dl.technical_staff_count AS technical_staff, dl.workforce_details, dl.machine_details, dl.work_summary AS work, dl.weather,
           dl.worker_count AS workers, dl.machine_count AS machines, dl.note, dl.recommendation, dl.status,
           COALESCE(dl.author_name, u.full_name) AS created_by, a.full_name AS approved_by,
           (SELECT COUNT(*)::int FROM attachments x WHERE x.daily_log_id = dl.id) AS photos
    FROM daily_logs dl LEFT JOIN users u ON u.id = dl.created_by LEFT JOIN users a ON a.id = dl.approved_by
    WHERE dl.project_id = $1 AND dl.log_date BETWEEN $2 AND $3
    ORDER BY dl.log_date, dl.shift`, [projectId, start, end])).rows;

  const days = Math.round((new Date(end) - new Date(start)) / DAY) + 1;
  const logDates = new Set(logs.map(l => l.date));
  const today = todayVN();
  const missing = [];
  for (let i = 0; i < days && missing.length < 62; i++) { const d = addDays(start, i); if (d <= today && !logDates.has(d)) missing.push(d); }
  const byDay = {};
  logs.forEach(l => { const x = byDay[l.date] = byDay[l.date] || { workers: 0, machines: 0 }; x.workers += Number(l.workers || 0); x.machines += Number(l.machines || 0); });
  const dayVals = Object.values(byDay);
  const stats = {
    days_in_period: days, log_count: logs.length, days_with_logs: logDates.size, missing_days: missing,
    workers_total: dayVals.reduce((s, x) => s + x.workers, 0),
    workers_avg: dayVals.length ? Math.round(dayVals.reduce((s, x) => s + x.workers, 0) / dayVals.length * 10) / 10 : 0,
    workers_max: dayVals.reduce((m, x) => Math.max(m, x.workers), 0),
    machines_avg: dayVals.length ? Math.round(dayVals.reduce((s, x) => s + x.machines, 0) / dayVals.length * 10) / 10 : 0,
    photos: logs.reduce((s, l) => s + Number(l.photos || 0), 0),
    by_status: logs.reduce((m, l) => (m[l.status] = (m[l.status] || 0) + 1, m), {})
  };
  stats.by_inspector = Object.values(logs.reduce((grouped, log) => {
    const name = log.created_by || 'Chưa xác định';
    const item = grouped[name] = grouped[name] || { name, log_count: 0, workers: 0, machines: 0, photos: 0 };
    item.log_count += 1;item.workers += Number(log.workers || 0);item.machines += Number(log.machines || 0);item.photos += Number(log.photos || 0);
    return grouped;
  }, {})).sort((a, b) => a.name.localeCompare(b.name, 'vi'));

  const issuesOpened = (await pool.query(`
    SELECT issue_code, title, severity, status, source_type, TO_CHAR(created_at AT TIME ZONE 'Asia/Ho_Chi_Minh','YYYY-MM-DD') AS created
    FROM issues WHERE project_id = $1 AND (created_at AT TIME ZONE 'Asia/Ho_Chi_Minh')::date BETWEEN $2 AND $3 ORDER BY created_at`, [projectId, start, end])).rows;
  const issuesClosed = (await pool.query(`
    SELECT issue_code, title, TO_CHAR(resolved_at AT TIME ZONE 'Asia/Ho_Chi_Minh','YYYY-MM-DD') AS resolved
    FROM issues WHERE project_id = $1 AND resolved_at IS NOT NULL AND (resolved_at AT TIME ZONE 'Asia/Ho_Chi_Minh')::date BETWEEN $2 AND $3 ORDER BY resolved_at`, [projectId, start, end])).rows;
  // Còn tồn TẠI NGÀY CUỐI KỲ: đã phát sinh trước đó và chưa đóng (hoặc đóng sau ngày cuối kỳ)
  const openTotal = (await pool.query(`SELECT COUNT(*)::int n FROM issues WHERE project_id = $1
      AND (created_at AT TIME ZONE 'Asia/Ho_Chi_Minh')::date <= $2
      AND (resolved_at IS NULL OR (resolved_at AT TIME ZONE 'Asia/Ho_Chi_Minh')::date > $2)`, [projectId, end])).rows[0].n;

  const docs = (await pool.query(`
    SELECT auto_code, name, status, doc_group FROM documents
    WHERE project_id = $1 AND doc_group <> 'REPORT' AND (created_at AT TIME ZONE 'Asia/Ho_Chi_Minh')::date BETWEEN $2 AND $3 ORDER BY created_at`, [projectId, start, end])).rows;

  let progress = null;
  const plan = (await pool.query(`SELECT id FROM project_progress_plans WHERE project_id = $1 AND is_current ORDER BY created_at DESC LIMIT 1`, [projectId])).rows[0];
  // So sánh tiến độ tại ngày cuối kỳ, nhưng không vượt quá hôm nay (báo cáo tuần lập giữa tuần không so với kế hoạch tương lai)
  const progressAsOf = end < todayVN() ? end : todayVN();
  if (plan) {
    const d = await progressService.detail(projectId, plan.id, progressAsOf);
    const before = addDays(start, -1) < progressAsOf ? addDays(start, -1) : progressAsOf;
    const startSnap = type === 'DAILY' ? null : await progressService.detail(projectId, plan.id, before);
    progress = {
      plan_id: plan.id, plan_name: d.plan.plan_name, mode: d.summary.mode, as_of: progressAsOf,
      planned_percent: d.summary.planned_percent, actual_percent: d.summary.actual_percent, variance: d.summary.variance, spi: d.summary.spi ?? null,
      period_planned_gain: startSnap ? Math.round((d.summary.planned_percent - startSnap.summary.planned_percent) * 100) / 100 : null,
      period_actual_gain: startSnap ? Math.round((d.summary.actual_percent - startSnap.summary.actual_percent) * 100) / 100 : null,
      revised_end_date: d.plan.revised_end_date || null, is_extension: d.plan.is_extension,
      late_items: (d.items || []).filter(i => i.status === 'CHAM' || i.status === 'QUA_HAN').map(i => ({ name: i.name, planned: i.planned_percent, actual: i.actual_percent, status: i.status, end_date: i.end_date })),
      // Hạng mục kèm id để người lập báo cáo nhập/điều chỉnh % thực tế ngay trong báo cáo
      items: type === 'DAILY' ? [] : (d.items || []).map(i => ({ id: i.id, code: i.code, name: i.name, start_date: i.start_date, end_date: i.end_date,
        weight_share: i.weight_share, planned: i.planned_percent, actual: i.actual_percent, actual_date: i.actual_date, variance: i.variance, status: i.status,
        in_period: i.start_date <= end && i.end_date >= start }))
    };
  }
  // Cảnh báo tại thời điểm báo cáo (chụp vào báo cáo khi lưu)
  let alerts = [];
  try { alerts = (await portfolioService.projectHealth(project, progressAsOf)).alerts || []; } catch (_) { alerts = []; }
  const team = (await pool.query(`
    SELECT pp.full_name, pp.assignment_title FROM project_personnel pp WHERE pp.project_id = $1 AND pp.status = 'ACTIVE' ORDER BY pp.full_name`, [projectId])).rows;

  return {
    type, period: { from: start, to: end }, generated_at: new Date().toISOString(),
    project: { code: project.project_code || project.contract_no, name: project.name, location: project.address || project.province, owner: project.owner_name, contractor: project.contractor_name, contract_no: project.contract_no, contract_date: project.contract_date, start_date: project.start_date, end_date: project.end_date },
    logs, stats, issues: { opened: issuesOpened, closed: issuesClosed, open_total: openTotal }, documents: docs, progress, team, alerts
  };
}

module.exports = { compile, TYPES, period };
