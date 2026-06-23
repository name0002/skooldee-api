import { Router } from 'express';
import { all, get, run } from '../db.js';
import { wrap, required, bad, hhmm } from '../util.js';
import { maybeNotifyTeacher } from '../line-push.js';
import { requirePage } from '../auth.js';

const r = Router();

// managing the timetable (create/move/cancel classes) needs schedule:manage
const canManage = requirePage('schedule', 'manage');

const withStudents = (slot) => {
  const students = all(
    `SELECT s.id, s.name, s.nickname FROM slot_students ss
       JOIN students s ON s.id = ss.student_id WHERE ss.slot_id = ?`, slot.id);
  return { ...slot, start: hhmm(slot.start_min), end: hhmm(slot.end_min), students };
};

// GET /api/schedule?day=2  (0=Mon..6=Sun) — returns slots grouped with their students.
// Teachers scoped to 'own' only see classes THEY teach (drives the check-in page too).
r.get('/', wrap((req, res) => {
  const sid = req.schoolId;
  let rows = all(
    `SELECT sl.*, t.name AS teacher_name FROM schedule_slots sl
       LEFT JOIN teachers t ON t.id = sl.teacher_id
      WHERE sl.school_id = ? ORDER BY sl.day_of_week, sl.start_min`, sid);
  if (req.scopeOwn) rows = rows.filter((s) => s.teacher_id === req.teacherId);
  if (req.query.day !== undefined) rows = rows.filter((s) => s.day_of_week === Number(req.query.day));
  res.json(rows.map(withStudents));
}));

// POST /api/schedule — create a slot / booking. is_group + student_ids[] for group classes.
r.post('/', canManage, wrap((req, res) => {
  const b = required(req.body, ['day_of_week', 'start_min', 'end_min']);
  if (b.teacher_id && !get('SELECT id FROM teachers WHERE id = ? AND school_id = ?', b.teacher_id, req.schoolId)) throw bad('teacher not found', 404);
  const rate = (b.rate != null && b.rate !== '') ? Math.max(0, parseInt(b.rate) || 0) : null;
  const result = run(
    `INSERT INTO schedule_slots (school_id, teacher_id, category, day_of_week, start_min, end_min, is_group, title, per_session, session_fee, rate, room)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
    req.schoolId, b.teacher_id || null, b.category || null, b.day_of_week, b.start_min, b.end_min,
    b.is_group ? 1 : 0, b.title || null, b.per_session ? 1 : 0, Math.max(0, parseInt(b.session_fee) || 0), rate,
    (b.room != null && b.room !== '') ? String(b.room).slice(0, 60) : null);
  const slotId = Number(result.lastInsertRowid);
  const ids = Array.isArray(b.student_ids) ? b.student_ids : (b.student_id ? [b.student_id] : []);
  for (const studentId of ids) {
    if (get('SELECT id FROM students WHERE id = ? AND school_id = ?', studentId, req.schoolId)) {
      run('INSERT OR IGNORE INTO slot_students (slot_id, student_id) VALUES (?, ?)', slotId, studentId);
    }
  }
  res.status(201).json(withStudents(get('SELECT * FROM schedule_slots WHERE id = ?', slotId)));
}));

// ---- date-specific exceptions (cancel a class on a date / one-time makeup class) ----

// GET /api/schedule/exceptions?from=YYYY-MM-DD&to=YYYY-MM-DD
r.get('/exceptions', wrap((req, res) => {
  const sid = req.schoolId;
  let rows = all(
    `SELECT e.*, s.name AS student_name, s.nickname AS student_nick, t.name AS teacher_name
       FROM schedule_exceptions e
       LEFT JOIN students s ON s.id = e.student_id
       LEFT JOIN teachers t ON t.id = e.teacher_id
      WHERE e.school_id = ? ORDER BY e.date`, sid);
  if (req.scopeOwn) rows = rows.filter((e) => e.teacher_id === req.teacherId);
  if (req.query.from) rows = rows.filter((e) => e.date >= req.query.from);
  if (req.query.to) rows = rows.filter((e) => e.date <= req.query.to);
  res.json(rows.map((e) => ({
    ...e,
    start: e.start_min != null ? hhmm(e.start_min) : null,
    end: e.end_min != null ? hhmm(e.end_min) : null,
  })));
}));

// GET /api/schedule/confirmations?date=YYYY-MM-DD — for that date, every student who
// has a class + their reply to the confirm-reminder (pending | confirmed | cancelled).
r.get('/confirmations', wrap((req, res) => {
  const sid = req.schoolId;
  const date = String(req.query.date || '');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw bad('date required (YYYY-MM-DD)');
  const dow = (new Date(date + 'T00:00:00Z').getUTCDay() + 6) % 7; // → Mon=0..Sun=6
  // recurring classes that weekday (minus a cancellation on this date)
  const recurring = all(
    `SELECT DISTINCT s.id, s.name, s.nickname, sl.teacher_id
       FROM slot_students ss
       JOIN schedule_slots sl ON sl.id = ss.slot_id
       JOIN students s ON s.id = ss.student_id
      WHERE sl.school_id = ? AND sl.day_of_week = ? AND s.status = 'active'
        AND NOT EXISTS (SELECT 1 FROM schedule_exceptions e
                         WHERE e.slot_id = sl.id AND e.type = 'cancel' AND e.date = ?)`,
    sid, dow, date);
  // one-off make-up classes that date
  const makeups = all(
    `SELECT DISTINCT s.id, s.name, s.nickname, e.teacher_id
       FROM schedule_exceptions e JOIN students s ON s.id = e.student_id
      WHERE e.school_id = ? AND e.type = 'makeup' AND e.date = ? AND s.status = 'active'`,
    sid, date);
  const map = new Map();
  [...recurring, ...makeups].forEach((x) => { if (!map.has(x.id)) map.set(x.id, x); });
  let list = [...map.values()];
  if (req.scopeOwn) list = list.filter((x) => x.teacher_id === req.teacherId);
  const cmap = {};
  all('SELECT student_id, status FROM class_confirmations WHERE school_id = ? AND date = ?', sid, date)
    .forEach((c) => { cmap[c.student_id] = c.status; });
  res.json(list
    .map((x) => ({ student_id: x.id, name: x.name, nickname: x.nickname, status: cmap[x.id] || 'pending' }))
    .sort((a, b) => a.name.localeCompare(b.name)));
}));

// POST /api/schedule/exceptions — { type, date, slot_id?, student_id?, teacher_id?, category?, start_min?, end_min?, note? }
r.post('/exceptions', canManage, wrap((req, res) => {
  const b = required(req.body, ['type', 'date']);
  if (!['cancel', 'makeup'].includes(b.type)) throw bad('invalid type');
  if (b.student_id && !get('SELECT id FROM students WHERE id = ? AND school_id = ?', b.student_id, req.schoolId)) throw bad('student not found', 404);
  if (b.teacher_id && !get('SELECT id FROM teachers WHERE id = ? AND school_id = ?', b.teacher_id, req.schoolId)) throw bad('teacher not found', 404);
  if (b.slot_id && !get('SELECT id FROM schedule_slots WHERE id = ? AND school_id = ?', b.slot_id, req.schoolId)) throw bad('slot not found', 404);
  const exRate = (b.rate != null && b.rate !== '') ? Math.max(0, parseInt(b.rate) || 0) : null;
  const result = run(
    `INSERT INTO schedule_exceptions (school_id, slot_id, date, type, student_id, teacher_id, category, start_min, end_min, note, rate)
     VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
    req.schoolId, b.slot_id || null, b.date, b.type, b.student_id || null, b.teacher_id || null,
    b.category || null, b.start_min != null ? b.start_min : null, b.end_min != null ? b.end_min : null, b.note || null, exRate);

  // notify the affected teacher that their schedule changed (pref-gated: t_change)
  let teacherId = b.teacher_id || null;
  if (!teacherId && b.slot_id) { const sl = get('SELECT teacher_id FROM schedule_slots WHERE id = ?', b.slot_id); teacherId = sl && sl.teacher_id; }
  if (teacherId) {
    const tm = (b.start_min != null && b.end_min != null) ? `\nเวลา ${hhmm(b.start_min)}–${hhmm(b.end_min)} น.` : '';
    const text = b.type === 'cancel'
      ? `🗓️ แจ้งยกเลิกคาบสอน\nวันที่ ${b.date}${tm}\nคาบนี้ถูกยกเลิกค่ะ`
      : `🗓️ เพิ่มคาบสอนชดเชย\nวันที่ ${b.date}${tm}\nรบกวนเตรียมสอนด้วยนะคะ`;
    maybeNotifyTeacher(req.schoolId, teacherId, 't_change', text);
  }
  res.status(201).json(get('SELECT * FROM schedule_exceptions WHERE id = ?', Number(result.lastInsertRowid)));
}));

