import { Router } from 'express';
import { all, get, run } from '../db.js';
import { wrap, required, bad, today } from '../util.js';
import { maybeNotify, maybeNotifyTeacher } from '../line-push.js';
import { requirePage, ownStudentIds } from '../auth.js';

// resolve the teaching teacher_id from a class (recurring slot or makeup exception)
function classTeacherId(b) {
  if (b.slot_id) { const sl = get('SELECT teacher_id FROM schedule_slots WHERE id = ?', b.slot_id); if (sl) return sl.teacher_id; }
  if (b.exception_id) { const ex = get('SELECT teacher_id FROM schedule_exceptions WHERE id = ?', b.exception_id); if (ex) return ex.teacher_id; }
  return null;
}

const r = Router();
const POINTS_PER_ATTEND = 10; // matches prototype: present = +10 points

// GET /api/attendance?date=YYYY-MM-DD  OR  ?student_id=N (history for one student)
r.get('/', wrap((req, res) => {
  const sid = req.schoolId;
  // teachers scoped to 'own' only see their own students' attendance
  const ownSet = req.scopeOwn ? new Set(ownStudentIds(sid, req.teacherId)) : null;
  // Per-student attendance history (last 30 records)
  if (req.query.student_id) {
    if (ownSet && !ownSet.has(Number(req.query.student_id))) throw bad('student not found', 404);
    const rows = all(
      `SELECT a.*, s.name AS student_name FROM attendance a
         JOIN students s ON s.id = a.student_id
        WHERE a.school_id = ? AND a.student_id = ?
        ORDER BY a.date DESC, a.created_at DESC LIMIT 30`, sid, req.query.student_id);
    return res.json({ student_id: req.query.student_id, records: rows });
  }
  // By date (default today)
  const date = req.query.date || today();
  let rows = all(
    `SELECT a.*, s.name AS student_name FROM attendance a
       JOIN students s ON s.id = a.student_id
      WHERE a.school_id = ? AND a.date = ? ORDER BY a.created_at DESC`, sid, date);
  if (ownSet) rows = rows.filter((a) => ownSet.has(a.student_id));
  const summary = { present: 0, absent: 0, leave: 0 };
  rows.forEach((a) => { summary[a.status] = (summary[a.status] || 0) + 1; });
  res.json({ date, summary, records: rows });
}));

// resolve the subject category of a class from its slot / makeup exception
function classCategory(b) {
  if (b.category) return b.category;
  if (b.slot_id) { const sl = get('SELECT category FROM schedule_slots WHERE id = ?', b.slot_id); if (sl) return sl.category; }
  if (b.exception_id) { const ex = get('SELECT category FROM schedule_exceptions WHERE id = ?', b.exception_id); if (ex) return ex.category; }
  return null;
}

// adjust a specific subject's remaining inside packages_json (+/- 1, clamped)
function adjustPackage(student, category, delta) {
  if (!student.packages_json) return null;
  try {
    const arr = JSON.parse(student.packages_json);
    if (!Array.isArray(arr) || !arr.length) return null;
    let idx = arr.findIndex((p) => p.category === category);
    if (idx < 0) idx = 0; // no exact subject match → fall back to first enrollment
    const p = arr[idx];
    p.sessions_remaining = Math.max(0, Math.min(p.sessions_total || 0, (p.sessions_remaining || 0) + delta));
    return JSON.stringify(arr);
  } catch { return null; }
}

