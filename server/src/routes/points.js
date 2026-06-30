import { Router } from 'express';
import { all, get, run, tierOf } from '../db.js';
import { wrap, required, bad } from '../util.js';
import { requireFeature, ownStudentIds } from '../auth.js';

const r = Router();

const ownsStudent = (req, id) => !req.scopeOwn || ownStudentIds(req.schoolId, req.teacherId).includes(Number(id));

// GET /api/points/leaderboard
r.get('/leaderboard', wrap((req, res) => {
  const rows = all(
    'SELECT id, name, nickname, points FROM students WHERE school_id = ? ORDER BY points DESC LIMIT 20',
    req.schoolId);
  res.json(rows.map((s) => ({ ...s, tier: tierOf(s.points) })));
}));

// GET /api/points/:studentId — balance + ledger
r.get('/:studentId', wrap((req, res) => {
  if (!ownsStudent(req, req.params.studentId)) throw bad('student not found', 404);
  const s = get('SELECT id, name, points FROM students WHERE id = ? AND school_id = ?', req.params.studentId, req.schoolId);
  if (!s) throw bad('student not found', 404);
  const ledger = all('SELECT * FROM points_ledger WHERE student_id = ? AND school_id = ? ORDER BY created_at DESC', s.id, req.schoolId);
  res.json({ student: s, tier: tierOf(s.points), ledger });
}));

// POST /api/points — manual adjustment by staff (give reward points / deduct).
r.post('/', requireFeature('points', 'ระบบแต้มสะสมใช้ได้ในแผน ACADEMY ขึ้นไป — อัปเกรดเพื่อเปิดใช้งาน'), wrap((req, res) => {
  const b = required(req.body, ['student_id', 'delta']);
  // clamp a single adjustment to a sane range so a typo can't blow up a balance
  const delta = Math.max(-500, Math.min(500, Math.trunc(Number(b.delta) || 0)));
  if (!delta) throw bad('delta must be a non-zero number');
  if (!ownsStudent(req, b.student_id)) throw bad('student not found', 404);
  const s = get('SELECT * FROM students WHERE id = ? AND school_id = ?', b.student_id, req.schoolId);
  if (!s) throw bad('student not found', 404);
  // never let points go negative
  const newPoints = Math.max(0, (s.points || 0) + delta);
  const applied = newPoints - (s.points || 0); // actual change after the floor
  run('UPDATE students SET points = ? WHERE id = ? AND school_id = ?', newPoints, s.id, req.schoolId);
  run('INSERT INTO points_ledger (school_id, student_id, delta, reason) VALUES (?,?,?,?)',
    req.schoolId, s.id, applied, (b.reason && String(b.reason).trim().slice(0, 120)) || 'ปรับแต้มด้วยตนเอง');
  res.status(201).json(get('SELECT id, name, points FROM students WHERE id = ? AND school_id = ?', s.id, req.schoolId));
}));

export default r;
