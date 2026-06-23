import { Router } from 'express';
import { all, get, run } from '../db.js';
import { wrap, required, bad } from '../util.js';
import { pushToParent } from '../line-push.js';
import { requirePage, ownStudentIds } from '../auth.js';

const r = Router();

const canManage = requirePage('homework', 'manage');
const ownsStudent = (req, id) => !req.scopeOwn || ownStudentIds(req.schoolId, req.teacherId).includes(Number(id));

// GET /api/homework?status=pending
r.get('/', wrap((req, res) => {
  let rows = all(
    `SELECT h.*, s.name AS student_name FROM homework h
       JOIN students s ON s.id = h.student_id
      WHERE h.school_id = ? ORDER BY h.created_at DESC`, req.schoolId);
  if (req.scopeOwn) {
    const own = new Set(ownStudentIds(req.schoolId, req.teacherId));
    rows = rows.filter((h) => own.has(h.student_id));
  }
  if (req.query.status) rows = rows.filter((h) => h.status === req.query.status);
  res.json(rows);
}));

// POST /api/homework — assign. notify=true sends a LINE message to the linked parent now.
r.post('/', canManage, wrap(async (req, res) => {
  const b = required(req.body, ['student_id', 'title']);
  if (!ownsStudent(req, b.student_id)) throw bad('student not found', 404);
  const student = get('SELECT id, name, nickname FROM students WHERE id = ? AND school_id = ?', b.student_id, req.schoolId);
  if (!student) throw bad('student not found', 404);
  const result = run(
    'INSERT INTO homework (school_id, student_id, title, detail, due_date, notified) VALUES (?,?,?,?,?,?)',
    req.schoolId, b.student_id, b.title, b.detail || null, b.due_date || null, b.notify ? 1 : 0);
  const hw = get('SELECT * FROM homework WHERE id = ?', Number(result.lastInsertRowid));

  // explicit "notify" → push to parent's LINE right away (not gated by opt-in prefs)
  let line = null;
  if (b.notify) {
    const who = student.nickname || student.name;
    const text = b.message || (
      `📚 แจ้งการบ้านของน้อง${who}\n\n📝 ${b.title}` +
      (b.detail ? `\n${b.detail}` : '') +
      (b.due_date ? `\n⏰ ส่งภายใน ${b.due_date}` : '') +
      `\n\nรบกวนผู้ปกครองช่วยดูแลน้องฝึกด้วยนะคะ 😊`);
    line = await pushToParent(req.schoolId, student.id, text);
  }
  res.status(201).json({ ...hw, line });
}));

r.patch('/:id', canManage, wrap((req, res) => {
  const h = get('SELECT * FROM homework WHERE id = ? AND school_id = ?', req.params.id, req.schoolId);
  if (!h) throw bad('homework not found', 404);
  if (!ownsStudent(req, h.student_id)) throw bad('homework not found', 404);
  const fields = ['title', 'detail', 'due_date', 'status', 'notified'];
  const sets = [], vals = [];
  for (const f of fields) if (f in req.body) { sets.push(`${f} = ?`); vals.push(req.body[f]); }
  if (!sets.length) throw bad('no fields to update');
  run(`UPDATE homework SET ${sets.join(', ')} WHERE id = ? AND school_id = ?`, ...vals, h.id, req.schoolId);
  res.json(get('SELECT * FROM homework WHERE id = ?', h.id));
}));

r.delete('/:id', canManage, wrap((req, res) => {
  const h = get('SELECT student_id FROM homework WHERE id = ? AND school_id = ?', req.params.id, req.schoolId);
  if (!h) throw bad('homework not found', 404);
  if (!ownsStudent(req, h.student_id)) throw bad('homework not found', 404);
  run('DELETE FROM homework WHERE id = ? AND school_id = ?', req.params.id, req.schoolId);
  res.json({ ok: true });
}));

export default r;
