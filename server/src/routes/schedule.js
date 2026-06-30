import { Router } from 'express';
import { all, get, run } from '../db.js';
import { wrap, required, bad, hhmm } from '../util.js';
import { maybeNotifyTeacher, pushToParent } from '../line-push.js';
import { requirePage, requireFeature } from '../auth.js';

const r = Router();

// managing the timetable (create/move/cancel classes) needs schedule:manage
const canManage = requirePage('schedule', 'manage');
// publishing self-service bookable sessions is an ACADEMY+ feature
const canBook = requireFeature('booking', 'จองคลาสออนไลน์ใช้ได้ในแผน ACADEMY ขึ้นไป — อัปเกรดเพื่อเปิดใช้งาน');

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

// ---- school-wide calendar events & holidays (informational markers on the week view) ----
const EVENT_TYPES = ['event', 'holiday'];

// GET /api/schedule/events?from=YYYY-MM-DD&to=YYYY-MM-DD — markers overlapping the range
r.get('/events', wrap((req, res) => {
  let rows = all('SELECT * FROM calendar_events WHERE school_id = ? ORDER BY date', req.schoolId);
  if (req.query.from) rows = rows.filter((e) => (e.end_date || e.date) >= req.query.from);
  if (req.query.to) rows = rows.filter((e) => e.date <= req.query.to);
  res.json(rows);
}));

// POST /api/schedule/events — { type, title, date, end_date?, note? }
r.post('/events', canManage, wrap((req, res) => {
  const b = required(req.body, ['title', 'date']);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(b.date)) throw bad('date must be YYYY-MM-DD');
  if (b.end_date && !/^\d{4}-\d{2}-\d{2}$/.test(b.end_date)) throw bad('end_date must be YYYY-MM-DD');
  const type = EVENT_TYPES.includes(b.type) ? b.type : 'event';
  const end = (b.end_date && b.end_date >= b.date) ? b.end_date : null;
  const title = String(b.title).trim().slice(0, 120);
  if (!title) throw bad('title required');
  const result = run(
    `INSERT INTO calendar_events (school_id, type, title, date, end_date, note) VALUES (?,?,?,?,?,?)`,
    req.schoolId, type, title, b.date, end, (b.note != null && b.note !== '') ? String(b.note).slice(0, 500) : null);
  res.status(201).json(get('SELECT * FROM calendar_events WHERE id = ?', Number(result.lastInsertRowid)));
}));

r.delete('/events/:id', canManage, wrap((req, res) => {
  const result = run('DELETE FROM calendar_events WHERE id = ? AND school_id = ?', req.params.id, req.schoolId);
  if (!result.changes) throw bad('event not found', 404);
  res.json({ ok: true });
}));

// ============================================================================
//  Self-service bookable sessions (admin side). Parents/prospects book seats in
//  these through the public /api/public/book routes. One table, many `kind`s.
// ============================================================================

const KINDS = ['group', 'private', 'makeup', 'trial'];
const OPEN_TO = ['existing', 'public', 'both'];

// count seats taken (a cancelled/no_show booking frees the seat back up)
const seatsTaken = (sessionId) =>
  get(`SELECT COUNT(*) AS n FROM bookings WHERE session_id = ? AND status IN ('booked','attended')`, sessionId).n;

const withCounts = (s) => {
  const booked = seatsTaken(s.id);
  return { ...s, start: hhmm(s.start_min), end: hhmm(s.end_min), booked, seats_left: Math.max(0, s.capacity - booked) };
};

// GET /api/schedule/sessions?from=YYYY-MM-DD&to=YYYY-MM-DD&kind=
r.get('/sessions', wrap((req, res) => {
  let rows = all(
    `SELECT bs.*, t.name AS teacher_name FROM bookable_sessions bs
       LEFT JOIN teachers t ON t.id = bs.teacher_id
      WHERE bs.school_id = ? ORDER BY bs.date, bs.start_min`, req.schoolId);
  if (req.scopeOwn) rows = rows.filter((s) => s.teacher_id === req.teacherId);
  if (req.query.from) rows = rows.filter((s) => s.date >= req.query.from);
  if (req.query.to) rows = rows.filter((s) => s.date <= req.query.to);
  if (req.query.kind) rows = rows.filter((s) => s.kind === req.query.kind);
  res.json(rows.map(withCounts));
}));

