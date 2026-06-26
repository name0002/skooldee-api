// Authentication + multi-tenant helpers.
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { get, all } from './db.js';

const SECRET = process.env.JWT_SECRET || 'dev-insecure-secret-change-me';
const EXPIRES = process.env.JWT_EXPIRES || '7d';

// Platform-level super-admin: comma-separated emails in PLATFORM_ADMIN_EMAILS env var.
const _adminEmails = (process.env.PLATFORM_ADMIN_EMAILS || '').split(',').map(e => e.trim().toLowerCase()).filter(Boolean);
export const isPlatformAdmin = (email) => _adminEmails.length > 0 && _adminEmails.includes((email || '').toLowerCase());

// ---- Access control model --------------------------------------------------
// Pages a staff login can be granted, each at a level: 'none' | 'view' | 'manage'.
// owner/admin always get full access (scope:'all', every page 'manage') and ignore
// any stored overrides. A teacher defaults to seeing ONLY their own students/classes
// (scope:'own'); the owner can widen this per teacher in settings.
export const PAGES = ['dashboard', 'schedule', 'attendance', 'homework', 'students', 'teachers', 'finance', 'reports', 'referrals'];

const ALL_MANAGE = Object.fromEntries(PAGES.map((p) => [p, 'manage']));

export const DEFAULT_TEACHER_PERMS = {
  scope: 'own',
  pages: {
    dashboard: 'view', schedule: 'view', attendance: 'manage', homework: 'manage',
    students: 'view', teachers: 'none', finance: 'none', reports: 'none', referrals: 'none',
  },
};
const DEFAULT_FINANCE_PERMS = {
  scope: 'all',
  pages: {
    dashboard: 'view', schedule: 'view', attendance: 'view', homework: 'none',
    students: 'view', teachers: 'none', finance: 'manage', reports: 'view', referrals: 'none',
  },
};
const LEVELS = { none: 0, view: 1, manage: 2 };

// Resolve a DB user row → effective permissions { scope, pages }.
export function resolvePerms(user) {
  if (!user) return { scope: 'own', pages: {} };
  if (user.role === 'owner' || user.role === 'admin') return { scope: 'all', pages: { ...ALL_MANAGE } };
  const base = user.role === 'finance' ? DEFAULT_FINANCE_PERMS : DEFAULT_TEACHER_PERMS;
  let override = null;
  try { override = user.permissions_json ? JSON.parse(user.permissions_json) : null; } catch { override = null; }
  const pages = { ...base.pages };
  let scope = base.scope;
  if (override && typeof override === 'object') {
    if (override.scope === 'own' || override.scope === 'all') scope = override.scope;
    if (override.pages && typeof override.pages === 'object') {
      for (const p of PAGES) {
        const lvl = override.pages[p];
        if (lvl === 'none' || lvl === 'view' || lvl === 'manage') pages[p] = lvl;
      }
    }
  }
  return { scope, pages };
}

export const pageAllows = (perms, page, level) => LEVELS[(perms.pages || {})[page] || 'none'] >= LEVELS[level];

// Student ids a teacher "owns" = their primary students + anyone in a class they teach.
export function ownStudentIds(schoolId, teacherId) {
  if (!teacherId) return [];
  const rows = all(
    `SELECT id FROM students WHERE school_id = ? AND teacher_id = ?
     UNION
     SELECT ss.student_id FROM slot_students ss
       JOIN schedule_slots sl ON sl.id = ss.slot_id
      WHERE sl.school_id = ? AND sl.teacher_id = ?`,
    schoolId, teacherId, schoolId, teacherId);
  return rows.map((r) => r.id);
}

export const hashPassword = (pw) => bcrypt.hashSync(pw, 10);
export const verifyPassword = (pw, hash) => bcrypt.compareSync(pw, hash);

export function signToken(user) {
  return jwt.sign(
    { uid: user.id, sid: user.school_id, role: user.role, name: user.name },
    SECRET,
    { expiresIn: EXPIRES }
  );
}

// Require a valid JWT. Attaches req.user = { uid, sid, role, name } and — by loading
// the live user row — req.role / req.teacherId / req.perms / req.scopeOwn. Reading the
// row fresh (not just the JWT) means permission edits and account deletion take effect
// immediately, without waiting for the 7-day token to expire.
export function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'missing token' });
  let payload;
  try { payload = jwt.verify(token, SECRET); }
  catch { return res.status(401).json({ error: 'invalid or expired token' }); }

  const row = get('SELECT id, school_id, role, name, teacher_id, permissions_json FROM users WHERE id = ?', payload.uid);
  if (!row) return res.status(401).json({ error: 'account no longer exists' });

  req.user = { uid: row.id, sid: row.school_id, role: row.role, name: row.name };
  req.schoolId = row.school_id;
  req.role = row.role;
  req.teacherId = row.teacher_id || null;
  req.perms = resolvePerms(row);
  // when true, list/read endpoints must restrict to this teacher's own students/classes
  req.scopeOwn = req.perms.scope === 'own' && !!req.teacherId && row.role !== 'owner' && row.role !== 'admin';
  next();
}

// Like requireAuth but NEVER rejects — attaches req.user/req.schoolId only when a
// valid token is present. Used by routes that are public but want to scope to the
// caller's school when they happen to be logged in (e.g. lead capture after sign-up).
export function optionalAuth(req, _res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (token) {
    try { req.user = jwt.verify(token, SECRET); req.schoolId = req.user.sid; } catch { /* ignore bad token */ }
  }
  next();
}

// Restrict a route to specific roles.
export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'forbidden' });
    }
    next();
  };
}

// Gate a route by page permission level ('view' or 'manage'). Use on write routes so a
// view-only teacher can read but not modify. owner/admin always pass (full perms).
export function requirePage(page, level = 'view') {
  return (req, res, next) => {
    if (!req.perms || !pageAllows(req.perms, page, level)) {
      return res.status(403).json({ error: 'forbidden' });
    }
    next();
  };
}

// Parent/Student portal — validates a time-limited token from portal_sessions.
// Token may come from ?token= query param or Authorization: Bearer header.
// Sets req.user, req.schoolId, req.studentId on success.
export function requirePortal(req, res, next) {
  const raw = req.headers.authorization || '';
  const token = req.query.token || (raw.startsWith('Bearer ') ? raw.slice(7) : null);
  if (!token) return res.status(401).json({ error: 'missing token' });
  const session = get(
    `SELECT * FROM portal_sessions WHERE token = ? AND expires_at > datetime('now')`,
    token
  );
  if (!session) return res.status(401).json({ error: 'invalid or expired token' });
  req.user = { uid: session.student_id, sid: session.school_id, role: session.role };
  req.schoolId = session.school_id;
  req.studentId = session.student_id;
  next();
}
