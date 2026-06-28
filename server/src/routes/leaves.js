import { Router } from 'express';
import { all, get, run } from '../db.js';
import { wrap, bad, hhmm } from '../util.js';
import { requireRole } from '../auth.js';
import { pushToParent, pushToTeacher } from '../line-push.js';

const r = Router();

const TH_MON = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
const thDate = (iso) => {
  const p = String(iso).slice(0, 10).split('-');
  return p.length === 3 ? `${parseInt(p[2], 10)} ${TH_MON[parseInt(p[1], 10) - 1]}` : iso;
};
const ISO = /^\d{4}-\d{2}-\d{2}$/;
// weekday of a YYYY-MM-DD date in the app's convention: Mon=0 .. Sun=6 (matches schedule_slots.day_of_week)
const dowOf = (iso) => (new Date(iso + 'T00:00:00Z').getUTCDay() + 6) % 7;

// inclusive list of YYYY-MM-DD strings from start..end, capped so a typo can't fan out forever.
function dateRange(start, end, cap = 92) {
  const out = [];
  const d = new Date(start + 'T00:00:00Z');
  const last = new Date(end + 'T00:00:00Z');
  while (d <= last && out.length < cap) {
    out.push(d.toISOString().slice(0, 10));
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return out;
}

const withTeacher = (id, sid) => get(
  `SELECT l.*, t.name AS teacher_name FROM teacher_leaves l
     JOIN teachers t ON t.id = l.teacher_id
    WHERE l.id = ? AND l.school_id = ?`, id, sid);

// GET /api/leaves?status=pending — owner/admin see all; a scoped teacher sees only their own.
r.get('/', wrap((req, res) => {
  let rows = all(
    `SELECT l.*, t.name AS teacher_name FROM teacher_leaves l
       JOIN teachers t ON t.id = l.teacher_id
      WHERE l.school_id = ? ORDER BY l.created_at DESC`, req.schoolId);
  if (req.scopeOwn) rows = rows.filter((x) => x.teacher_id === req.teacherId);
  if (req.query.status) rows = rows.filter((x) => x.status === req.query.status);
  res.json(rows);
}));

// POST /api/leaves — submit a leave request.
//   scoped teacher → always for themselves (teacher_id ignored / forced to req.teacherId)
//   owner/admin    → may log a leave on behalf of any teacher (teacher_id required)
r.post('/', wrap((req, res) => {
  const sid = req.schoolId;
  const b = req.body || {};
  let teacherId;
  if (req.scopeOwn) {
    teacherId = req.teacherId;
    if (!teacherId) throw bad('บัญชีนี้ยังไม่ได้เชื่อมกับข้อมูลครู ติดต่อผู้ดูแลระบบ', 400);
  } else {
    teacherId = Number(b.teacher_id);
    if (!teacherId) throw bad('ต้องระบุครูที่ต้องการแจ้งลา');
    if (!get('SELECT id FROM teachers WHERE id = ? AND school_id = ?', teacherId, sid)) throw bad('teacher not found', 404);
  }
  const start = String(b.start_date || '');
  const end = String(b.end_date || b.start_date || '');
  if (!ISO.test(start) || !ISO.test(end)) throw bad('รูปแบบวันที่ไม่ถูกต้อง (YYYY-MM-DD)');
  if (end < start) throw bad('วันสิ้นสุดต้องไม่อยู่ก่อนวันเริ่ม');
  const leaveType = ['sick', 'personal', 'other'].includes(b.leave_type) ? b.leave_type : 'personal';
  const reason = b.reason ? String(b.reason).slice(0, 500) : null;
  const result = run(
    `INSERT INTO teacher_leaves (school_id, teacher_id, start_date, end_date, leave_type, reason)
     VALUES (?,?,?,?,?,?)`,
    sid, teacherId, start, end, leaveType, reason);
  res.status(201).json(withTeacher(Number(result.lastInsertRowid), sid));
}));

// POST /api/leaves/:id/approve — cancel the teacher's classes on those dates + notify parents.
r.post('/:id/approve', requireRole('owner', 'admin'), wrap((req, res) => {
  const sid = req.schoolId;
  const leave = get('SELECT * FROM teacher_leaves WHERE id = ? AND school_id = ?', req.params.id, sid);
  if (!leave) throw bad('ไม่พบคำขอลานี้', 404);
  if (leave.status !== 'pending') throw bad('คำขอลานี้ถูกพิจารณาไปแล้ว');

  const teacher = get('SELECT name FROM teachers WHERE id = ? AND school_id = ?', leave.teacher_id, sid);
  const dates = dateRange(leave.start_date, leave.end_date);
  // studentId -> { nick, items:[{date, slot}] } so each parent gets ONE consolidated message
  const affected = new Map();
  let cancelledCount = 0;

  for (const date of dates) {
    const slots = all(
      'SELECT * FROM schedule_slots WHERE school_id = ? AND teacher_id = ? AND day_of_week = ?',
      sid, leave.teacher_id, dowOf(date));
    for (const slot of slots) {
      // don't duplicate a cancellation already recorded for this slot+date
      const existing = get(
        "SELECT id FROM schedule_exceptions WHERE school_id = ? AND slot_id = ? AND date = ? AND type = 'cancel'",
        sid, slot.id, date);
      if (!existing) {
        run(
          `INSERT INTO schedule_exceptions (school_id, slot_id, date, type, note)
           VALUES (?,?,?,'cancel',?)`,
          sid, slot.id, date, 'ครูลา');
        cancelledCount += 1;
      }
      const studs = all(
        `SELECT s.id, s.nickname, s.name FROM slot_students ss
           JOIN students s ON s.id = ss.student_id
          WHERE ss.slot_id = ? AND s.school_id = ?`, slot.id, sid);
      for (const s of studs) {
        if (!affected.has(s.id)) affected.set(s.id, { nick: s.nickname || s.name, items: [] });
        affected.get(s.id).items.push({ date, slot });
      }
    }
  }

  run(
    `UPDATE teacher_leaves
        SET status = 'approved', reviewed_by = ?, reviewed_at = datetime('now'), cancelled_count = ?
      WHERE id = ?`,
    req.user.uid, cancelledCount, leave.id);

  // fire-and-forget LINE notifications (never block the response on the LINE API)
  const tName = teacher ? teacher.name : 'ครู';
  for (const [studentId, info] of affected) {
    const lines = info.items
      .map((it) => `• ${thDate(it.date)} เวลา ${hhmm(it.slot.start_min)}–${hhmm(it.slot.end_min)}`)
      .join('\n');
    pushToParent(sid, studentId,
      `🔔 แจ้งงดคลาส\nเนื่องจาก${tName}ลา คลาสของน้อง${info.nick} ต่อไปนี้จะงดเรียนค่ะ:\n${lines}\n\nทางโรงเรียนจะติดต่อนัดเรียนชดเชยให้นะคะ 🙏`);
  }
  // let the teacher know their request went through
  pushToTeacher(sid, leave.teacher_id,
    `✅ คำขอลาของคุณ (${thDate(leave.start_date)}${leave.end_date !== leave.start_date ? `–${thDate(leave.end_date)}` : ''}) ได้รับการอนุมัติแล้วค่ะ` +
    (cancelledCount ? `\nระบบงดคลาสในตารางให้ ${cancelledCount} คาบ และแจ้งผู้ปกครองแล้ว` : ''));

  res.json({ ok: true, cancelled_count: cancelledCount, students_notified: affected.size });
}));

// POST /api/leaves/:id/reject
r.post('/:id/reject', requireRole('owner', 'admin'), wrap((req, res) => {
  const sid = req.schoolId;
  const leave = get('SELECT * FROM teacher_leaves WHERE id = ? AND school_id = ?', req.params.id, sid);
  if (!leave) throw bad('ไม่พบคำขอลานี้', 404);
  if (leave.status !== 'pending') throw bad('คำขอลานี้ถูกพิจารณาไปแล้ว');
  const note = req.body && req.body.note ? String(req.body.note).slice(0, 500) : null;
  run(
    `UPDATE teacher_leaves
        SET status = 'rejected', reviewed_by = ?, reviewed_at = datetime('now'), review_note = ?
      WHERE id = ?`,
    req.user.uid, note, leave.id);
  pushToTeacher(sid, leave.teacher_id,
    `❌ คำขอลาของคุณ (${thDate(leave.start_date)}${leave.end_date !== leave.start_date ? `–${thDate(leave.end_date)}` : ''}) ไม่ได้รับการอนุมัติค่ะ` +
    (note ? `\nหมายเหตุ: ${note}` : ''));
  res.json({ ok: true });
}));

// DELETE /api/leaves/:id — owner/admin anytime; the owning teacher may withdraw while still pending.
r.delete('/:id', wrap((req, res) => {
  const sid = req.schoolId;
  const leave = get('SELECT * FROM teacher_leaves WHERE id = ? AND school_id = ?', req.params.id, sid);
  if (!leave) throw bad('ไม่พบคำขอลานี้', 404);
  const isManager = req.role === 'owner' || req.role === 'admin';
  const isOwnPending = req.scopeOwn && leave.teacher_id === req.teacherId && leave.status === 'pending';
  if (!isManager && !isOwnPending) throw bad('forbidden', 403);
  run('DELETE FROM teacher_leaves WHERE id = ?', leave.id);
  res.json({ ok: true });
}));

export default r;
