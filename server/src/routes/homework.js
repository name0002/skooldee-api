import { Router } from 'express';
import { all, get, run } from '../db.js';
import { wrap, required, bad, recipientWords } from '../util.js';
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
  const student = get('SELECT id, name, nickname, recipient_type FROM students WHERE id = ? AND school_id = ?', b.student_id, req.schoolId);
  if (!student) throw bad('student not found', 404);
  const result = run(
    'INSERT INTO homework (school_id, student_id, title, detail, due_date, notified) VALUES (?,?,?,?,?,?)',
    req.schoolId, b.student_id, b.title, b.detail || null, b.due_date || null, b.notify ? 1 : 0);
  const hw = get('SELECT * FROM homework WHERE id = ?', Number(result.lastInsertRowid));

  // explicit "notify" → push to parent's LINE right away (not gated by opt-in prefs)
  let line = null;
  if (b.notify) {
    const name = student.nickname || student.name;
    const w = recipientWords(student.recipient_type, name);
    let text = b.message;                         // explicit client-supplied message wins
    if (!text) {
      const sch = get('SELECT homework_message_template FROM schools WHERE id = ?', req.schoolId);
      const tpl = sch && sch.homework_message_template && sch.homework_message_template.trim();
      if (tpl) {
        // school's custom template — placeholders resolve per-student (relationship-aware)
        text = tpl
          .replace(/\{ผู้รับ\}/g, w.greet)
          .replace(/\{ชื่อ\}/g, name || '')
          .replace(/\{หัวข้อ\}/g, b.title || '')
          .replace(/\{รายละเอียด\}/g, b.detail || '')
          .replace(/\{กำหนดส่ง\}/g, b.due_date || '')
          .replace(/[ \t]*\n{3,}/g, '\n\n');       // tidy blank lines left by empty placeholders
      } else {
        // built-in default — "ของน้องX" for guardians, direct for adult self-learners
        const subj = w.isSelf ? 'ค่ะ' : `ของ${w.studentRef}`;
        text =
          `📚 แจ้งการบ้าน${subj}\n\n📝 ${b.title}` +
          (b.detail ? `\n${b.detail}` : '') +
          (b.due_date ? `\n⏰ ส่งภายใน ${b.due_date}` : '') +
          `\n\n${w.care}`;
      }
    }
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
