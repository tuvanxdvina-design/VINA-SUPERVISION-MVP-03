// ============================================================================
// THÙNG RÁC — xóa có lý do, khôi phục được (như Procore / Aconex / PlanRadar: "Recycle bin")
// Xóa = chụp nguyên bản ghi + mọi dữ liệu con (to_jsonb) vào deleted_records rồi gỡ khỏi bảng chính.
// Các truy vấn nghiệp vụ không cần lọc "đã xóa"; khôi phục ghi lại đúng từng dòng như cũ.
// ============================================================================
const pool = require('../utils/db');

// Bảng con theo từng loại (đều ON DELETE CASCADE). nested: bảng cháu theo khóa của bảng con.
const SPEC = {
  daily_logs: {
    label: 'Nhật ký',
    children: [['attachments', 'daily_log_id'], ['daily_log_files', 'daily_log_id'], ['daily_log_items', 'daily_log_id'], ['daily_log_materials', 'daily_log_id']],
    title: r => `Nhật ký ${String(r.log_date).slice(8, 10)}/${String(r.log_date).slice(5, 7)}/${String(r.log_date).slice(0, 4)} — ${r.shift || ''}: ${String(r.work_summary || '').slice(0, 120)}`
  },
  documents: {
    label: 'Hồ sơ / báo cáo',
    children: [['document_files', 'document_id'], ['attachments', 'document_id']],
    title: r => `${r.auto_code || ''} — ${r.name || ''}`
  },
  issues: {
    label: 'Văn bản chất lượng',
    children: [['issue_history', 'issue_id']],
    title: r => `${r.issue_code || ''} ${r.title || ''}`.trim()
  },
  project_progress_plans: {
    label: 'Bảng tiến độ',
    children: [['project_schedule_items', 'plan_id', [['project_schedule_actuals', 'item_id']]]],
    title: r => r.plan_name || 'Bảng tiến độ'
  }
};
const TYPES = Object.keys(SPEC);

function httpError(status, message) { const e = new Error(message); e.status = status; return e; }

async function tableExists(client, table) {
  return !!(await client.query('SELECT to_regclass($1) AS t', ['public.' + table])).rows[0].t;
}

async function snapshotChildren(client, children, parentIds) {
  const out = {};
  for (const [table, fk, nested] of children) {
    if (!await tableExists(client, table)) continue;
    const rows = (await client.query(`SELECT to_jsonb(t) AS r FROM ${table} t WHERE ${fk} = ANY($1::uuid[])`, [parentIds])).rows.map(x => x.r);
    out[table] = rows;
    if (nested && rows.length) Object.assign(out, await snapshotChildren(client, nested, rows.map(r => r.id)));
  }
  return out;
}

// Chuyển vào Thùng rác. Trả về id của bản ghi trong thùng rác.
async function archive(type, id, reason, actorId) {
  const spec = SPEC[type];
  if (!spec) throw httpError(400, 'Loại nội dung không hợp lệ');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const row = (await client.query(`SELECT to_jsonb(t) AS r FROM ${type} t WHERE id = $1 FOR UPDATE`, [id])).rows[0]?.r;
    if (!row) throw httpError(404, 'Không tìm thấy nội dung cần xóa');
    const children = await snapshotChildren(client, spec.children, [id]);
    if (type === 'documents') {
      // Hồ sơ khác trỏ tới hồ sơ này (bản điều chỉnh) → bỏ liên kết, ghi lại để khôi phục
      const refs = (await client.query('SELECT id FROM documents WHERE is_adjustment_of = $1', [id])).rows.map(r => r.id);
      if (refs.length) { children.__adjustment_refs = refs; await client.query('UPDATE documents SET is_adjustment_of = NULL WHERE is_adjustment_of = $1', [id]); }
    }
    const rec = (await client.query(`
      INSERT INTO deleted_records (entity_type, entity_id, project_id, title, snapshot, reason, deleted_by)
      VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7) RETURNING id`,
    [type, id, row.project_id || null, spec.title(row).slice(0, 500), JSON.stringify({ row, children }), reason, actorId])).rows[0];
    await client.query(`DELETE FROM ${type} WHERE id = $1`, [id]);
    if (type === 'project_progress_plans' && row.is_current) {
      await client.query(`UPDATE project_progress_plans SET is_current = true WHERE id = (
        SELECT id FROM project_progress_plans WHERE project_id = $1 ORDER BY report_date DESC, created_at DESC LIMIT 1)`, [row.project_id]);
    }
    await client.query('COMMIT');
    return { recycleId: rec.id, row };
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally { client.release(); }
}

