import { Router } from 'express';
import crypto from 'node:crypto';
import { all, get, run, tierOf } from '../db.js';
import { wrap, required, bad, nearLimitInfo } from '../util.js';
import { requirePage, ownStudentIds } from '../auth.js';

const r = Router();

// editing student records needs students:manage
const canManage = requirePage('students', 'manage');
// for a teacher scoped to 'own', verify a student is one of theirs (else 404 — don't leak existence)
const ownsStudent = (req, id) => !req.scopeOwn || ownStudentIds(req.schoolId, req.teacherId).includes(Number(id));

const codeFor = (name) =>
  'MARI-' + String(name || 'XX').replace(/\s/g, '').slice(0, 2).toUpperCase() + Math.floor(100 + Math.random() * 900);

// normalise a multi-package enrollment list → { json, total, remaining, firstPkg, firstCat }
function buildEnrollments(b) {
  if (!Array.isArray(b.packages) || !b.packages.length) return null;
  const enr = b.packages
    .filter((p) => p && (p.sessions_total != null || p.package_id))
    .map((p) => ({
      category: p.category || null,
      package_id: p.package_id || null,
      name: p.name || null,
      sessions_total: Math.max(0, parseInt(p.sessions_total) || 0),
      sessions_remaining: Math.max(0, parseInt(p.sessions_remaining != null ? p.sessions_remaining : p.sessions_total) || 0),
    }));
  if (!enr.length) return null;
  return {
    json: JSON.stringify(enr),
    total: enr.reduce((a, p) => a + p.sessions_total, 0),
    remaining: enr.reduce((a, p) => a + p.sessions_remaining, 0),
    firstPkg: enr[0].package_id,
    firstCat: enr[0].category,
  };
}

