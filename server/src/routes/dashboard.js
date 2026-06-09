import { Router } from 'express';
import { all, get } from '../db.js';
import { wrap, today, hhmm } from '../util.js';

const r = Router();

// GET /api/dashboard — KPIs + near-limit alerts + today's classes (matches the prototype overview)
r.get('/', wrap((req, res) => {
  const sid = req.schoolId;
  const sch = get('SELECT near_limit_threshold FROM schools WHERE id = ?', sid);
  const month = today().slice(0, 7);
  const dow = (new Date().getDay() + 6) % 7; // JS Sun=0 -> our Mon=0..Sun=6

  const students = get("SELECT COUNT(*) c FROM students WHERE school_id = ? AND status = 'active'", sid).c;
  const revenue = get(
    `SELECT COALESCE(SUM(amount),0) t FROM invoices WHERE school_id = ? AND status='paid' AND substr(paid_at,1,7)=?`,
    sid, month).t;
  const outstanding = get(
    `SELECT COALESCE(SUM(amount),0) t, COUNT(*) c FROM invoices WHERE school_id = ? AND status='unpaid'`, sid);

  const todayClasses = all(
    `SELECT sl.*, t.name AS teacher_name FROM schedule_slots sl
       LEFT JOIN teachers t ON t.id = sl.teacher_id
      WHERE sl.school_id = ? AND sl.day_of_week = ? ORDER BY sl.start_min`, sid, dow)
    .map((s) => ({ ...s, start: hhmm(s.start_min), end: hhmm(s.end_min) }));

  const nearLimit = all(
    "SELECT id, name, nickname, sessions_remaining FROM students WHERE school_id = ? AND sessions_remaining <= ? AND status='active' ORDER BY sessions_remaining",
    sid, sch.near_limit_threshold);

  const byCategory = all(
    "SELECT category, COUNT(*) c FROM students WHERE school_id = ? AND status='active' GROUP BY category", sid);

  res.json({
    kpis: { students, classes_today: todayClasses.length, revenue_month: revenue,
            outstanding_amount: outstanding.t, outstanding_count: outstanding.c },
    today_classes: todayClasses,
    near_limit: nearLimit,
    by_category: byCategory,
  });
}));

export default r;
