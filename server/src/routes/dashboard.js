import { Router } from 'express';
import { all, get } from '../db.js';
import { wrap, today, hhmm, nearLimitInfo } from '../util.js';
import { ownStudentIds, pageAllows, requireFeature } from '../auth.js';

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

  let activeStudents = all("SELECT id, name, nickname, sessions_remaining, category, packages_json FROM students WHERE school_id = ? AND status = 'active'", sid);
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
    .map((s) => ({ s, nl: nearLimitInfo(s, thr) }))
    .filter((x) => x.nl.near)
    // show the subject's own remaining (per-course) when it's a multi-subject hit
    .map((x) => ({ id: x.s.id, name: x.s.name, nickname: x.s.nickname, sessions_remaining: x.nl.remaining, subject: x.nl.perSubject ? (x.nl.name || x.nl.category || null) : null }))
    .sort((a, b) => a.sessions_remaining - b.sessions_remaining);

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

// ---- analytics: 12-month history + linear-regression forecast --------------

// the last `n` month keys (YYYY-MM), oldest first, ending with the current month.
function lastMonths(n) {
  const now = new Date();
  const out = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    out.push(`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`);
  }
  return out;
}

// Least-squares linear trend over the COMPLETE months (the partial current month is
// excluded from the fit so a half-finished month can't drag the slope down), then
// project forward. The first projected point is the current month's full-month
// estimate; the rest are future months. A ±1σ residual band gives lo/hi. Leading
// all-zero months (before the school had any data — e.g. it was created 2 months ago)
// are trimmed so phantom pre-existence zeros can't flatten the trend. Falls back to a
// flat mean, flagged unreliable, when there's too little real history to trust a trend.
//
// `_m` (the fitted-series length) anchors the forecast x-axis: future month k lands at
// x = (_m-1)+k, continuing the trimmed index space, so calendar alignment is preserved.
function forecastSeries(values) {
  let fit = values.slice(0, -1);            // drop the partial current month
  const firstNonZero = fit.findIndex((v) => v > 0);
  if (firstNonZero > 0) fit = fit.slice(firstNonZero); // trim leading pre-existence zeros
  const m = fit.length;

  if (m < 3 || fit.reduce((a, b) => a + b, 0) === 0) {
    const mean = m ? fit.reduce((a, b) => a + b, 0) / m : (values[values.length - 1] || 0);
    return { reliable: false, _mean: mean };
  }

  let sx = 0, sy = 0, sxy = 0, sxx = 0;
  for (let i = 0; i < m; i++) { sx += i; sy += fit[i]; sxy += i * fit[i]; sxx += i * i; }
  const denom = (m * sxx - sx * sx) || 1;
  const slope = (m * sxy - sx * sy) / denom;
  const intercept = (sy - slope * sx) / m;
  let ss = 0;
  for (let i = 0; i < m; i++) { const p = intercept + slope * i; ss += (fit[i] - p) ** 2; }
  const sd = Math.sqrt(ss / Math.max(1, m - 2));
  const mean = sy / m || 1;
  const mk = (ym, v, lo, hi) => ({ ym, v: Math.max(0, Math.round(v)), lo: Math.max(0, Math.round(lo)), hi: Math.max(0, Math.round(hi)) });
  return { slope, intercept, sd, reliable: true, trend_pct: +((slope / Math.abs(mean)) * 100).toFixed(1), _m: m, mk };
}

// GET /api/dashboard/analytics?months=12&horizon=3
// Revenue (finance-gated) + new-student counts per month, each with a forward forecast.
r.get('/analytics', requireFeature('reports', 'รายงาน & พยากรณ์รายได้ใช้ได้ในแผน ACADEMY ขึ้นไป — อัปเกรดเพื่อเปิดใช้งาน'), wrap((req, res) => {
  const sid = req.schoolId;
  if (!pageAllows(req.perms, 'reports', 'view')) throw Object.assign(new Error('forbidden'), { status: 403 });

  const months = Math.min(24, Math.max(6, parseInt(req.query.months) || 12));
  const horizon = Math.min(6, Math.max(1, parseInt(req.query.horizon) || 3));
  const keys = lastMonths(months);
  const curYm = keys[keys.length - 1];

  // map a [{ym,v}] result onto the fixed month buckets (0 for gaps)
  const bucket = (rows) => {
    const map = {}; rows.forEach((x) => { if (x.ym) map[x.ym] = x.v; });
    return keys.map((ym) => ({ ym, v: map[ym] || 0, partial: ym === curYm }));
  };

  // build a forecast block (current-month estimate + future months) from a value series
  const buildForecast = (hist) => {
    const f = forecastSeries(hist.map((h) => h.v));
    const future = [];
    for (let k = 0; k <= horizon; k++) {
      const d = new Date(Date.UTC(Number(curYm.slice(0, 4)), Number(curYm.slice(5, 7)) - 1 + k, 1));
      const ym = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
      if (f.reliable) {
        const x = (f._m - 1) + (k + 1); // continue past the last fitted index
        const v = f.intercept + f.slope * x;
        future.push(f.mk(ym, v, v - f.sd, v + f.sd));
      } else {
        future.push({ ym, v: Math.max(0, Math.round(f._mean || 0)), lo: 0, hi: 0 });
      }
    }
    return { points: future, reliable: f.reliable, trend_pct: f.trend_pct || 0 };
  };

  const canSeeRevenue = pageAllows(req.perms, 'finance', 'view');

  // owner-set monthly targets (0 = not set)
  let goals = {};
  try { goals = JSON.parse((get('SELECT goals_json FROM schools WHERE id = ?', sid) || {}).goals_json || '{}') || {}; } catch { goals = {}; }
  const goal = (k) => Math.max(0, Math.round(Number(goals[k]) || 0)) || null;

  let revenue = null;
  if (canSeeRevenue) {
    const rows = all(
      `SELECT substr(paid_at,1,7) AS ym, COALESCE(SUM(amount),0) AS v
         FROM invoices WHERE school_id = ? AND status = 'paid' AND paid_at IS NOT NULL
         GROUP BY ym`, sid);
    const hist = bucket(rows);
    revenue = { history: hist, forecast: buildForecast(hist), goal: goal('revenue_monthly') };
  }

  const studRows = all(
    `SELECT substr(created_at,1,7) AS ym, COUNT(*) AS v
       FROM students WHERE school_id = ? GROUP BY ym`, sid);
  const studHist = bucket(studRows);
  const newStudents = { history: studHist, forecast: buildForecast(studHist), goal: goal('new_students_monthly') };

  // active students is a point-in-time count (not a monthly flow), so it carries its
  // own current value + target rather than a forecast series.
  const activeNow = get("SELECT COUNT(*) AS c FROM students WHERE school_id = ? AND status = 'active'", sid).c;
  const activeStudents = { current: activeNow, goal: goal('active_students') };

  res.json({ months, horizon, can_see_revenue: canSeeRevenue, revenue, new_students: newStudents, active_students: activeStudents });
}));

export default r;
