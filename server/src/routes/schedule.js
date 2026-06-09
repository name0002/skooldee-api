import { Router } from 'express';
import { all, get, run } from '../db.js';
import { wrap, required, bad, hhmm } from '../util.js';

const r = Router();

const withStudents = (slot) => {
  const students = all(
    `SELECT s.id, s.name, s.nickname FROM slot_students ss
       JOIN students s ON s.id = ss.student_id WHERE ss.slot_id = ?`, slot.id);
  return { ...slot, start: hhmm(slot.start_min), end: hhmm(slot.end_min), students };
};

// GET /api/schedule?day=2  (0=Mon..6=Sun) — returns slots grouped with their students
r.get('/', wrap((req, res) => {
  const sid = req.schoolId;
  let rows = all(
    `SELECT sl.*, t.name AS teacher_name FROM schedule_slots sl
       LEFT JOIN teachers t ON t.id = sl.teacher_id
      WHERE sl.school_id = ? ORDER BY sl.day_of_week, sl.start_min`, sid);
  if (req.query.day !== undefined) rows = rows.filter((s) => s.day_of_week === Number(req.query.day));
  res.json(rows.map(withStudents));
}));

// POST /api/schedule — create a slot / booking. is_group + student_ids[] for group classes.
r.post('/', wrap((req, res) => {
  const b = required(req.body, ['day_of_week', 'start_min', 'end_min']);
  const result = run(
    `INSERT INTO schedule_slots (school_id, teacher_id, category, day_of_week, start_min, end_min, is_group, title)
     VALUES (?,?,?,?,?,?,?,?)`,
    req.schoolId, b.teacher_id || null, b.category || null, b.day_of_week, b.start_min, b.end_min,
    b.is_group ? 1 : 0, b.title || null);
  const slotId = Number(result.lastInsertRowid);
  const ids = Array.isArray(b.student_ids) ? b.student_ids : (b.student_id ? [b.student_id] : []);
  for (const studentId of ids) {
    if (get('SELECT id FROM students WHERE id = ? AND school_id = ?', studentId, req.schoolId)) {
      run('INSERT OR IGNORE INTO slot_students (slot_id, student_id) VALUES (?, ?)', slotId, studentId);
    }
  }
  res.status(201).json(withStudents(get('SELECT * FROM schedule_slots WHERE id = ?', slotId)));
}));

r.delete('/:id', wrap((req, res) => {
  const result = run('DELETE FROM schedule_slots WHERE id = ? AND school_id = ?', req.params.id, req.schoolId);
  if (!result.changes) throw bad('slot not found', 404);
  res.json({ ok: true });
}));

export default r;
