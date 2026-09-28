const pool = require('../utils/db');
const { randomUUID } = require('crypto');

const DAY = 86400000;
function toDate(v) { if (!v) return null; const s = v instanceof Date ? v.toISOString().slice(0, 10) : String(v).slice(0, 10); return new Date(s + 'T00:00:00Z'); }
function isoOf(d) { return d ? d.toISOString().slice(0, 10) : null; }
function round(n, k = 2) { const f = 10 ** k; return Math.round(n * f) / f; }

// Tỷ lệ kế hoạch của một hạng mục tại ngày d: tuyến tính theo số ngày (tính cả ngày đầu và ngày cuối).
function plannedFraction(item, d) {
  const s = toDate(item.start_date), e = toDate(item.end_date);
  if (d < s) return 0;
  if (d >= e) return 1;
  return ((d - s) / DAY + 1) / ((e - s) / DAY + 1);
}

function itemWeights(items, basis) {
  const byDuration = items.map(i => (toDate(i.end_date) - toDate(i.start_date)) / DAY + 1);
  if (basis === 'VALUE' || basis === 'MANUAL') {
    const w = items.map(i => Number(i.weight) || 0);
    if (w.some(x => x > 0)) return { weights: w, basisUsed: basis };
    return { weights: byDuration, basisUsed: 'DURATION', warning: 'Chưa nhập giá trị/tỷ trọng nên tạm tính theo thời gian.' };
  }
  return { weights: byDuration, basisUsed: 'DURATION' };
}

const PLAN_COLUMNS = `id, project_id, plan_name, report_date, planned_percent, actual_percent, original_end_date,
  revised_end_date, is_extension, extension_reason, is_current, attachment_name, attachment_type, attachment_size,
  (attachment_data IS NOT NULL) AS has_attachment, weight_basis, start_date, note, created_by, created_at, updated_at`;

class ProjectProgressService {
  async list(projectId) {
    const result = await pool.query(`
      SELECT ${PLAN_COLUMNS},
             (SELECT COUNT(*)::int FROM project_schedule_items i WHERE i.plan_id = p.id) AS item_count
      FROM project_progress_plans p WHERE project_id = $1
      ORDER BY is_current DESC, report_date DESC, created_at DESC`, [projectId]);
    return result.rows;
  }

  async getPlan(projectId, planId) {
    const r = await pool.query(`SELECT ${PLAN_COLUMNS} FROM project_progress_plans WHERE id = $1 AND project_id = $2`, [planId, projectId]);
    return r.rows[0];
  }

  async getFile(projectId, planId) {
    const r = await pool.query(`SELECT attachment_name, attachment_type, attachment_data FROM project_progress_plans WHERE id = $1 AND project_id = $2`, [planId, projectId]);
    const row = r.rows[0];
    if (!row?.attachment_data) return null;
    const m = String(row.attachment_data).match(/^data:([^;,]*)(;base64)?,(.*)$/s);
    const buffer = m ? Buffer.from(m[3], m[2] ? 'base64' : 'utf8') : Buffer.from(row.attachment_data, 'base64');
    return { name: row.attachment_name || 'bang-tien-do', type: row.attachment_type || (m && m[1]) || 'application/octet-stream', buffer };
  }

  async items(planId) {
    const r = await pool.query(`
      SELECT i.*, TO_CHAR(i.start_date,'YYYY-MM-DD') AS start_text, TO_CHAR(i.end_date,'YYYY-MM-DD') AS end_text
      FROM project_schedule_items i WHERE plan_id = $1 ORDER BY seq`, [planId]);
    return r.rows.map(x => ({ ...x, start_date: x.start_text, end_date: x.end_text }));
  }

  async actuals(planId) {
    const r = await pool.query(`
      SELECT a.item_id, TO_CHAR(a.report_date,'YYYY-MM-DD') AS report_date, a.actual_percent, a.note
      FROM project_schedule_actuals a JOIN project_schedule_items i ON i.id = a.item_id
      WHERE i.plan_id = $1 ORDER BY a.report_date`, [planId]);
    return r.rows.map(x => ({ ...x, actual_percent: Number(x.actual_percent) }));
  }

