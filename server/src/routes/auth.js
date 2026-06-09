import { Router } from 'express';
import { get, run } from '../db.js';
import { hashPassword, verifyPassword, signToken, requireAuth } from '../auth.js';
import { wrap, required, bad } from '../util.js';

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

// GET /api/auth/me
r.get('/me', requireAuth, wrap((req, res) => {
  const user = get('SELECT id, school_id, name, email, role FROM users WHERE id = ?', req.user.uid);
  const school = get('SELECT id, name, slug, category, near_limit_threshold FROM schools WHERE id = ?', req.schoolId);
  res.json({ user, school });
}));

export default r;
