import { Router } from 'express';
import { all, get, run } from '../db.js';
import { requireRole } from '../auth.js';
import { wrap, required, bad } from '../util.js';

const r = Router();

// GET /api/packages — course packages with editable pricing
r.get('/', wrap((req, res) => {
  res.json(all('SELECT * FROM packages WHERE school_id = ? ORDER BY sort, id', req.schoolId));
}));

// pricing is financial — only owner/admin may create/edit/remove packages
r.post('/', requireRole('owner', 'admin'), wrap((req, res) => {
  const b = required(req.body, ['name', 'sessions', 'duration_min', 'price']);
  const result = run(
    'INSERT INTO packages (school_id, name, sessions, duration_min, price, is_default, sort) VALUES (?,?,?,?,?,?,?)',
    req.schoolId, b.name, b.sessions, b.duration_min, b.price, b.is_default ? 1 : 0, b.sort || 0);
  res.status(201).json(get('SELECT * FROM packages WHERE id = ?', Number(result.lastInsertRowid)));
}));

// PATCH /api/packages/:id — edit price (or other fields) yourself
r.patch('/:id', requireRole('owner', 'admin'), wrap((req, res) => {
  const p = get('SELECT * FROM packages WHERE id = ? AND school_id = ?', req.params.id, req.schoolId);
  if (!p) throw bad('package not found', 404);
  const fields = ['name', 'sessions', 'duration_min', 'price', 'is_default', 'sort'];
  const sets = [], vals = [];
  for (const f of fields) if (f in req.body) { sets.push(`${f} = ?`); vals.push(req.body[f]); }
  if (!sets.length) throw bad('no fields to update');
  run(`UPDATE packages SET ${sets.join(', ')} WHERE id = ? AND school_id = ?`, ...vals, p.id, req.schoolId);
  res.json(get('SELECT * FROM packages WHERE id = ?', p.id));
}));

r.delete('/:id', requireRole('owner', 'admin'), wrap((req, res) => {
  const result = run('DELETE FROM packages WHERE id = ? AND school_id = ?', req.params.id, req.schoolId);
  if (!result.changes) throw bad('package not found', 404);
  res.json({ ok: true });
}));

export default r;
