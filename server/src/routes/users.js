import { Router } from 'express';
import { all, get, run } from '../db.js';
import { hashPassword, requireRole, PAGES } from '../auth.js';
import { wrap, required, bad } from '../util.js';

const r = Router();

// staff-account management is owner/admin only
r.use(requireRole('owner', 'admin'));

// sanitise an incoming permissions object → { scope, pages } with only known keys/levels
function cleanPermissions(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const out = {};
  if (raw.scope === 'own' || raw.scope === 'all') out.scope = raw.scope;
  if (raw.pages && typeof raw.pages === 'object') {
    const pages = {};
    for (const p of PAGES) {
      const lvl = raw.pages[p];
      if (lvl === 'none' || lvl === 'view' || lvl === 'manage') pages[p] = lvl;
    }
    if (Object.keys(pages).length) out.pages = pages;
  }
  return Object.keys(out).length ? out : null;
}

function shape(row) {
  let permissions = null;
  try { permissions = row.permissions_json ? JSON.parse(row.permissions_json) : null; } catch { permissions = null; }
  return { id: row.id, email: row.email, name: row.name, role: row.role,
    teacher_id: row.teacher_id || null, permissions, created_at: row.created_at };
}

// validate that a teacher_id (if given) belongs to this school; '' / null clears it
function resolveTeacherId(req, value) {
  if (value === undefined) return undefined;
  if (value === null || value === '' ) return null;
  const t = get('SELECT id FROM teachers WHERE id = ? AND school_id = ?', value, req.schoolId);
  if (!t) throw bad('teacher not found', 404);
  return t.id;
}

// GET /api/users — list staff accounts for this school
r.get('/', wrap((req, res) => {
  res.json(all('SELECT id, email, name, role, teacher_id, permissions_json, created_at FROM users WHERE school_id = ? ORDER BY id', req.schoolId).map(shape));
}));

// POST /api/users — create a staff login (teacher / finance / admin)
r.post('/', wrap((req, res) => {
  const b = required(req.body, ['email', 'password', 'name']);
  if (String(b.password).length < 6) throw bad('รหัสผ่านต้องอย่างน้อย 6 ตัวอักษร');
  const role = ['admin', 'teacher', 'finance'].includes(b.role) ? b.role : 'teacher';
  if (get('SELECT id FROM users WHERE email = ?', b.email)) throw bad('อีเมลนี้มีบัญชีอยู่แล้ว', 409);
  const teacherId = resolveTeacherId(req, b.teacher_id) || null;
  const perms = cleanPermissions(b.permissions);
  const u = run(
    'INSERT INTO users (school_id, email, password_hash, name, role, teacher_id, permissions_json) VALUES (?,?,?,?,?,?,?)',
    req.schoolId, b.email, hashPassword(b.password), b.name, role, teacherId, perms ? JSON.stringify(perms) : null);
  res.status(201).json(shape(get('SELECT id, email, name, role, teacher_id, permissions_json, created_at FROM users WHERE id = ? AND school_id = ?', Number(u.lastInsertRowid), req.schoolId)));
}));

// PATCH /api/users/:id — edit role / teacher link / permissions (cannot touch the owner)
r.patch('/:id', wrap((req, res) => {
  const target = get('SELECT * FROM users WHERE id = ? AND school_id = ?', req.params.id, req.schoolId);
  if (!target) throw bad('user not found', 404);
  if (target.role === 'owner') throw bad('แก้ไขบัญชีเจ้าของไม่ได้');
  const sets = [], vals = [];
  if (req.body.name !== undefined && String(req.body.name).trim()) { sets.push('name = ?'); vals.push(String(req.body.name).trim()); }
  if (req.body.role !== undefined) {
    const role = ['admin', 'teacher', 'finance'].includes(req.body.role) ? req.body.role : target.role;
    sets.push('role = ?'); vals.push(role);
  }
  const teacherId = resolveTeacherId(req, req.body.teacher_id);
  if (teacherId !== undefined) { sets.push('teacher_id = ?'); vals.push(teacherId); }
  if (req.body.permissions !== undefined) {
    const perms = cleanPermissions(req.body.permissions);
    sets.push('permissions_json = ?'); vals.push(perms ? JSON.stringify(perms) : null);
  }
  if (req.body.password !== undefined && req.body.password) {
    if (String(req.body.password).length < 6) throw bad('รหัสผ่านต้องอย่างน้อย 6 ตัวอักษร');
    sets.push('password_hash = ?'); vals.push(hashPassword(req.body.password));
  }
  if (!sets.length) throw bad('no fields to update');
  run(`UPDATE users SET ${sets.join(', ')} WHERE id = ? AND school_id = ?`, ...vals, target.id, req.schoolId);
  res.json(shape(get('SELECT id, email, name, role, teacher_id, permissions_json, created_at FROM users WHERE id = ? AND school_id = ?', target.id, req.schoolId)));
}));

// DELETE /api/users/:id — remove a staff account (cannot remove self or the owner)
r.delete('/:id', wrap((req, res) => {
  const target = get('SELECT * FROM users WHERE id = ? AND school_id = ?', req.params.id, req.schoolId);
  if (!target) throw bad('user not found', 404);
  if (target.id === req.user.uid) throw bad('ลบบัญชีตัวเองไม่ได้');
  if (target.role === 'owner') throw bad('ลบบัญชีเจ้าของไม่ได้');
  run('DELETE FROM users WHERE id = ? AND school_id = ?', target.id, req.schoolId);
  res.json({ ok: true });
}));

export default r;