  // So sánh kế hoạch - thực tế tại ngày asOf (mặc định hôm nay)
  async detail(projectId, planId, asOfText) {
    const plan = await this.getPlan(projectId, planId);
    if (!plan) return null;
    const items = await this.items(planId);
    const actuals = await this.actuals(planId);
    const asOf = toDate(asOfText || new Date().toISOString().slice(0, 10));
    if (!items.length) {
      return { plan, items: [], summary: {
        mode: 'MANUAL', as_of: isoOf(asOf),
        planned_percent: Number(plan.planned_percent || 0), actual_percent: Number(plan.actual_percent || 0),
        variance: round(Number(plan.actual_percent || 0) - Number(plan.planned_percent || 0)),
        note: 'Bảng tiến độ chưa có danh sách hạng mục: số liệu là tỷ lệ nhập tay, không kiểm chứng được. Hãy nhập hạng mục để so sánh chính xác.'
      }, curve: [] };
    }
    const { weights, basisUsed, warning } = itemWeights(items, plan.weight_basis);
    const total = weights.reduce((a, b) => a + b, 0) || 1;
    const byItem = new Map();
    actuals.forEach(a => { if (!byItem.has(a.item_id)) byItem.set(a.item_id, []); byItem.get(a.item_id).push(a); });
    const actualAt = (item, d) => {
      const list = byItem.get(item.id) || [];
      let v = 0, date = null;
      for (const a of list) { if (toDate(a.report_date) <= d) { v = a.actual_percent / 100; date = a.report_date; } }
      return { v, date };
    };
    let plannedSum = 0, actualSum = 0;
    const rows = items.map((it, i) => {
      const p = plannedFraction(it, asOf);
      const a = actualAt(it, asOf);
      plannedSum += weights[i] * p; actualSum += weights[i] * a.v;
      const diff = (a.v - p) * 100;
      let status = 'DUNG_TIEN_DO';
      if (p === 0 && a.v === 0) status = 'CHUA_DEN_HAN';
      else if (a.v >= 1) status = 'HOAN_THANH';
      else if (diff < -5) status = toDate(it.end_date) < asOf ? 'QUA_HAN' : 'CHAM';
      else if (diff > 5) status = 'VUOT';
      return {
        ...it, weight_used: round(weights[i], 4), weight_share: round(weights[i] / total * 100, 2),
        planned_percent: round(p * 100), actual_percent: round(a.v * 100), actual_date: a.date,
        variance: round(diff), status
      };
    });
    const starts = items.map(i => toDate(i.start_date)), ends = items.map(i => toDate(i.end_date));
    const start = new Date(Math.min(...starts)), end = new Date(Math.max(...ends));
    // Đường cong S theo tuần (kế hoạch toàn thời gian, thực tế đến ngày asOf)
    const curve = [];
    const step = Math.max(1, Math.ceil(((end - start) / DAY + 1) / 60)) * DAY;
    for (let t = start.getTime(); t <= end.getTime() + step; t += step) {
      const d = new Date(Math.min(t, end.getTime()));
      const planned = items.reduce((s, it, i) => s + weights[i] * plannedFraction(it, d), 0) / total * 100;
      const point = { date: isoOf(d), planned: round(planned) };
      if (d <= asOf) point.actual = round(items.reduce((s, it, i) => s + weights[i] * actualAt(it, d).v, 0) / total * 100);
      curve.push(point);
      if (d.getTime() === end.getTime()) break;
    }
    const plannedPct = round(plannedSum / total * 100), actualPct = round(actualSum / total * 100);
    return {
      plan, items: rows, curve,
      summary: {
        mode: 'ITEMS', as_of: isoOf(asOf), weight_basis_used: basisUsed, warning: warning || null,
        planned_percent: plannedPct, actual_percent: actualPct, variance: round(actualPct - plannedPct),
        spi: plannedPct > 0 ? round(actualPct / plannedPct, 3) : null,
        start_date: isoOf(start), end_date: isoOf(end),
        late_items: rows.filter(r => r.status === 'CHAM' || r.status === 'QUA_HAN').length,
        item_count: rows.length
      }
    };
  }