// POST /api/attendance — mark a student. status: present|absent|leave|clear
// Server is the SINGLE SOURCE OF TRUTH and fully idempotent: it looks up the existing
// mark for this exact class-instance (student + date + same slot or same makeup
// exception) and derives the previous state from the DB — NOT from the client. This
// means repeat clicks, "mark all", page reloads, or two devices can never double-count
// a session or pile up duplicate rows. The client's prev_present field is ignored.
r.post('/', requirePage('attendance', 'manage'), wrap((req, res) => {
  const b = required(req.body, ['student_id', 'status']);
  if (!['present', 'absent', 'leave', 'clear'].includes(b.status)) throw bad('invalid status');
  if (req.scopeOwn && !ownStudentIds(req.schoolId, req.teacherId).includes(Number(b.student_id))) throw bad('student not found', 404);
  const student = get('SELECT * FROM students WHERE id = ? AND school_id = ?', b.student_id, req.schoolId);
  if (!student) throw bad('student not found', 404);
  const date = b.date || today();

  // the one existing mark for this class-instance (if any)
  const existing = get(
    `SELECT * FROM attendance
       WHERE school_id = ? AND student_id = ? AND date = ?
         AND IFNULL(slot_id, 0) = IFNULL(?, 0)
         AND IFNULL(exception_id, 0) = IFNULL(?, 0)
       ORDER BY id LIMIT 1`,
    req.schoolId, student.id, date, b.slot_id || null, b.exception_id || null);

  const prevStatus = existing ? existing.status : null;
  const wasPresent = prevStatus === 'present';
  const nowPresent = b.status === 'present';
  const becameP = nowPresent && !wasPresent;
  const leftP   = !nowPresent && wasPresent;
  const statusChanged = b.status !== prevStatus;

  let remainingAfter = student.sessions_remaining;
  // captured here (outer scope) so the near-limit notification block further down can read
  // them — declaring these inside the if-block below threw "subjectRemaining is not defined"
  // on every present mark (the notification runs in a separate `if (becameP)` block).
  let subjectRemaining = null;
  let subjectLabel = null;
  if (becameP || leftP) {
    const d = becameP ? -1 : 1;
    remainingAfter = Math.max(0, student.sessions_remaining + d);
    const pkgJson = adjustPackage(student, classCategory(b), d);
    // capture per-subject remaining so the near-limit notification is per-course, not aggregate
    if (pkgJson && becameP) {
      try {
        const cat = classCategory(b);
        const arr = JSON.parse(pkgJson);
        let pkg = cat ? arr.find((p) => p.category === cat) : null;
        if (!pkg) pkg = arr[0];
        if (pkg) { subjectRemaining = pkg.sessions_remaining; subjectLabel = pkg.name || pkg.category || null; }
      } catch { /* ignore */ }
    }
    // compute the new balance here (0-floored) so we can log the ACTUAL points change to the
    // ledger — both on earn (present) and refund (un-mark). Otherwise the refund adjusted the
    // balance without a ledger row and SUM(ledger) drifted away from students.points.
    const nominal = becameP ? POINTS_PER_ATTEND : -POINTS_PER_ATTEND;
    const newPoints = Math.max(0, (student.points || 0) + nominal);
    const appliedDelta = newPoints - (student.points || 0);
    if (pkgJson != null) run('UPDATE students SET sessions_remaining = ?, points = ?, packages_json = ? WHERE id = ? AND school_id = ?',
      remainingAfter, newPoints, pkgJson, student.id, req.schoolId);
    else run('UPDATE students SET sessions_remaining = ?, points = ? WHERE id = ? AND school_id = ?',
      remainingAfter, newPoints, student.id, req.schoolId);
    if (appliedDelta !== 0) run('INSERT INTO points_ledger (school_id, student_id, delta, reason) VALUES (?,?,?,?)',
      req.schoolId, student.id, appliedDelta, becameP ? 'เช็คชื่อเข้าเรียน' : 'ยกเลิกเช็คชื่อ');
  }

  // upsert the single row: update in place, insert if new, delete on clear
  let recId = existing ? existing.id : null;
  if (b.status === 'clear') {
    if (existing) run('DELETE FROM attendance WHERE id = ? AND school_id = ?', existing.id, req.schoolId);
    recId = null;
  } else if (existing) {
    run('UPDATE attendance SET status = ?, points_awarded = ?, slot_id = ?, exception_id = ? WHERE id = ? AND school_id = ?',
      b.status, nowPresent ? POINTS_PER_ATTEND : 0, b.slot_id || null, b.exception_id || null, existing.id, req.schoolId);
  } else {
    const result = run(
      'INSERT INTO attendance (school_id, student_id, slot_id, date, status, points_awarded, exception_id) VALUES (?,?,?,?,?,?,?)',
      req.schoolId, student.id, b.slot_id || null, date, b.status, nowPresent ? POINTS_PER_ATTEND : 0, b.exception_id || null);
    recId = Number(result.lastInsertRowid);
  }

  // notify only when the status actually CHANGED to absent/leave (no duplicate LINE spam)
  if ((b.status === 'absent' || b.status === 'leave') && statusChanged) {
    const word = b.status === 'absent' ? 'ขาดเรียน' : 'ลาเรียน';
    maybeNotify(req.schoolId, student.id, 'absent',
      `🔔 แจ้งการเข้าเรียน\nวันที่ ${date} น้อง${student.nickname || student.name} ${word}ค่ะ`);
    // also let the teaching teacher know a student in their class is out
    const tId = classTeacherId(b);
    if (tId) maybeNotifyTeacher(req.schoolId, tId, 't_absent',
      `🔔 นักเรียนในคาบ${word}\nวันที่ ${date} น้อง${student.nickname || student.name} ${word}ค่ะ`);
  }
  if (becameP) {
    const sch = get('SELECT near_limit_threshold FROM schools WHERE id = ?', req.schoolId);
    const thr = (sch && sch.near_limit_threshold) || 2;
    // for multi-subject students: check per-subject remaining (not aggregate)
    const checkRemaining = subjectRemaining !== null ? subjectRemaining : remainingAfter;
    if (checkRemaining > 0 && checkRemaining <= thr) {
      const prefix = subjectLabel ? `วิชา${subjectLabel}` : `คอร์ส`;
      maybeNotify(req.schoolId, student.id, 'near_limit',
        `⏰ ${prefix}ของน้อง${student.nickname || student.name} เหลืออีก ${checkRemaining} ครั้ง\nควรต่อคอร์สเพื่อเรียนต่อเนื่องค่ะ 🎵`);
    }
  }

  const updated = get('SELECT id, name, sessions_remaining, points, packages_json FROM students WHERE id = ? AND school_id = ?', student.id, req.schoolId);
  res.status(201).json({
    attendance: recId ? get('SELECT * FROM attendance WHERE id = ?', recId) : null,
    student: updated,
  });
}));

export default r;