// shared insert used by POST / and POST /bulk
function insertStudent(sid, b) {
  const cats = Array.isArray(b.categories) ? b.categories.filter(Boolean) : [];
  const enr = buildEnrollments(b);
  const primaryCat = cats[0] || (enr && enr.firstCat) || b.category || null;
  const categoriesJson = cats.length ? JSON.stringify(cats) : null;
  // when multiple packages given, the per-student totals are the aggregate sum
  const sessTotal = enr ? enr.total : (b.sessions_total || b.sessions_remaining || 0);
  const sessRemain = enr ? enr.remaining : (b.sessions_remaining || 0);
  const packageId = (enr && enr.firstPkg) || b.package_id || null;
  const result = run(
    `INSERT INTO students (school_id, name, nickname, age, birthday, parent_name, parent_phone, line_id, category, categories_json,
       teacher_id, package_id, sessions_remaining, sessions_total, balance_due, status, referral_code, parent_token, goal, email, packages_json)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    sid, b.name, b.nickname || null, b.age || null, b.birthday || null, b.parent_name || null, b.parent_phone || null,
    b.line_id || null, primaryCat, categoriesJson, b.teacher_id || null, packageId,
    sessRemain, sessTotal, b.balance_due || 0,
    b.status || 'active', codeFor(b.nickname || b.name), crypto.randomBytes(8).toString('hex'),
    b.goal || null, b.email || null, enr ? enr.json : null
  );
  return get('SELECT * FROM students WHERE id = ? AND school_id = ?', Number(result.lastInsertRowid), sid);
}

// POST /api/students/bulk — import many students at once (from CSV/Excel paste)
r.post('/bulk', wrap((req, res) => {
  const list = Array.isArray(req.body.students) ? req.body.students : [];
  if (!list.length) throw bad('no students to import');
  if (list.length > 500) throw bad('too many rows (max 500)');
  const created = [];
  for (const s of list) {
    if (!s || !s.name || !String(s.name).trim()) continue;
    created.push(insertStudent(req.schoolId, { ...s, name: String(s.name).trim() }));
  }
  res.status(201).json({ created: created.length, students: created });
}));

// GET /api/students?near_limit=1&q=&category=
r.get('/', wrap((req, res) => {
  const sid = req.schoolId;
  const sch = get('SELECT near_limit_threshold FROM schools WHERE id = ?', sid);
  const rows = all(
    `SELECT s.*, t.name AS teacher_name, p.name AS package_name
       FROM students s
       LEFT JOIN teachers t ON t.id = s.teacher_id
       LEFT JOIN packages p ON p.id = s.package_id
      WHERE s.school_id = ? ORDER BY s.name`, sid);
  // self-healing: ensure every student has a parent-portal token (covers rows created before the column existed)
  for (const s of rows) {
    if (!s.parent_token) {
      const tok = crypto.randomBytes(8).toString('hex');
      run('UPDATE students SET parent_token = ? WHERE id = ?', tok, s.id);
      s.parent_token = tok;
    }
  }
  let list = rows.map((s) => {
    const nl = nearLimitInfo(s, sch.near_limit_threshold);
    return { ...s, tier: tierOf(s.points), near_limit: nl.near, near_limit_subject: nl.perSubject ? { remaining: nl.remaining, category: nl.category, name: nl.name } : null };
  });

  // teachers scoped to 'own' only see their own students
  if (req.scopeOwn) {
    const own = new Set(ownStudentIds(sid, req.teacherId));
    list = list.filter((s) => own.has(s.id));
  }
  if (req.query.near_limit === '1') list = list.filter((s) => s.near_limit);
  if (req.query.category) list = list.filter((s) => s.category === req.query.category);
  if (req.query.q) {
    const q = String(req.query.q).toLowerCase();
    list = list.filter((s) => (s.name + ' ' + (s.nickname || '')).toLowerCase().includes(q));
  }
  res.json(list);
}));

r.get('/:id', wrap((req, res) => {
  if (!ownsStudent(req, req.params.id)) throw bad('student not found', 404);
  const s = get('SELECT * FROM students WHERE id = ? AND school_id = ?', req.params.id, req.schoolId);
  if (!s) throw bad('student not found', 404);
  const homework = all('SELECT * FROM homework WHERE student_id = ? AND school_id = ? ORDER BY created_at DESC LIMIT 10', s.id, req.schoolId);
  const points = all('SELECT * FROM points_ledger WHERE student_id = ? AND school_id = ? ORDER BY created_at DESC LIMIT 10', s.id, req.schoolId);
  res.json({ ...s, tier: tierOf(s.points), homework, points_history: points });
}));

r.post('/', canManage, wrap((req, res) => {
  const b = required(req.body, ['name']);
  res.status(201).json(insertStudent(req.schoolId, b));
}));

// PATCH /api/students/:id — partial update of editable fields
r.patch('/:id', canManage, wrap((req, res) => {
  if (!ownsStudent(req, req.params.id)) throw bad('student not found', 404);
  const s = get('SELECT * FROM students WHERE id = ? AND school_id = ?', req.params.id, req.schoolId);
  if (!s) throw bad('student not found', 404);
  const fields = ['name', 'nickname', 'age', 'birthday', 'parent_name', 'parent_phone', 'line_id', 'category',
    'teacher_id', 'package_id', 'sessions_remaining', 'sessions_total', 'balance_due', 'status', 'goal', 'email'];
  const sets = [], vals = [];
  for (const f of fields) if (f in req.body) { sets.push(`${f} = ?`); vals.push(req.body[f]); }
  // multi-subject: categories[] → categories_json (+ sync primary category if not set explicitly)
  if ('categories' in req.body) {
    const arr = Array.isArray(req.body.categories) ? req.body.categories.filter(Boolean) : [];
    sets.push('categories_json = ?'); vals.push(arr.length ? JSON.stringify(arr) : null);
    if (!('category' in req.body)) { sets.push('category = ?'); vals.push(arr[0] || null); }
  }
  // multi-package: packages[] → packages_json + sync aggregate session totals
  if ('packages' in req.body) {
    const enr = buildEnrollments(req.body);
    if (enr) {
      sets.push('packages_json = ?'); vals.push(enr.json);
      if (!('sessions_total' in req.body)) { sets.push('sessions_total = ?'); vals.push(enr.total); }
      if (!('sessions_remaining' in req.body)) { sets.push('sessions_remaining = ?'); vals.push(enr.remaining); }
      if (!('package_id' in req.body) && enr.firstPkg) { sets.push('package_id = ?'); vals.push(enr.firstPkg); }
    } else {
      sets.push('packages_json = ?'); vals.push(null);
    }
  }
  if (!sets.length) throw bad('no fields to update');
  run(`UPDATE students SET ${sets.join(', ')} WHERE id = ? AND school_id = ?`, ...vals, s.id, req.schoolId);
  res.json(get('SELECT * FROM students WHERE id = ? AND school_id = ?', s.id, req.schoolId));
}));

// POST /api/students/:id/unlink-line — disconnect the linked LINE account so the
// connection can be redone (e.g. the wrong person tapped the link). Owner control:
// the parent portal token still works; only the push/notify target is cleared.
r.post('/:id/unlink-line', canManage, wrap((req, res) => {
  if (!ownsStudent(req, req.params.id)) throw bad('student not found', 404);
  const s = get('SELECT id FROM students WHERE id = ? AND school_id = ?', req.params.id, req.schoolId);
  if (!s) throw bad('student not found', 404);
  run('UPDATE students SET line_user_id = NULL, line_display_name = NULL WHERE id = ? AND school_id = ?', s.id, req.schoolId);
  res.json({ ok: true });
}));

r.delete('/:id', canManage, wrap((req, res) => {
  if (!ownsStudent(req, req.params.id)) throw bad('student not found', 404);
  const result = run('DELETE FROM students WHERE id = ? AND school_id = ?', req.params.id, req.schoolId);
  if (!result.changes) throw bad('student not found', 404);
  res.json({ ok: true });
}));

export default r;