// POST /api/schedule/sessions — publish a bookable session
r.post('/sessions', canManage, canBook, wrap((req, res) => {
  const b = required(req.body, ['date', 'start_min', 'end_min']);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(b.date)) throw bad('date must be YYYY-MM-DD');
  const kind = KINDS.includes(b.kind) ? b.kind : 'group';
  const openTo = OPEN_TO.includes(b.open_to) ? b.open_to : 'existing';
  if (b.teacher_id && !get('SELECT id FROM teachers WHERE id = ? AND school_id = ?', b.teacher_id, req.schoolId)) throw bad('teacher not found', 404);
  const cap = Math.max(1, parseInt(b.capacity) || (kind === 'group' ? 6 : 1));
  const fee = (b.fee != null && b.fee !== '') ? Math.max(0, parseInt(b.fee) || 0) : null;
  const result = run(
    `INSERT INTO bookable_sessions (school_id, teacher_id, kind, title, category, date, start_min, end_min, capacity, room, fee, open_to, note)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    req.schoolId, b.teacher_id || null, kind, b.title || null, b.category || null, b.date,
    b.start_min, b.end_min, cap, (b.room != null && b.room !== '') ? String(b.room).slice(0, 60) : null,
    fee, openTo, b.note || null);
  res.status(201).json(withCounts(get('SELECT * FROM bookable_sessions WHERE id = ?', Number(result.lastInsertRowid))));
}));

// PATCH /api/schedule/sessions/:id — edit a session (incl. open/close/cancel via status)
r.patch('/sessions/:id', canManage, wrap((req, res) => {
  const s = get('SELECT * FROM bookable_sessions WHERE id = ? AND school_id = ?', req.params.id, req.schoolId);
  if (!s) throw bad('session not found', 404);
  const b = req.body || {};
  const sets = [], vals = [];
  const push = (col, v) => { sets.push(`${col} = ?`); vals.push(v); };
  if (b.title !== undefined) push('title', b.title || null);
  if (b.category !== undefined) push('category', b.category || null);
  if (b.room !== undefined) push('room', (b.room === '' || b.room === null) ? null : String(b.room).slice(0, 60));
  if (b.note !== undefined) push('note', b.note || null);
  if (b.date !== undefined) { if (!/^\d{4}-\d{2}-\d{2}$/.test(b.date)) throw bad('date must be YYYY-MM-DD'); push('date', b.date); }
  if (b.start_min !== undefined) push('start_min', Math.max(0, Math.min(1439, parseInt(b.start_min) || 0)));
  if (b.end_min !== undefined) push('end_min', Math.max(1, Math.min(1440, parseInt(b.end_min) || 0)));
  if (b.capacity !== undefined) push('capacity', Math.max(1, parseInt(b.capacity) || 1));
  if (b.fee !== undefined) push('fee', (b.fee === '' || b.fee === null) ? null : Math.max(0, parseInt(b.fee) || 0));
  if (b.kind !== undefined && KINDS.includes(b.kind)) push('kind', b.kind);
  if (b.open_to !== undefined && OPEN_TO.includes(b.open_to)) push('open_to', b.open_to);
  if (b.status !== undefined && ['open', 'closed', 'cancelled'].includes(b.status)) push('status', b.status);
  if (b.teacher_id !== undefined) {
    if (b.teacher_id && !get('SELECT id FROM teachers WHERE id = ? AND school_id = ?', b.teacher_id, req.schoolId)) throw bad('teacher not found', 404);
    push('teacher_id', b.teacher_id || null);
  }
  if (!sets.length) throw bad('no fields to update');
  run(`UPDATE bookable_sessions SET ${sets.join(', ')} WHERE id = ? AND school_id = ?`, ...vals, s.id, req.schoolId);
  res.json(withCounts(get('SELECT * FROM bookable_sessions WHERE id = ?', s.id)));
}));

// DELETE /api/schedule/sessions/:id
r.delete('/sessions/:id', canManage, wrap((req, res) => {
  const result = run('DELETE FROM bookable_sessions WHERE id = ? AND school_id = ?', req.params.id, req.schoolId);
  if (!result.changes) throw bad('session not found', 404);
  res.json({ ok: true });
}));

// GET /api/schedule/sessions/:id/bookings — who has booked this session
r.get('/sessions/:id/bookings', wrap((req, res) => {
  const s = get('SELECT id FROM bookable_sessions WHERE id = ? AND school_id = ?', req.params.id, req.schoolId);
  if (!s) throw bad('session not found', 404);
  const rows = all(
    `SELECT b.*, st.name AS student_name, st.nickname AS student_nick
       FROM bookings b LEFT JOIN students st ON st.id = b.student_id
      WHERE b.session_id = ? ORDER BY b.created_at`, s.id);
  res.json(rows.map((b) => ({
    id: b.id, status: b.status, note: b.note, created_at: b.created_at,
    student_id: b.student_id,
    name: b.student_name || b.booker_name || '—',
    nickname: b.student_nick || null,
    phone: b.booker_phone || null,
    line: b.booker_line || null,
    is_prospect: !b.student_id,
  })));
}));

// PATCH /api/schedule/bookings/:id — mark attended / no_show / cancel
r.patch('/bookings/:id', canManage, wrap((req, res) => {
  const bk = get(
    `SELECT b.* FROM bookings b WHERE b.id = ? AND b.school_id = ?`, req.params.id, req.schoolId);
  if (!bk) throw bad('booking not found', 404);
  const status = req.body && req.body.status;
  if (!['booked', 'cancelled', 'attended', 'no_show'].includes(status)) throw bad('invalid status');
  run('UPDATE bookings SET status = ? WHERE id = ? AND school_id = ?', status, bk.id, req.schoolId);
  res.json({ ok: true });
}));

// ============================================================================
//  Make-up requests (admin side). Parents propose a make-up day/time/subject via
//  the public booking link; an owner/admin approves (→ lands on the timetable as a
//  schedule_exceptions 'makeup' row + notifies parent/teacher) or rejects.
//  NOTE: registered before the '/:id' catch-all so "makeup-requests" isn't read as an id.
// ============================================================================

const THMON = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
const thDate = (iso) => { const p = String(iso || '').slice(0, 10).split('-'); return p.length === 3 ? `${parseInt(p[2], 10)} ${THMON[parseInt(p[1], 10) - 1]}` : iso; };

const makeupRow = (id, sid) => get(
  `SELECT m.*, s.name AS student_name, s.nickname AS student_nick, t.name AS teacher_name
     FROM makeup_requests m
     JOIN students s ON s.id = m.student_id
     LEFT JOIN teachers t ON t.id = m.teacher_id
    WHERE m.id = ? AND m.school_id = ?`, id, sid);

const shapeMakeup = (m) => ({
  ...m,
  start: hhmm(m.start_min),
  end: hhmm(m.end_min),
});

// GET /api/schedule/makeup-requests?status=pending — list requests (own-scoped teachers
// don't manage these, so they see all of their school's; admins see all).
r.get('/makeup-requests', wrap((req, res) => {
  let rows = all(
    `SELECT m.*, s.name AS student_name, s.nickname AS student_nick, t.name AS teacher_name
       FROM makeup_requests m
       JOIN students s ON s.id = m.student_id
       LEFT JOIN teachers t ON t.id = m.teacher_id
      WHERE m.school_id = ? ORDER BY m.created_at DESC`, req.schoolId);
  if (req.query.status) rows = rows.filter((m) => m.status === req.query.status);
  res.json(rows.map(shapeMakeup));
}));

// POST /api/schedule/makeup-requests/:id/approve — body { teacher_id?, note? }
r.post('/makeup-requests/:id/approve', canManage, wrap((req, res) => {
  const sid = req.schoolId;
  const m = get('SELECT * FROM makeup_requests WHERE id = ? AND school_id = ?', req.params.id, sid);
  if (!m) throw bad('ไม่พบคำขอนี้', 404);
  if (m.status !== 'pending') throw bad('คำขอนี้ถูกพิจารณาไปแล้ว');
  const b = req.body || {};
  let teacherId = (b.teacher_id != null && b.teacher_id !== '') ? Number(b.teacher_id) : null;
  if (teacherId && !get('SELECT id FROM teachers WHERE id = ? AND school_id = ?', teacherId, sid)) throw bad('teacher not found', 404);
  const note = b.note ? String(b.note).slice(0, 500) : null;

  // land the makeup on the live timetable
  const exRes = run(
    `INSERT INTO schedule_exceptions (school_id, slot_id, date, type, student_id, teacher_id, category, start_min, end_min, note)
     VALUES (?,?,?,?,?,?,?,?,?,?)`,
    sid, null, m.date, 'makeup', m.student_id, teacherId, m.category || null,
    m.start_min, m.end_min, 'เรียนชดเชย (อนุมัติคำขอผู้ปกครอง)');
  const exceptionId = Number(exRes.lastInsertRowid);

  run(
    `UPDATE makeup_requests
        SET status = 'approved', teacher_id = ?, exception_id = ?, reviewed_by = ?, reviewed_at = datetime('now'), review_note = ?
      WHERE id = ?`,
    teacherId, exceptionId, req.user.uid, note, m.id);

  const tm = `${hhmm(m.start_min)}–${hhmm(m.end_min)} น.`;
  // notify the assigned teacher (pref-gated) + confirm with the parent over LINE
  if (teacherId) {
    maybeNotifyTeacher(sid, teacherId, 't_change',
      `🗓️ เพิ่มคาบสอนชดเชย\nวันที่ ${thDate(m.date)} เวลา ${tm}\nรบกวนเตรียมสอนด้วยนะคะ`);
  }
  pushToParent(sid, m.student_id,
    `✅ คำขอเรียนชดเชยได้รับการอนุมัติแล้วค่ะ\n📅 ${thDate(m.date)} เวลา ${tm}`).catch(() => {});

  res.json(shapeMakeup(makeupRow(m.id, sid)));
}));

// POST /api/schedule/makeup-requests/:id/reject — body { note? }
r.post('/makeup-requests/:id/reject', canManage, wrap((req, res) => {
  const sid = req.schoolId;
  const m = get('SELECT * FROM makeup_requests WHERE id = ? AND school_id = ?', req.params.id, sid);
  if (!m) throw bad('ไม่พบคำขอนี้', 404);
  if (m.status !== 'pending') throw bad('คำขอนี้ถูกพิจารณาไปแล้ว');
  const note = (req.body && req.body.note) ? String(req.body.note).slice(0, 500) : null;
  run(
    `UPDATE makeup_requests
        SET status = 'rejected', reviewed_by = ?, reviewed_at = datetime('now'), review_note = ?
      WHERE id = ?`,
    req.user.uid, note, m.id);
  pushToParent(sid, m.student_id,
    `ขออภัยค่ะ คำขอเรียนชดเชย (${thDate(m.date)} ${hhmm(m.start_min)}–${hhmm(m.end_min)} น.) ยังไม่สามารถจัดให้ได้` +
    (note ? `\nหมายเหตุ: ${note}` : '\nรบกวนติดต่อทางโรงเรียนเพื่อนัดวันใหม่นะคะ')).catch(() => {});
  res.json(shapeMakeup(makeupRow(m.id, sid)));
}));

// DELETE /api/schedule/makeup-requests/:id — remove a request from the list. If it was
// approved, also pull the makeup off the timetable (delete its schedule_exceptions row).
r.delete('/makeup-requests/:id', canManage, wrap((req, res) => {
  const sid = req.schoolId;
  const m = get('SELECT * FROM makeup_requests WHERE id = ? AND school_id = ?', req.params.id, sid);
  if (!m) throw bad('ไม่พบคำขอนี้', 404);
  if (m.exception_id) run('DELETE FROM schedule_exceptions WHERE id = ? AND school_id = ?', m.exception_id, sid);
  run('DELETE FROM makeup_requests WHERE id = ? AND school_id = ?', m.id, sid);
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
