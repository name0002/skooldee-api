import { Router } from 'express';
import { all, get, run } from '../db.js';
import { wrap, bad } from '../util.js';
import { requireRole } from '../auth.js';
import crypto from 'node:crypto';

const r = Router();

// GET /api/enrollments?status=pending   — list enrollment requests for this school
r.get('/', wrap((req, res) => {
  let rows = all(
    'SELECT * FROM enrollment_requests WHERE school_id = ? ORDER BY created_at DESC',
    req.schoolId);
  if (req.query.status) rows = rows.filter((x) => x.status === req.query.status);
  res.json(rows);
}));

// POST /api/enrollments/:id/accept  — convert to active student, mark accepted
r.post('/:id/accept', requireRole('owner', 'admin'), wrap((req, res) => {
  const enr = get('SELECT * FROM enrollment_requests WHERE id = ? AND school_id = ?',
    req.params.id, req.schoolId);
  if (!enr) throw bad('not found', 404);
  if (enr.status !== 'pending') throw bad('ใบสมัครนี้ถูกประมวลผลแล้ว');
  const token = crypto.randomBytes(8).toString('hex');
  const result = run(
    `INSERT INTO students
       (school_id, name, parent_name, parent_phone, line_id, category, status, parent_token,
        sessions_remaining, sessions_total, balance_due, points)
     VALUES (?,?,?,?,?,?,'active',?,0,0,0,0)`,
    req.schoolId,
    enr.student_name,
    enr.parent_name || null,
    enr.phone || null,
    enr.line_id || null,
    enr.category || null,
    token,
  );
  run("UPDATE enrollment_requests SET status = 'accepted' WHERE id = ?", enr.id);
  res.json({ ok: true, student_id: Number(result.lastInsertRowid) });
}));

// POST /api/enrollments/:id/reject
r.post('/:id/reject', requireRole('owner', 'admin'), wrap((req, res) => {
  const enr = get('SELECT id FROM enrollment_requests WHERE id = ? AND school_id = ?',
    req.params.id, req.schoolId);
  if (!enr) throw bad('not found', 404);
  run("UPDATE enrollment_requests SET status = 'rejected' WHERE id = ?", enr.id);
  res.json({ ok: true });
}));

// DELETE /api/enrollments/:id
r.delete('/:id', requireRole('owner', 'admin'), wrap((req, res) => {
  const enr = get('SELECT id FROM enrollment_requests WHERE id = ? AND school_id = ?',
    req.params.id, req.schoolId);
  if (!enr) throw bad('not found', 404);
  run('DELETE FROM enrollment_requests WHERE id = ?', enr.id);
  res.json({ ok: true });
}));

export default r;
