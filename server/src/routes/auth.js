import { Router } from 'express';
import { get, run } from '../db.js';
import { hashPassword, verifyPassword, signToken, requireAuth, resolvePerms } from '../auth.js';
import { wrap, required, bad } from '../util.js';
import crypto from 'node:crypto';
import { sendEmail, tplWelcome, tplPasswordReset, emailEnabled } from '../email.js';

const r = Router();

// POST /api/auth/register — create a new school + its owner account (sign-up flow)
r.post('/register', wrap((req, res) => {
  const { school, name, email, password, category } = required(req.body, ['school', 'name', 'email', 'password']);
  if (String(password).length < 6) throw bad('password must be at least 6 characters');
  if (get('SELECT id FROM users WHERE email = ?', email)) throw bad('email already registered', 409);

  const slug = String(school).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || `school-${Date.now()}`;
  const sch = run('INSERT INTO schools (name, slug, category) VALUES (?, ?, ?)', school, slug, category || null);
  const schoolId = Number(sch.lastInsertRowid);
  const u = run(
    'INSERT INTO users (school_id, email, password_hash, name, role) VALUES (?, ?, ?, ?, ?)',
    schoolId, email, hashPassword(password), name, 'owner'
  );
  const user = { id: Number(u.lastInsertRowid), school_id: schoolId, name, role: 'owner' };
  if (emailEnabled) {
    sendEmail({ to: email, ...tplWelcome({ schoolName: school, ownerName: name }) })
      .catch(e => console.error('[email] welcome failed:', e));
  }
  res.status(201).json({ token: signToken(user), user: { ...user, email } });
}));

// POST /api/auth/login
r.post('/login', wrap((req, res) => {
  const { email, password } = required(req.body, ['email', 'password']);
  const user = get('SELECT * FROM users WHERE email = ?', email);
  if (!user || !verifyPassword(password, user.password_hash)) throw bad('invalid credentials', 401);
  res.json({
    token: signToken(user),
    user: { id: user.id, school_id: user.school_id, name: user.name, email: user.email, role: user.role },
  });
}));

// PATCH /api/auth/password — change password (authenticated; requires current password)
r.patch('/password', requireAuth, wrap((req, res) => {
  const { current_password, new_password } = required(req.body, ['current_password', 'new_password']);
  if (String(new_password).length < 6) throw bad('new password must be at least 6 characters');
  const user = get('SELECT * FROM users WHERE id = ?', req.user.uid);
  if (!user || !verifyPassword(current_password, user.password_hash)) throw bad('รหัสผ่านปัจจุบันไม่ถูกต้อง', 401);
  run('UPDATE users SET password_hash = ? WHERE id = ?', hashPassword(new_password), user.id);
  res.json({ ok: true });
}));

// POST /api/auth/forgot-password — request a reset token (no email yet; returns token for manual delivery)
r.post('/forgot-password', wrap((req, res) => {
  const { email } = required(req.body, ['email']);
  const user = get('SELECT id FROM users WHERE email = ?', email);
  // Always respond 200 to avoid email enumeration
  if (!user) return res.json({ ok: true, note: 'if that email exists, a reset link will be sent' });
  const token = crypto.randomBytes(32).toString('hex');
  const expires = new Date(Date.now() + 3600_000).toISOString(); // 1 hour
  run('UPDATE users SET reset_token = ?, reset_expires = ? WHERE id = ?', token, expires, user.id);

  if (emailEnabled) {
    const APP_URL = process.env.APP_URL || 'https://skooldee.com';
    const resetUrl = `${APP_URL}/app.html?reset=${token}`;
    const tpl = tplPasswordReset({ email, resetUrl });
    sendEmail({ to: email, ...tpl }).catch(e => console.error('[email] failed to send reset:', e));
  }

  res.json({ ok: true, ...(emailEnabled ? {} : { _dev_token: token }) });
}));

// POST /api/auth/reset-password — consume reset token + set new password
r.post('/reset-password', wrap((req, res) => {
  const { token, new_password } = required(req.body, ['token', 'new_password']);
  if (String(new_password).length < 6) throw bad('password must be at least 6 characters');
  const user = get('SELECT * FROM users WHERE reset_token = ?', token);
  if (!user || !user.reset_expires || new Date(user.reset_expires) < new Date()) throw bad('reset link is invalid or expired', 400);
  run('UPDATE users SET password_hash = ?, reset_token = NULL, reset_expires = NULL WHERE id = ?',
    hashPassword(new_password), user.id);
  const u = { id: user.id, school_id: user.school_id, name: user.name, role: user.role };
  res.json({ ok: true, token: signToken(u) });
}));

// PATCH /api/auth/profile — update own display name
r.patch('/profile', requireAuth, wrap((req, res) => {
  const { name } = req.body || {};
  if (!name || !String(name).trim()) throw bad('name is required');
  run('UPDATE users SET name = ? WHERE id = ?', String(name).trim(), req.user.uid);
  res.json({ ok: true, name: String(name).trim() });
}));

// GET /api/auth/me
r.get('/me', requireAuth, wrap((req, res) => {
  const row = get('SELECT id, school_id, name, email, role, teacher_id, permissions_json FROM users WHERE id = ?', req.user.uid);
  const user = {
    id: row.id, school_id: row.school_id, name: row.name, email: row.email, role: row.role,
    teacher_id: row.teacher_id || null,
    permissions: resolvePerms(row), // effective { scope, pages } — drives nav + write buttons
  };
  // Return the FULL safe school object (not just the basics) — the app hydrates
  // DATA._schoolRaw from this on every load, so settings like business hours,
  // name display, categories and assessment config must all be present here or
  // the Settings screen reverts to defaults after reload.
  const s = get(`SELECT id, name, slug, category, near_limit_threshold, categories_json, line_token, line_secret,
                        notify_prefs, name_display, hours_start, hours_end, contact_phone, line_oa_url,
                        line_oa_basic_id, liff_id, rooms_json, assessment_criteria_json,
                        show_assessments_to_parents, show_course_no_to_parents,
                        invite_message_template, payment_qr_image, logo_image, created_at
                   FROM schools WHERE id = ?`, req.schoolId);
  let school = null;
  if (s) {
    const { line_token, line_secret, notify_prefs, rooms_json, show_assessments_to_parents, show_course_no_to_parents, ...safe } = s;
    let prefs = {};
    try { prefs = notify_prefs ? JSON.parse(notify_prefs) : {}; } catch { prefs = {}; }
    let rooms = [];
    try { const a = JSON.parse(rooms_json || '[]'); rooms = Array.isArray(a) ? a.filter((x) => typeof x === 'string' && x.trim()) : []; } catch { rooms = []; }
    school = {
      ...safe, rooms, notify_prefs: prefs,
      line_configured: !!line_token, line_secret_configured: !!line_secret,
      show_assessments_to_parents: !!show_assessments_to_parents,
      show_course_no_to_parents: !!show_course_no_to_parents,
    };
  }
  res.json({ user, school });
}));

export default r;