r.delete('/exceptions/:id', canManage, wrap((req, res) => {
  const result = run('DELETE FROM schedule_exceptions WHERE id = ? AND school_id = ?', req.params.id, req.schoolId);
  if (!result.changes) throw bad('exception not found', 404);
  res.json({ ok: true });
}));

// PATCH /api/schedule/:id — update a recurring slot (used by drag-to-reschedule "move permanently")
r.patch('/:id', canManage, wrap((req, res) => {
  const slot = get('SELECT * FROM schedule_slots WHERE id = ? AND school_id = ?', req.params.id, req.schoolId);
  if (!slot) throw bad('slot not found', 404);
  const b = req.body || {};
  const sets = [], vals = [];
  const setNum = (field, v, lo, hi) => { const n = Math.max(lo, Math.min(hi, parseInt(v))); if (!Number.isNaN(n)) { sets.push(`${field} = ?`); vals.push(n); } };
  if (b.day_of_week !== undefined) setNum('day_of_week', b.day_of_week, 0, 6);
  if (b.start_min !== undefined) setNum('start_min', b.start_min, 0, 1439);
  if (b.end_min !== undefined) setNum('end_min', b.end_min, 1, 1440);
  if (b.teacher_id !== undefined) {
    if (b.teacher_id && !get('SELECT id FROM teachers WHERE id = ? AND school_id = ?', b.teacher_id, req.schoolId)) throw bad('teacher not found', 404);
    sets.push('teacher_id = ?'); vals.push(b.teacher_id || null);
  }
  if (b.category !== undefined) { sets.push('category = ?'); vals.push(b.category || null); }
  if (b.room !== undefined) { sets.push('room = ?'); vals.push((b.room === null || b.room === '') ? null : String(b.room).slice(0, 60)); }
  if (b.title !== undefined) { sets.push('title = ?'); vals.push(b.title || null); }
  if (!sets.length) throw bad('no fields to update');
  run(`UPDATE schedule_slots SET ${sets.join(', ')} WHERE id = ? AND school_id = ?`, ...vals, slot.id, req.schoolId);
  res.json(withStudents(get('SELECT * FROM schedule_slots WHERE id = ?', slot.id)));
}));

r.delete('/:id', canManage, wrap((req, res) => {
  const result = run('DELETE FROM schedule_slots WHERE id = ? AND school_id = ?', req.params.id, req.schoolId);
  if (!result.changes) throw bad('slot not found', 404);
  res.json({ ok: true });
}));

export default r;