async function insertRow(client, table, json) {
  await client.query(`INSERT INTO ${table} SELECT * FROM jsonb_populate_record(NULL::${table}, $1::jsonb)`, [JSON.stringify(json)]);
}

// Khôi phục đúng như cũ (kể cả ảnh, tệp, hạng mục, số liệu thực tế)
async function restore(recycleId, actorId) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const rec = (await client.query('SELECT * FROM deleted_records WHERE id = $1 FOR UPDATE', [recycleId])).rows[0];
    if (!rec) throw httpError(404, 'Không tìm thấy trong Thùng rác');
    if (rec.restored_at) throw httpError(409, 'Nội dung này đã được khôi phục');
    if (rec.purged_at || !rec.snapshot) throw httpError(409, 'Nội dung đã bị xóa vĩnh viễn, không khôi phục được');
    const spec = SPEC[rec.entity_type];
    const { row, children } = rec.snapshot;
    if (rec.entity_type === 'project_progress_plans' && row.is_current) {
      await client.query('UPDATE project_progress_plans SET is_current = false WHERE project_id = $1', [row.project_id]);
    }
    await insertRow(client, rec.entity_type, row);
    const order = [];
    const walk = list => list.forEach(([table, , nested]) => { order.push(table); if (nested) walk(nested); });
    walk(spec.children);
    for (const table of order) {
      for (const r of (children?.[table] || [])) await insertRow(client, table, r);
    }
    if (children?.__adjustment_refs?.length) {
      await client.query('UPDATE documents SET is_adjustment_of = $1 WHERE id = ANY($2::uuid[]) AND is_adjustment_of IS NULL', [row.id, children.__adjustment_refs]);
    }
    await client.query('UPDATE deleted_records SET restored_at = NOW(), restored_by = $2 WHERE id = $1', [recycleId, actorId]);
    await client.query('COMMIT');
    return { type: rec.entity_type, id: rec.entity_id, project_id: rec.project_id };
  } catch (e) {
    await client.query('ROLLBACK');
    if (e.code === '23505') throw httpError(409, 'Không khôi phục được: đã có nội dung trùng (vd. nhật ký cùng ngày và ca, hoặc mã hồ sơ). Xóa/sửa bản trùng rồi thử lại.');
    if (e.code === '23503') throw httpError(409, 'Không khôi phục được: công trình hoặc tài khoản liên quan không còn tồn tại.');
    throw e;
  } finally { client.release(); }
}

// Xóa vĩnh viễn: bỏ nội dung, giữ dòng vết (ai xóa, lý do, lúc nào)
async function purge(recycleId, actorId) {
  const r = await pool.query(`UPDATE deleted_records SET snapshot = NULL, purged_at = NOW(), purged_by = $2
    WHERE id = $1 AND restored_at IS NULL AND purged_at IS NULL RETURNING id, entity_type, title`, [recycleId, actorId]);
  if (!r.rows[0]) throw httpError(409, 'Không tìm thấy nội dung trong Thùng rác (có thể đã khôi phục hoặc đã xóa vĩnh viễn)');
  return r.rows[0];
}

// projectIds = null → mọi công trình
async function list(projectIds) {
  return (await pool.query(`
    SELECT d.id, d.entity_type, d.entity_id, d.project_id, d.title, d.reason, d.deleted_at, d.restored_at, d.purged_at,
           COALESCE(p.project_code, p.contract_no) AS project_code, p.name AS project_name,
           du.full_name AS deleted_by_name, ru.full_name AS restored_by_name, pu.full_name AS purged_by_name,
           (SELECT COUNT(*)::int FROM jsonb_each(COALESCE(d.snapshot->'children', '{}'::jsonb)) c,
              jsonb_array_elements(CASE WHEN jsonb_typeof(c.value) = 'array' THEN c.value ELSE '[]'::jsonb END) e
            WHERE left(c.key, 2) <> '__') AS child_count
    FROM deleted_records d
    LEFT JOIN projects p ON p.id = d.project_id
    LEFT JOIN users du ON du.id = d.deleted_by LEFT JOIN users ru ON ru.id = d.restored_by LEFT JOIN users pu ON pu.id = d.purged_by
    WHERE ($1::uuid[] IS NULL OR d.project_id = ANY($1::uuid[]))
    ORDER BY d.deleted_at DESC LIMIT 500`, [projectIds])).rows.map(r => ({ ...r, type_label: SPEC[r.entity_type]?.label || r.entity_type }));
}

async function get(recycleId) {
  return (await pool.query('SELECT id, entity_type, entity_id, project_id, restored_at, purged_at FROM deleted_records WHERE id = $1', [recycleId])).rows[0];
}

module.exports = { SPEC, TYPES, archive, restore, purge, list, get };
