import { Router } from 'express';
import { all, get, run } from '../db.js';
import { wrap, required, bad } from '../util.js';
import { requirePage } from '../auth.js';

const r = Router();

// evaluating staff (+ seeing their scores) is an owner/admin concern → teachers:manage
const canManage = requirePage('teachers', 'manage');

function cleanCriteria(raw) {
  const arr = Array.isArray(raw) ? raw : [];
  const out = [];
  for (const c of arr) {
    const name = String(c || '').trim().slice(0, 60);
    if (name && !out.includes(name)) out.push(name);
  }
  return out.slice(0, 20);
}

// clamp a single criterion score to 1..5 (0 / unknown criterion = dropped)
function cleanScores(raw, criteria) {
  const out = {};
  if (raw && typeof raw === 'object') {
    for (const [k, v] of Object.entries(raw)) {
      const name = String(k).trim();
      const n = Math.round(Number(v));
      if (criteria.includes(name) && n >= 1 && n <= 5) out[name] = n;
    }
  }
  return out;
}

const templateOut = (t) => ({ id: t.id, name: t.name, criteria: JSON.parse(t.criteria_json || '[]'), created_at: t.created_at });

// ---- templates (evaluation form: name + criteria rubric) ----

// GET /api/staff-evaluations/templates
r.get('/templates', canManage, wrap((req, res) => {
  const rows = all('SELECT * FROM evaluation_templates WHERE school_id = ? ORDER BY id DESC', req.schoolId);
  res.json(rows.map(templateOut));
}));

// POST /api/staff-evaluations/templates
// Created empty by design: the UI adds criteria afterward in the per-template
// editor and saves via PATCH (which still enforces ≥1 criterion). Requiring
// criteria here made every "create" fail since the create form only has a name.
r.post('/templates', canManage, wrap((req, res) => {
  const b = required(req.body, ['name']);
  const criteria = cleanCriteria(b.criteria);
  const result = run(
    'INSERT INTO evaluation_templates (school_id, name, criteria_json) VALUES (?,?,?)',
    req.schoolId, String(b.name).trim().slice(0, 100), JSON.stringify(criteria));
  res.status(201).json(templateOut(get('SELECT * FROM evaluation_templates WHERE id = ?', Number(result.lastInsertRowid))));
}));

// PATCH /api/staff-evaluations/templates/:id
r.patch('/templates/:id', canManage, wrap((req, res) => {
  const t = get('SELECT * FROM evaluation_templates WHERE id = ? AND school_id = ?', req.params.id, req.schoolId);
  if (!t) throw bad('template not found', 404);
  const sets = [], vals = [];
  if ('name' in req.body) { sets.push('name = ?'); vals.push(String(req.body.name).trim().slice(0, 100)); }
  if ('criteria' in req.body) {
    const criteria = cleanCriteria(req.body.criteria);
    if (!criteria.length) throw bad('ต้องมีเกณฑ์ประเมินอย่างน้อย 1 ข้อ');
    sets.push('criteria_json = ?'); vals.push(JSON.stringify(criteria));
  }
  if (!sets.length) throw bad('no fields to update');
  run(`UPDATE evaluation_templates SET ${sets.join(', ')} WHERE id = ? AND school_id = ?`, ...vals, t.id, req.schoolId);
  res.json(templateOut(get('SELECT * FROM evaluation_templates WHERE id = ?', t.id)));
}));

// DELETE /api/staff-evaluations/templates/:id
r.delete('/templates/:id', canManage, wrap((req, res) => {
  const result = run('DELETE FROM evaluation_templates WHERE id = ? AND school_id = ?', req.params.id, req.schoolId);
  if (!result.changes) throw bad('template not found', 404);
  res.json({ ok: true });
}));

// ---- evaluations (one scored record against a template, for one teacher) ----

// POST /api/staff-evaluations/templates/:id/submit
r.post('/templates/:id/submit', canManage, wrap((req, res) => {
  const tpl = get('SELECT * FROM evaluation_templates WHERE id = ? AND school_id = ?', req.params.id, req.schoolId);
  if (!tpl) throw bad('template not found', 404);
  const b = required(req.body, ['teacher_id', 'date']);
  const teacher = get('SELECT id FROM teachers WHERE id = ? AND school_id = ?', b.teacher_id, req.schoolId);
  if (!teacher) throw bad('teacher not found', 404);
  const criteria = JSON.parse(tpl.criteria_json || '[]');
  const scores = cleanScores(b.scores, criteria);
  if (!Object.keys(scores).length) throw bad('ต้องให้คะแนนอย่างน้อย 1 เกณฑ์');
  const result = run(
    `INSERT INTO evaluations (school_id, template_id, teacher_id, evaluator_id, date, scores_json, comments)
     VALUES (?,?,?,?,?,?,?)`,
    req.schoolId, tpl.id, teacher.id, req.user.uid, String(b.date).slice(0, 10),
    JSON.stringify(scores), (b.comments && String(b.comments).trim().slice(0, 500)) || null);
  const ev = get('SELECT * FROM evaluations WHERE id = ?', Number(result.lastInsertRowid));
  res.status(201).json({
    id: ev.id, template_id: ev.template_id, template_name: tpl.name, teacher_id: ev.teacher_id,
    date: ev.date, scores, comments: ev.comments || null, created_at: ev.created_at,
  });
}));

// GET /api/staff-evaluations?teacher_id=X — evaluation history for one teacher
r.get('/', canManage, wrap((req, res) => {
  const tid = req.query.teacher_id;
  if (!tid) throw bad('teacher_id required');
  const teacher = get('SELECT id FROM teachers WHERE id = ? AND school_id = ?', tid, req.schoolId);
  if (!teacher) throw bad('teacher not found', 404);
  const rows = all(
    `SELECT e.*, tpl.name AS template_name, u.name AS evaluator_name
       FROM evaluations e
       LEFT JOIN evaluation_templates tpl ON tpl.id = e.template_id
       LEFT JOIN users u ON u.id = e.evaluator_id
      WHERE e.teacher_id = ? AND e.school_id = ?
      ORDER BY e.date DESC, e.id DESC LIMIT 100`, teacher.id, req.schoolId);
  res.json(rows.map((e) => ({
    id: e.id, template_id: e.template_id, template_name: e.template_name || null,
    date: e.date, scores: (() => { try { return JSON.parse(e.scores_json || '{}'); } catch { return {}; } })(),
    comments: e.comments || null, evaluator: e.evaluator_name || null, created_at: e.created_at,
  })));
}));

// DELETE /api/staff-evaluations/:id — remove an evaluation record
r.delete('/:id', canManage, wrap((req, res) => {
  const result = run('DELETE FROM evaluations WHERE id = ? AND school_id = ?', req.params.id, req.schoolId);
  if (!result.changes) throw bad('evaluation not found', 404);
  res.json({ ok: true });
}));

export default r;
