import { Router } from 'express';
import { all, get } from '../db.js';
import { wrap, today, hhmm } from '../util.js';
import { ownStudentIds, pageAllows } from '../auth.js';

const r = Router();

// GET /api/dashboard — KPIs + near-limit alerts + today's classes (matches the prototype overview)
r.get('/', wrap((req, res) => {
  const sid = req.schoolId;
  const sch = get('SELECT near_limit_threshold FROM schools WHERE id = ?', sid);
  const month = today().slice(0, 7);
  const dow = (new Date().getDay() + 6) % 7; // JS Sun=0 -> our Mon=0..Sun=6

  // teachers scoped to 'own' see only their students/classes; revenue is finance-only.
  const ownSet = req.scopeOwn ? new Set(ownStudentIds(sid, req.teacherId)) : null;
  const seesMoney = pageAllows(req.perms, 'finance', 'view');

  let activeStudents = all("SELECT id, name, nickname, sessions_remaining, category FROM students WHERE school_id = ? AND status = 'active'", sid);
  if (ownSet) activeStudents = activeStudents.filter((s) => ownSet.has(s.id));

  const revenue = seesMoney ? get(
    `SELECT COALESCE(SUM(amount),0) t FROM invoices WHERE school_id = ? AND status='paid' AND substr(paid_at,1,7)=?`,
    sid, month).t : 0;
  const outstanding = seesMoney ? get(
    `SELECT COALESCE(SUM(amount),0) t, COUNT(*) c FROM invoices WHERE school_id = ? AND status='unpaid'`, sid)
    : { t: 0, c: 0 };

  let todayClasses = all(
    `SELECT sl.*, t.name AS teacher_name FROM schedule_slots sl
       LEFT JOIN teachers t ON t.id = sl.teacher_id
      WHERE sl.school_id = ? AND sl.day_of_week = ? ORDER BY sl.start_min`, sid, dow);
  if (req.scopeOwn) todayClasses = todayClasses.filter((s) => s.teacher_id === req.teacherId);
  todayClasses = todayClasses.map((s) => ({ ...s, start: hhmm(s.start_min), end: hhmm(s.end_min) }));

  const thr = sch.near_limit_threshold;
  const nearLimit = activeStudents
    .filter((s) => s.sessions_remaining <= thr)
    .sort((a, b) => a.sessions_remaining - b.sessions_remaining)
    .map((s) => ({ id: s.id, name: s.name, nickname: s.nickname, sessions_remaining: s.sessions_remaining }));

  const byCatMap = {};
  for (const s of activeStudents) { const k = s.category || ''; byCatMap[k] = (byCatMap[k] || 0) + 1; }
  const byCategory = Object.entries(byCatMap).map(([category, c]) => ({ category, c }));

  res.json({
    kpis: { students: activeStudents.length, classes_today: todayClasses.length, revenue_month: revenue,
            outstanding_amount: outstanding.t, outstanding_count: outstanding.c },
    today_classes: todayClasses,
    near_limit: nearLimit,
    by_category: byCategory,
  });
}));

export default r;