  // Cập nhật danh sách hạng mục GIỮ NGUYÊN số liệu thực tế: hạng mục có id cũ được sửa tại chỗ,
  // hạng mục mới được thêm, chỉ hạng mục bị bỏ khỏi danh sách mới bị xóa (kèm số liệu của nó).
  async replaceItems(client, planId, items) {
    const existing = new Set((await client.query('SELECT id FROM project_schedule_items WHERE plan_id = $1', [planId])).rows.map(r => r.id));
    const keep = items.map(it => it.id).filter(id => id && existing.has(id));
    await client.query('DELETE FROM project_schedule_items WHERE plan_id = $1 AND NOT (id = ANY($2::uuid[]))', [planId, keep]);
    let seq = 0;
    for (const it of items) {
      seq += 1;
      const values = [planId, seq, it.code || '', String(it.name).slice(0, 500), it.unit || '', it.quantity ?? null, it.weight ?? null, it.start_date, it.end_date];
      if (it.id && existing.has(it.id)) {
        await client.query(`UPDATE project_schedule_items SET seq=$2, code=NULLIF($3,''), name=$4, unit=NULLIF($5,''), quantity=$6, weight=$7, start_date=$8, end_date=$9
          WHERE id = $10 AND plan_id = $1`, [...values, it.id]);
      } else {
        await client.query(`INSERT INTO project_schedule_items (plan_id, seq, code, name, unit, quantity, weight, start_date, end_date)
          VALUES ($1, $2, NULLIF($3,''), $4, NULLIF($5,''), $6, $7, $8, $9)`, values);
      }
    }
  }

  planValues(data, current = {}) {
    const file = data.attachment;
    return {
      plan_name: data.plan_name ?? current.plan_name ?? 'Bảng tiến độ',
      report_date: data.report_date ?? current.report_date ?? new Date().toISOString().slice(0, 10),
      planned_percent: data.planned_percent ?? current.planned_percent ?? 0,
      actual_percent: data.actual_percent ?? current.actual_percent ?? 0,
      original_end_date: data.original_end_date !== undefined ? (data.original_end_date || null) : (current.original_end_date ?? null),
      revised_end_date: data.revised_end_date !== undefined ? (data.revised_end_date || null) : (current.revised_end_date ?? null),
      is_extension: data.is_extension !== undefined ? data.is_extension === true : (current.is_extension ?? false),
      extension_reason: data.extension_reason !== undefined ? (data.extension_reason || null) : (current.extension_reason ?? null),
      weight_basis: ['DURATION', 'VALUE', 'MANUAL'].includes(data.weight_basis) ? data.weight_basis : (current.weight_basis || 'DURATION'),
      note: data.note !== undefined ? (data.note || null) : (current.note ?? null),
      file
    };
  }

  // Cập nhật % tiến độ công trình theo bảng tiến độ hiện hành
  async syncProject(client, projectId) {
    const cur = (await client.query(`SELECT id, revised_end_date FROM project_progress_plans WHERE project_id = $1 AND is_current ORDER BY created_at DESC LIMIT 1`, [projectId])).rows[0];
    if (!cur) return null;
    // Tiến độ công trình = thực tế tại ngày báo cáo gần nhất (không sớm hơn hôm nay)
    const last = (await client.query(`SELECT TO_CHAR(MAX(a.report_date),'YYYY-MM-DD') AS d FROM project_schedule_actuals a
      JOIN project_schedule_items i ON i.id = a.item_id WHERE i.plan_id = $1`, [cur.id])).rows[0]?.d;
    const today = new Date().toISOString().slice(0, 10);
    const d = await this.detail(projectId, cur.id, last && last > today ? last : today);
    const project = await client.query(`
      UPDATE projects SET progress = $1, end_date = COALESCE($2, end_date), updated_at = NOW() WHERE id = $3 RETURNING *`,
    [d.summary.actual_percent, cur.revised_end_date, projectId]);
    return project.rows[0];
  }

