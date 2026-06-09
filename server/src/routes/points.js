import { Router } from 'express';
import { all, get, run, tierOf } from '../db.js';
import { wrap, required, bad } from '../util.js';

const r = Router();

// GET /api/points/leaderboard
r.get('/leaderboard', wrap((req, res) => {
  const rows = all(
    'SELECT id, name, nickname, points FROM students WHERE school_id = ? ORDER BY points DESC LIMIT 20',
    req.schoolId);
  res.json(rows.map((s) => ({ ...s, tier: tierOf(s.points) })));
}));

// GET /api/points/:studentId — balance + ledger
r.get('/:studentId', wrap((req, res) => {
  const s = get('SELECT id, name, points FROM students WHERE id = ? AND school_id = ?', req.params.studentId, req.schoolId);
  if (!s) throw bad('student not found', 404);
  const ledger = all('SELECT * FROM points_ledger WHERE student_id = ? ORDER BY created_at DESC', s.id);
  res.json({ student: s, tier: tierOf(s.points), ledger });
}));

// POST /api/points — manual adjustment (e.g., redeem reward)
r.post('/', wrap((req, res) => {
  const b = required(req.body, ['student_id', 'delta']);
  const s = get('SELECT * FROM students WHERE id = ? AND school_id = ?', b.student_id, req.schoolId);
  if (!s) throw bad('student not found', 404);
  run('UPDATE students SET points = points + ? WHERE id = ?', b.delta, s.id);
  run('INSERT INTO points_ledger (school_id, student_id, delta, reason) VALUES (?,?,?,?)',
    req.schoolId, s.id, b.delta, b.reason || 'ปรับแต้มด้วยตนเอง');
  res.status(201).json(get('SELECT id, name, points FROM students WHERE id = ?', s.id));
}));

export default r;
