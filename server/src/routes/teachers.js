import { Router } from 'express';
import crypto from 'node:crypto';
import { all, get, run } from '../db.js';
import { wrap, required, bad, hhmm } from '../util.js';
import { requirePage } from '../auth.js';

const r = Router();

// managing teacher records (+ seeing pay) is an owner/admin concern → teachers:manage
const canManage = requirePage('teachers', 'manage');

// GET /api/teachers — includes student count + estimated monthly pay (hours this month * rate)
r.get('/', wrap((req, res) => {
  const sid = req.schoolId;
  let teachers = all('SELECT * FROM teachers WHERE school_id = ? ORDER BY name', sid);
  // a teacher scoped to 'own' only sees their own record (no peers' pay/rates)
  if (req.scopeOwn) teachers = teachers.filter((t) => t.id === req.teacherId);
  res.json(teachers.map((t) => {
    const students = get('SELECT COUNT(*) c FROM students WHERE teacher_id = ? AND school_id = ?', t.id, sid).c;
    const minutes = get(
      `SELECT COALESCE(SUM(end_min - start_min),0) m FROM schedule_slots WHERE teacher_id = ? AND school_id = ?`,
      t.id, sid).m;
    const weeklyHours = minutes / 60;
    return { ...t, line_linked: !!t.line_user_id, students, weekly_hours: weeklyHours, est_monthly_pay: Math.round(weeklyHours * 4 * t.hourly_rate) };
  }));
}));

r.post('/', canManage, wrap((req, res) => {
  const b = required(req.body, ['name']);
  const cats = Array.isArray(b.categories) ? b.categories.filter(Boolean) : [];
  const primaryCat = cats[0] || b.category || null;
  const categoriesJson = cats.length ? JSON.stringify(cats) : null;
  const linkCode = 'T' + crypto.randomBytes(3).toString('hex').toUpperCase();
  const result = run(
    'INSERT INTO teachers (school_id, name, category, categories_json, hourly_rate, phone, line_id, link_code) VALUES (?,?,?,?,?,?,?,?)',
    req.schoolId, b.name, primaryCat, categoriesJson, b.hourly_rate || 0, b.phone || null, b.line_id || null, linkCode);
  res.status(201).json(get('SELECT * FROM teachers WHERE id = ? AND school_id = ?', Number(result.lastInsertRowid), req.schoolId));
}));

r.patch('/:id', canManage, wrap((req, res) => {
  const t = get('SELECT * FROM teachers WHERE id = ? AND school_id = ?', req.params.id, req.schoolId);
  if (!t) throw bad('teacher not found', 404);
  const fields = ['name', 'category', 'hourly_rate', 'phone', 'line_id'];
  const sets = [], vals = [];
  for (const f of fields) if (f in req.body) { sets.push(`${f} = ?`); vals.push(req.body[f]); }
  if ('categories' in req.body) {
    const arr = Array.isArray(req.body.categories) ? req.body.categories.filter(Boolean) : [];
    sets.push('categories_json = ?'); vals.push(arr.length ? JSON.stringify(arr) : null);
    if (!('category' in req.body)) { sets.push('category = ?'); vals.push(arr[0] || null); }
  }
  if (!sets.length) throw bad('no fields to update');
  run(`UPDATE teachers SET ${sets.join(', ')} WHERE id = ? AND school_id = ?`, ...vals, t.id, req.schoolId);
  res.json(get('SELECT * FROM teachers WHERE id = ? AND school_id = ?', t.id, req.schoolId));
}));

// GET /api/teachers/:id/payslip?month=YYYY-MM — pay from classes ACTUALLY taught (attendance-based)
r.get('/:id/payslip', wrap((req, res) => {
  // a scoped teacher may only view their own payslip; owner/admin/finance see any
  if (req.scopeOwn && Number(req.params.id) !== req.teacherId) throw bad('teacher not found', 404);
  const t = get('SELECT * FROM teachers WHERE id = ? AND school_id = ?', req.params.id, req.schoolId);
  if (!t) throw bad('teacher not found', 404);
  const month = (req.query.month || new Date().toISOString().slice(0, 7));

  const defRate = t.hourly_rate || 0;
  // one "taught session" = a (slot, date) where attendance was recorded with >=1 present student
  const sessions = all(
    `SELECT a.date, a.slot_id, sl.start_min, sl.end_min, sl.category, sl.rate AS rate, sl.is_group AS is_group,
            COUNT(*) AS marks,
            SUM(CASE WHEN a.status = 'present' THEN 1 ELSE 0 END) AS present
       FROM attendance a
       JOIN schedule_slots sl ON sl.id = a.slot_id
      WHERE sl.teacher_id = ? AND a.school_id = ? AND substr(a.date,1,7) = ?
      GROUP BY a.slot_id, a.date
      ORDER BY a.date`, t.id, req.schoolId, month);

  const taught = sessions.filter((s) => s.present > 0);
  let totalMin = 0, totalPay = 0;
  const rows = taught.map((s) => {
    const dur = (s.end_min || 0) - (s.start_min || 0);
    const rate = (s.rate != null) ? s.rate : defRate;
    totalMin += dur; totalPay += (dur / 60) * rate;
    return {
      date: s.date, category: s.category,
      start: hhmm(s.start_min), end: hhmm(s.end_min),
      minutes: dur, students: s.present, makeup: false, group: !!s.is_group, rate,
    };
  });

  // makeup classes this teacher taught (attendance linked to a makeup exception)
  const makeups = all(
    `SELECT e.id, e.date, e.category, e.start_min, e.end_min, e.rate AS rate,
            SUM(CASE WHEN a.status = 'present' THEN 1 ELSE 0 END) AS present
       FROM attendance a
       JOIN schedule_exceptions e ON e.id = a.exception_id
      WHERE e.teacher_id = ? AND e.type = 'makeup' AND a.school_id = ? AND substr(a.date,1,7) = ?
      GROUP BY e.id
      ORDER BY e.date`, t.id, req.schoolId, month);
  for (const m of makeups.filter((x) => x.present > 0)) {
    const dur = (m.end_min || 0) - (m.start_min || 0);
    const rate = (m.rate != null) ? m.rate : defRate;
    totalMin += dur; totalPay += (dur / 60) * rate;
    rows.push({ date: m.date, category: m.category, start: hhmm(m.start_min), end: hhmm(m.end_min), minutes: dur, students: m.present, makeup: true, rate });
  }
  rows.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  const actualHours = +(totalMin / 60).toFixed(2);

  // theoretical (recurring schedule × 4 weeks) for comparison
  const weeklyMin = get(
    'SELECT COALESCE(SUM(end_min - start_min),0) m FROM schedule_slots WHERE teacher_id = ? AND school_id = ?',
    t.id, req.schoolId).m;
  const theoreticalHours = +((weeklyMin * 4) / 60).toFixed(2);

  res.json({
    teacher: { name: t.name, phone: t.phone, rate: t.hourly_rate },
    month,
    actual_hours: actualHours,
    theoretical_hours: theoreticalHours,
    sessions_count: rows.length,
    pay: Math.round(totalPay),
    sessions: rows,
  });
}));

r.delete('/:id', canManage, wrap((req, res) => {
  const result = run('DELETE FROM teachers WHERE id = ? AND school_id = ?', req.params.id, req.schoolId);
  if (!result.changes) throw bad('teacher not found', 404);
  res.json({ ok: true });
}));

export default r;
