import { Router } from 'express';
import { all, get, run } from '../db.js';
import { wrap, required, bad } from '../util.js';

const r = Router();

// GET /api/teachers — includes student count + estimated monthly pay (hours this month * rate)
r.get('/', wrap((req, res) => {
  const sid = req.schoolId;
  const teachers = all('SELECT * FROM teachers WHERE school_id = ? ORDER BY name', sid);
  res.json(teachers.map((t) => {
    const students = get('SELECT COUNT(*) c FROM students WHERE teacher_id = ? AND school_id = ?', t.id, sid).c;
    const minutes = get(
      `SELECT COALESCE(SUM(end_min - start_min),0) m FROM schedule_slots WHERE teacher_id = ? AND school_id = ?`,
      t.id, sid).m;
    const weeklyHours = minutes / 60;
    return { ...t, students, weekly_hours: weeklyHours, est_monthly_pay: Math.round(weeklyHours * 4 * t.hourly_rate) };
  }));
}));

r.post('/', wrap((req, res) => {
  const b = required(req.body, ['name']);
  const result = run(
    'INSERT INTO teachers (school_id, name, category, hourly_rate, phone, line_id) VALUES (?,?,?,?,?,?)',
    req.schoolId, b.name, b.category || null, b.hourly_rate || 0, b.phone || null, b.line_id || null);
  res.status(201).json(get('SELECT * FROM teachers WHERE id = ?', Number(result.lastInsertRowid)));
}));

r.patch('/:id', wrap((req, res) => {
  const t = get('SELECT * FROM teachers WHERE id = ? AND school_id = ?', req.params.id, req.schoolId);
  if (!t) throw bad('teacher not found', 404);
  const fields = ['name', 'category', 'hourly_rate', 'phone', 'line_id'];
  const sets = [], vals = [];
  for (const f of fields) if (f in req.body) { sets.push(`${f} = ?`); vals.push(req.body[f]); }
  if (!sets.length) throw bad('no fields to update');
  run(`UPDATE teachers SET ${sets.join(', ')} WHERE id = ? AND school_id = ?`, ...vals, t.id, req.schoolId);
  res.json(get('SELECT * FROM teachers WHERE id = ?', t.id));
}));

r.delete('/:id', wrap((req, res) => {
  const result = run('DELETE FROM teachers WHERE id = ? AND school_id = ?', req.params.id, req.schoolId);
  if (!result.changes) throw bad('teacher not found', 404);
  res.json({ ok: true });
}));

export default r;
