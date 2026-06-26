import { Router } from 'express';
import crypto from 'crypto';
import { all, get, run } from '../db.js';
import { wrap } from '../util.js';
import { isPlatformAdmin } from '../auth.js';
import { effectivePlan } from '../plans.js';

const r = Router();

function requirePlatformAdmin(req, res, next) {
  const row = get('SELECT email FROM users WHERE id = ?', req.user.uid);
  if (!row || !isPlatformAdmin(row.email)) {
    return res.status(403).json({ error: 'platform admin only' });
  }
  next();
}

// GET /api/admin/schools — all schools with per-school usage stats
r.get('/schools', requirePlatformAdmin, wrap((_req, res) => {
  const schools = all(`
    SELECT s.id, s.name, s.slug, s.plan, s.plan_expires, s.created_at,
           u.email AS owner_email, u.name AS owner_name, u.phone AS owner_phone
      FROM schools s
      LEFT JOIN users u ON u.school_id = s.id AND u.role = 'owner'
     ORDER BY s.created_at DESC
  `);

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

  const result = schools.map(s => {
    const student_count = (get(
      `SELECT COUNT(*) AS cnt FROM students WHERE school_id = ? AND status != 'inactive'`, s.id
    ) || {}).cnt || 0;

    const active_teachers = (get(
      `SELECT COUNT(*) AS cnt FROM teachers WHERE school_id = ?`, s.id
    ) || {}).cnt || 0;

    const rev_row = get(
      `SELECT COALESCE(SUM(amount), 0) AS rev FROM invoices
        WHERE school_id = ? AND status = 'paid' AND paid_at >= ?`, s.id, monthStart
    );
    const revenue_this_month = rev_row ? rev_row.rev : 0;

    const invoice_count = (get(
      `SELECT COUNT(*) AS cnt FROM invoices WHERE school_id = ?`, s.id
    ) || {}).cnt || 0;

    const planKey = s.plan || 'trial';
    const eff = effectivePlan({ plan: planKey, plan_expires: s.plan_expires });

    let plan_status;
    if (planKey === 'trial') {
      plan_status = s.plan_expires && new Date(s.plan_expires) < now ? 'expired' : 'trial';
    } else if (planKey === 'cancelled') {
      plan_status = 'expired';
    } else {
      plan_status = 'active';
    }

    return {
      id: s.id,
      name: s.name,
      slug: s.slug,
      owner_email: s.owner_email || null,
      owner_name: s.owner_name || null,
      owner_phone: s.owner_phone || null,
      plan: planKey,
      plan_label: eff.label,
      plan_status,
      trial_ends_at: planKey === 'trial' ? s.plan_expires : null,
      subscription_expires_at: planKey !== 'trial' ? s.plan_expires : null,
      student_count,
      active_teachers,
      revenue_this_month,
      invoice_count,
      created_at: s.created_at,
    };
  });

  res.json(result);
}));

// GET /api/admin/owner-line — status of the platform owner's LINE link (uses the
// admin's own school as the notification channel — see line-push.js#notifyPlatformOwner)
r.get('/owner-line', requirePlatformAdmin, wrap((req, res) => {
  const s = get('SELECT owner_line_id, owner_link_code, line_token FROM schools WHERE id = ?', req.schoolId);
  res.json({
    linked: !!s?.owner_line_id,
    has_line_channel: !!s?.line_token,
    link_code: s?.owner_link_code || null,
  });
}));

// POST /api/admin/owner-line/code — generate a fresh one-time code to link the
// owner's personal LINE account. Owner then sends this code as a message to this
// school's own LINE OA; the webhook (routes/line.js) captures the LINE userId.
r.post('/owner-line/code', requirePlatformAdmin, wrap((req, res) => {
  const code = 'OWN-' + crypto.randomBytes(3).toString('hex').toUpperCase();
  run('UPDATE schools SET owner_link_code = ? WHERE id = ?', code, req.schoolId);
  res.json({ link_code: code });
}));

// POST /api/admin/owner-line/unlink — stop platform notifications to this LINE account
r.post('/owner-line/unlink', requirePlatformAdmin, wrap((req, res) => {
  run('UPDATE schools SET owner_line_id = NULL, owner_link_code = NULL WHERE id = ?', req.schoolId);
  res.json({ ok: true });
}));

export default r;