  async create(projectId, data, actorId) {
    const id = randomUUID();
    const v = this.planValues(data);
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      if (data.is_current !== false) await client.query('UPDATE project_progress_plans SET is_current = false WHERE project_id = $1', [projectId]);
      await client.query(`
        INSERT INTO project_progress_plans (id, project_id, plan_name, report_date, planned_percent, actual_percent,
          original_end_date, revised_end_date, is_extension, extension_reason, is_current,
          attachment_name, attachment_type, attachment_size, attachment_data, weight_basis, note, created_by, updated_by)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$18)`,
      [id, projectId, v.plan_name, v.report_date, v.planned_percent, v.actual_percent, v.original_end_date,
        v.revised_end_date, v.is_extension, v.extension_reason, data.is_current !== false,
        v.file?.name || null, v.file?.type || null, Number(v.file?.size || 0) || null, v.file?.data || null,
        v.weight_basis, v.note, actorId]);
      if (Array.isArray(data.items)) await this.replaceItems(client, id, data.items);
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
    const project = await this.syncProjectSafe(projectId);
    return { plan: await this.getPlan(projectId, id), project };
  }

  async update(projectId, planId, data, actorId) {
    const current = await this.getPlan(projectId, planId);
    if (!current) return null;
    const v = this.planValues(data, current);
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(`
        UPDATE project_progress_plans SET plan_name=$1, report_date=$2, planned_percent=$3, actual_percent=$4,
          original_end_date=$5, revised_end_date=$6, is_extension=$7, extension_reason=$8, weight_basis=$9, note=$10,
          updated_by=$11, updated_at=NOW()
        WHERE id=$12`,
      [v.plan_name, v.report_date, v.planned_percent, v.actual_percent, v.original_end_date, v.revised_end_date,
        v.is_extension, v.extension_reason, v.weight_basis, v.note, actorId, planId]);
      if (data.remove_attachment === true) {
        await client.query(`UPDATE project_progress_plans SET attachment_name=NULL, attachment_type=NULL, attachment_size=NULL, attachment_data=NULL WHERE id=$1`, [planId]);
      } else if (v.file?.data) {
        await client.query(`UPDATE project_progress_plans SET attachment_name=$1, attachment_type=$2, attachment_size=$3, attachment_data=$4 WHERE id=$5`,
          [v.file.name || 'bang-tien-do', v.file.type || null, Number(v.file.size || 0) || null, v.file.data, planId]);
      }
      if (Array.isArray(data.items)) await this.replaceItems(client, planId, data.items);
      if (data.is_current === true) {
        await client.query('UPDATE project_progress_plans SET is_current = (id = $2) WHERE project_id = $1', [projectId, planId]);
      }
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
    const project = await this.syncProjectSafe(projectId);
    return { plan: await this.getPlan(projectId, planId), project };
  }

  async saveActuals(projectId, planId, reportDate, rows, actorId) {
    const plan = await this.getPlan(projectId, planId);
    if (!plan) return null;
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      for (const r of rows) {
        const own = await client.query('SELECT 1 FROM project_schedule_items WHERE id = $1 AND plan_id = $2', [r.item_id, planId]);
        if (!own.rows[0]) continue;
        await client.query(`
          INSERT INTO project_schedule_actuals (item_id, report_date, actual_percent, note, created_by)
          VALUES ($1, $2, $3, NULLIF($4,''), $5)
          ON CONFLICT (item_id, report_date) DO UPDATE SET actual_percent = EXCLUDED.actual_percent,
            note = EXCLUDED.note, created_by = EXCLUDED.created_by, created_at = NOW()`,
        [r.item_id, reportDate, Number(r.actual_percent), r.note || '', actorId]);
      }
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
    const project = await this.syncProjectSafe(projectId);
    return { detail: await this.detail(projectId, planId, reportDate), project };
  }

  async remove(projectId, planId) {
    const r = await pool.query('DELETE FROM project_progress_plans WHERE id = $1 AND project_id = $2 RETURNING id, is_current', [planId, projectId]);
    if (r.rows[0]?.is_current) {
      await pool.query(`UPDATE project_progress_plans SET is_current = true WHERE id = (
        SELECT id FROM project_progress_plans WHERE project_id = $1 ORDER BY report_date DESC, created_at DESC LIMIT 1)`, [projectId]);
    }
    return r.rows[0];
  }

  async syncProjectSafe(projectId) {
    const client = await pool.connect();
    try { return await this.syncProject(client, projectId); }
    finally { client.release(); }
  }
}

module.exports = new ProjectProgressService();
