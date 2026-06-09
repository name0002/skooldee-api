import { Router } from 'express';
import { all, get, run } from '../db.js';
import { wrap, required, bad } from '../util.js';

const r = Router();

// GET /api/homework?status=pending
r.get('/', wrap((req, res) => {
  let rows = all(
    `SELECT h.*, s.name AS student_name FROM homework h
       JOIN students s ON s.id = h.student_id
      WHERE h.school_id = ? ORDER BY h.created_at DESC`, req.schoolId);
  if (req.query.status) rows = rows.filter((h) => h.status === req.query.status);
  res.json(rows);
}));

// POST /api/homework — assign. notify=true marks it queued for LINE (see notify.js stub).
r.post('/', wrap((req, res) => {
  const b = required(req.body, ['student_id', 'title']);
  if (!get('SELECT id FROM students WHERE id = ? AND school_id = ?', b.student_id, req.schoolId))
    throw bad('student not found', 404);
  const result = run(
    'INSERT INTO homework (school_id, student_id, title, detail, due_date, notified) VALUES (?,?,?,?,?,?)',
    req.schoolId, b.student_id, b.title, b.detail || null, b.due_date || null, b.notify ? 1 : 0);
  res.status(201).json(get('SELECT * FROM homework WHERE id = ?', Number(result.lastInsertRowid)));
}));

r.patch('/:id', wrap((req, res) => {
  const h = get('SELECT * FROM homework WHERE id = ? AND school_id = ?', req.params.id, req.schoolId);
  if (!h) throw bad('homework not found', 404);
  const fields = ['title', 'detail', 'due_date', 'status', 'notified'];
  const sets = [], vals = [];
  for (const f of fields) if (f in req.body) { sets.push(`${f} = ?`); vals.push(req.body[f]); }
  if (!sets.length) throw bad('no fields to update');
  run(`UPDATE homework SET ${sets.join(', ')} WHERE id = ? AND school_id = ?`, ...vals, h.id, req.schoolId);
  res.json(get('SELECT * FROM homework WHERE id = ?', h.id));
}));

export default r;
