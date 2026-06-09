import { Router } from 'express';
import { all, get, run } from '../db.js';
import { wrap, required, bad, today } from '../util.js';

const r = Router();
const POINTS_PER_ATTEND = 10; // matches prototype: present = +10 points

// GET /api/attendance?date=YYYY-MM-DD
r.get('/', wrap((req, res) => {
  const date = req.query.date || today();
  const rows = all(
    `SELECT a.*, s.name AS student_name FROM attendance a
       JOIN students s ON s.id = a.student_id
      WHERE a.school_id = ? AND a.date = ? ORDER BY a.created_at DESC`, req.schoolId, date);
  const summary = { present: 0, absent: 0, leave: 0 };
  rows.forEach((a) => { summary[a.status] = (summary[a.status] || 0) + 1; });
  res.json({ date, summary, records: rows });
}));

// POST /api/attendance — mark a student. status: present|absent|leave
// "present" auto-decrements remaining sessions and awards loyalty points.
r.post('/', wrap((req, res) => {
  const b = required(req.body, ['student_id', 'status']);
  if (!['present', 'absent', 'leave'].includes(b.status)) throw bad('invalid status');
  const student = get('SELECT * FROM students WHERE id = ? AND school_id = ?', b.student_id, req.schoolId);
  if (!student) throw bad('student not found', 404);

  let points = 0;
  if (b.status === 'present') {
    points = POINTS_PER_ATTEND;
    const remaining = Math.max(0, student.sessions_remaining - 1);
    run('UPDATE students SET sessions_remaining = ?, points = points + ? WHERE id = ?', remaining, points, student.id);
    run('INSERT INTO points_ledger (school_id, student_id, delta, reason) VALUES (?,?,?,?)',
      req.schoolId, student.id, points, 'เช็คชื่อเข้าเรียน');
  }
  const result = run(
    'INSERT INTO attendance (school_id, student_id, slot_id, date, status, points_awarded) VALUES (?,?,?,?,?,?)',
    req.schoolId, student.id, b.slot_id || null, b.date || today(), b.status, points);

  const updated = get('SELECT id, name, sessions_remaining, points FROM students WHERE id = ?', student.id);
  res.status(201).json({
    attendance: get('SELECT * FROM attendance WHERE id = ?', Number(result.lastInsertRowid)),
    student: updated,
  });
}));

export default r;
