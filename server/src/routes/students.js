import { Router } from 'express';
import { all, get, run, tierOf } from '../db.js';
import { wrap, required, bad } from '../util.js';

const r = Router();

const codeFor = (name) =>
  'MARI-' + String(name || 'XX').replace(/\s/g, '').slice(0, 2).toUpperCase() + Math.floor(100 + Math.random() * 900);

// GET /api/students?near_limit=1&q=&category=
r.get('/', wrap((req, res) => {
  const sid = req.schoolId;
  const sch = get('SELECT near_limit_threshold FROM schools WHERE id = ?', sid);
  const rows = all(
    `SELECT s.*, t.name AS teacher_name, p.name AS package_name
       FROM students s
       LEFT JOIN teachers t ON t.id = s.teacher_id
       LEFT JOIN packages p ON p.id = s.package_id
      WHERE s.school_id = ? ORDER BY s.name`, sid);
  let list = rows.map((s) => ({ ...s, tier: tierOf(s.points), near_limit: s.sessions_remaining <= sch.near_limit_threshold }));

  if (req.query.near_limit === '1') list = list.filter((s) => s.near_limit);
  if (req.query.category) list = list.filter((s) => s.category === req.query.category);
  if (req.query.q) {
    const q = String(req.query.q).toLowerCase();
    list = list.filter((s) => (s.name + ' ' + (s.nickname || '')).toLowerCase().includes(q));
  }
  res.json(list);
}));

r.get('/:id', wrap((req, res) => {
  const s = get('SELECT * FROM students WHERE id = ? AND school_id = ?', req.params.id, req.schoolId);
  if (!s) throw bad('student not found', 404);
  const homework = all('SELECT * FROM homework WHERE student_id = ? ORDER BY created_at DESC LIMIT 10', s.id);
  const points = all('SELECT * FROM points_ledger WHERE student_id = ? ORDER BY created_at DESC LIMIT 10', s.id);
  res.json({ ...s, tier: tierOf(s.points), homework, points_history: points });
}));

r.post('/', wrap((req, res) => {
  const b = required(req.body, ['name']);
  const sid = req.schoolId;
  const result = run(
    `INSERT INTO students (school_id, name, nickname, age, parent_name, parent_phone, line_id, category,
       teacher_id, package_id, sessions_remaining, sessions_total, balance_due, status, referral_code)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    sid, b.name, b.nickname || null, b.age || null, b.parent_name || null, b.parent_phone || null,
    b.line_id || null, b.category || null, b.teacher_id || null, b.package_id || null,
    b.sessions_remaining || 0, b.sessions_total || b.sessions_remaining || 0, b.balance_due || 0,
    b.status || 'active', codeFor(b.nickname || b.name)
  );
  res.status(201).json(get('SELECT * FROM students WHERE id = ?', Number(result.lastInsertRowid)));
}));

// PATCH /api/students/:id — partial update of editable fields
r.patch('/:id', wrap((req, res) => {
  const s = get('SELECT * FROM students WHERE id = ? AND school_id = ?', req.params.id, req.schoolId);
  if (!s) throw bad('student not found', 404);
  const fields = ['name', 'nickname', 'age', 'parent_name', 'parent_phone', 'line_id', 'category',
    'teacher_id', 'package_id', 'sessions_remaining', 'sessions_total', 'balance_due', 'status'];
  const sets = [], vals = [];
  for (const f of fields) if (f in req.body) { sets.push(`${f} = ?`); vals.push(req.body[f]); }
  if (!sets.length) throw bad('no fields to update');
  run(`UPDATE students SET ${sets.join(', ')} WHERE id = ? AND school_id = ?`, ...vals, s.id, req.schoolId);
  res.json(get('SELECT * FROM students WHERE id = ?', s.id));
}));

r.delete('/:id', wrap((req, res) => {
  const result = run('DELETE FROM students WHERE id = ? AND school_id = ?', req.params.id, req.schoolId);
  if (!result.changes) throw bad('student not found', 404);
  res.json({ ok: true });
}));

export default r;
