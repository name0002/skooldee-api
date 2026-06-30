import { Router } from 'express';
import { all, get, run } from '../db.js';
import { wrap, required, bad } from '../util.js';
import { requireRole, ownStudentIds } from '../auth.js';

const r = Router();

const ownsStudent = (req, id) => !req.scopeOwn || ownStudentIds(req.schoolId, req.teacherId).includes(Number(id));

// clamp a single criterion score to 1..5 (0 = not rated → dropped)
function cleanScores(raw) {
  const out = {};
  if (raw && typeof raw === 'object') {
    for (const [k, v] of Object.entries(raw)) {
      const name = String(k).trim().slice(0, 60);
      const n = Math.round(Number(v));
      if (name && n >= 1 && n <= 5) out[name] = n;
    }
  }
  return out;
}

// GET /api/assessments?student_id=X — assessment history for one student (school-scoped)
r.get('/', wrap((req, res) => {
  const sid = req.query.student_id;
  if (!sid) throw bad('student_id required');
  if (!ownsStudent(req, sid)) throw bad('student not found', 404);
  const stu = get('SELECT id FROM students WHERE id = ? AND school_id = ?', sid, req.schoolId);
  if (!stu) throw bad('student not found', 404);
  const rows = all(
    `SELECT a.*, t.name AS teacher_name FROM assessments a
       LEFT JOIN teachers t ON t.id = a.teacher_id
      WHERE a.student_id = ? AND a.school_id = ?
      ORDER BY a.date DESC, a.id DESC LIMIT 50`, sid, req.schoolId);
  res.json(rows.map((a) => ({
    id: a.id, category: a.category, date: a.date,
    scores: (() => { try { return JSON.parse(a.scores_json || '{}'); } catch { return {}; } })(),
    note: a.note || null, teacher: a.teacher_name || null, created_at: a.created_at,
  })));
}));

// POST /api/assessments — record a new assessment (owner/admin/teacher)
r.post('/', requireRole('owner', 'admin', 'teacher'), wrap((req, res) => {
  const b = required(req.body, ['student_id', 'date']);
  if (!ownsStudent(req, b.student_id)) throw bad('student not found', 404);
  const stu = get('SELECT id FROM students WHERE id = ? AND school_id = ?', b.student_id, req.schoolId);
  if (!stu) throw bad('student not found', 404);
  if (b.teacher_id && !get('SELECT id FROM teachers WHERE id = ? AND school_id = ?', b.teacher_id, req.schoolId)) {
    throw bad('teacher not found', 404);
  }
  const scores = cleanScores(b.scores);
  if (!Object.keys(scores).length) throw bad('ต้องให้คะแนนอย่างน้อย 1 เกณฑ์');
  const result = run(
    `INSERT INTO assessments (school_id, student_id, category, date, scores_json, note, teacher_id)
     VALUES (?,?,?,?,?,?,?)`,
    req.schoolId, stu.id, b.category || null, String(b.date).slice(0, 10),
    JSON.stringify(scores), (b.note && String(b.note).trim().slice(0, 300)) || null, b.teacher_id || null);
  const a = get('SELECT * FROM assessments WHERE id = ?', Number(result.lastInsertRowid));
  res.status(201).json({
    id: a.id, category: a.category, date: a.date, scores, note: a.note || null, created_at: a.created_at,
  });
}));

// DELETE /api/assessments/:id — remove an assessment (owner/admin/teacher)
r.delete('/:id', requireRole('owner', 'admin', 'teacher'), wrap((req, res) => {
  const a = get('SELECT id, student_id FROM assessments WHERE id = ? AND school_id = ?', req.params.id, req.schoolId);
  if (!a) throw bad('assessment not found', 404);
  if (!ownsStudent(req, a.student_id)) throw bad('assessment not found', 404);
  run('DELETE FROM assessments WHERE id = ?', a.id);
  res.json({ ok: true });
}));

export default r;
