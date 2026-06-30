import { Router } from 'express';
import crypto from 'node:crypto';
import { all, get, run, tierOf } from '../db.js';
import { wrap, required, bad, nearLimitInfo, courseExpiryInfo, addDaysISO } from '../util.js';
import { requirePage, ownStudentIds } from '../auth.js';
import { effectivePlan, planAllows } from '../plans.js';

const r = Router();

// Enforce the plan's student cap. Throws if adding `adding` students would exceed it.
// The cap counts ACTIVE students only (status='active') — paused/inactive (graduated,
// on a school break, etc.) don't consume a seat, so a school's history can't lock them out.
function assertStudentCap(sid, adding = 1) {
  const sch = get('SELECT plan, plan_expires FROM schools WHERE id = ?', sid);
  const cap = effectivePlan(sch).students;
  if (cap === Infinity) return;
  const cur = get("SELECT COUNT(*) AS n FROM students WHERE school_id = ? AND status = 'active'", sid).n;
  if (cur + adding > cap) {
    throw bad(`แผนปัจจุบันรองรับนักเรียนที่กำลังเรียนสูงสุด ${cap} คน — อัปเกรดแพ็กเกจ หรือเปลี่ยนสถานะนักเรียนที่ไม่ได้เรียนแล้วเป็น "พัก/หยุด" เพื่อเพิ่มที่ว่าง`, 402);
  }
}

// editing student records needs students:manage
const canManage = requirePage('students', 'manage');
// for a teacher scoped to 'own', verify a student is one of theirs (else 404 — don't leak existence)
const ownsStudent = (req, id) => !req.scopeOwn || ownStudentIds(req.schoolId, req.teacherId).includes(Number(id));

const codeFor = (name) =>
  'MARI-' + String(name || 'XX').replace(/\s/g, '').slice(0, 2).toUpperCase() + Math.floor(100 + Math.random() * 900);

// normalise a multi-package enrollment list → { json, total, remaining, firstPkg, firstCat, expires }
// `expires` is the soonest enrollment expiry (mirrored onto students.course_expires_at). Each
// entry's expires_at: the admin's explicit value wins; otherwise it's derived from the package's
// validity window (today + valid_days). Packages without valid_days simply carry no expiry.
function buildEnrollments(b, sid) {
  if (!Array.isArray(b.packages) || !b.packages.length) return null;
  const enr = b.packages
    .filter((p) => p && (p.sessions_total != null || p.package_id))
    .map((p) => {
      const e = {
        category: p.category || null,
        package_id: p.package_id || null,
        name: p.name || null,
        sessions_total: Math.max(0, parseInt(p.sessions_total) || 0),
        sessions_remaining: Math.max(0, parseInt(p.sessions_remaining != null ? p.sessions_remaining : p.sessions_total) || 0),
      };
      let exp = (p.expires_at && /^\d{4}-\d{2}-\d{2}/.test(p.expires_at)) ? String(p.expires_at).slice(0, 10) : null;
      if (!exp && sid && e.package_id) {
        const pk = get('SELECT valid_days FROM packages WHERE id = ? AND school_id = ?', e.package_id, sid);
        if (pk && pk.valid_days > 0) exp = addDaysISO(pk.valid_days);
      }
      if (exp) e.expires_at = exp;
      return e;
    });
  if (!enr.length) return null;
  const expDates = enr.map((e) => e.expires_at).filter(Boolean).sort();
  return {
    json: JSON.stringify(enr),
    total: enr.reduce((a, p) => a + p.sessions_total, 0),
    remaining: enr.reduce((a, p) => a + p.sessions_remaining, 0),
    firstPkg: enr[0].package_id,
    firstCat: enr[0].category,
    expires: expDates[0] || null,
  };
}

// shared insert used by POST / and POST /bulk
function insertStudent(sid, b) {
  const cats = Array.isArray(b.categories) ? b.categories.filter(Boolean) : [];
  const enr = buildEnrollments(b, sid);
  const primaryCat = cats[0] || (enr && enr.firstCat) || b.category || null;
  const categoriesJson = cats.length ? JSON.stringify(cats) : null;
  // when multiple packages given, the per-student totals are the aggregate sum
  const sessTotal = enr ? enr.total : (b.sessions_total || b.sessions_remaining || 0);
  const sessRemain = enr ? enr.remaining : (b.sessions_remaining || 0);
  let packageId = (enr && enr.firstPkg) || b.package_id || null;
  // package_id must belong to this school — else it's a cross-tenant reference (leaks another school's package via the join in GET /)
  if (packageId && !get('SELECT id FROM packages WHERE id = ? AND school_id = ?', packageId, sid)) packageId = null;
  const result = run(
    `INSERT INTO students (school_id, name, nickname, age, birthday, parent_name, parent_phone, line_id, category, categories_json,
       teacher_id, package_id, sessions_remaining, sessions_total, balance_due, status, referral_code, parent_token, goal, email, packages_json, recipient_type, honorific, course_expires_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    sid, b.name, b.nickname || null, b.age || null, b.birthday || null, b.parent_name || null, b.parent_phone || null,
    b.line_id || null, primaryCat, categoriesJson, b.teacher_id || null, packageId,
    sessRemain, sessTotal, b.balance_due || 0,
    b.status || 'active', codeFor(b.nickname || b.name), crypto.randomBytes(8).toString('hex'),
    b.goal || null, b.email || null, enr ? enr.json : null, b.recipient_type || null, b.honorific || null,
    enr ? enr.expires : null
  );
  return get('SELECT * FROM students WHERE id = ? AND school_id = ?', Number(result.lastInsertRowid), sid);
}

// POST /api/students/bulk — import many students at once (from CSV/Excel paste)
r.post('/bulk', wrap((req, res) => {
  const list = Array.isArray(req.body.students) ? req.body.students : [];
  if (!list.length) throw bad('no students to import');
  if (list.length > 500) throw bad('too many rows (max 500)');
  const valid = list.filter((s) => s && s.name && String(s.name).trim());
  assertStudentCap(req.schoolId, valid.length);
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
  const sch = get('SELECT near_limit_threshold, course_expiry_enabled FROM schools WHERE id = ?', sid);
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
    // course-expiry status is informational and only computed when the school opted in
    const ce = sch.course_expiry_enabled ? courseExpiryInfo(s) : { has: false };
    return {
      ...s, tier: tierOf(s.points), near_limit: nl.near,
      near_limit_subject: nl.perSubject ? { remaining: nl.remaining, category: nl.category, name: nl.name } : null,
      course_expired: ce.has ? ce.expired : false,
      course_expires_soon: ce.has ? ce.soon : false,
      course_expiry_days: ce.has ? ce.days_left : null,
      course_expiry_subject: ce.has ? { category: ce.category, name: ce.name } : null,
    };
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
  assertStudentCap(req.schoolId, 1);
  res.status(201).json(insertStudent(req.schoolId, b));
}));

// PATCH /api/students/:id — partial update of editable fields
r.patch('/:id', canManage, wrap((req, res) => {
  if (!ownsStudent(req, req.params.id)) throw bad('student not found', 404);
  const s = get('SELECT * FROM students WHERE id = ? AND school_id = ?', req.params.id, req.schoolId);
  if (!s) throw bad('student not found', 404);
  const fields = ['name', 'nickname', 'age', 'birthday', 'parent_name', 'parent_phone', 'line_id', 'category',
    'teacher_id', 'package_id', 'sessions_remaining', 'sessions_total', 'balance_due', 'status', 'goal', 'email', 'recipient_type', 'honorific'];
  // reactivating a paused/inactive student into 'active' consumes a plan seat — enforce the same cap as POST /
  if ('status' in req.body && req.body.status === 'active' && s.status !== 'active') assertStudentCap(req.schoolId, 1);
  if ('package_id' in req.body && req.body.package_id && !get('SELECT id FROM packages WHERE id = ? AND school_id = ?', req.body.package_id, req.schoolId)) {
    throw bad('package not found', 404);
  }
  const sets = [], vals = [];
  for (const f of fields) if (f in req.body) { sets.push(`${f} = ?`); vals.push(req.body[f]); }
  // multi-subject: categories[] → categories_json (+ sync primary category if not set explicitly)
  if ('categories' in req.body) {
    const arr = Array.isArray(req.body.categories) ? req.body.categories.filter(Boolean) : [];
    sets.push('categories_json = ?'); vals.push(arr.length ? JSON.stringify(arr) : null);
    if (!('category' in req.body)) { sets.push('category = ?'); vals.push(arr[0] || null); }
  }
  // recurring auto-billing profile (validated — discount type/value sanitised, package must belong to school)
  if ('billing_enabled' in req.body) {
    // turning auto-billing ON is an ACADEMY+ feature; turning it off is always allowed
    if (req.body.billing_enabled && !planAllows(get('SELECT plan, plan_expires FROM schools WHERE id = ?', req.schoolId), 'autobill')) {
      throw bad('วางบิลอัตโนมัติใช้ได้ในแผน ACADEMY ขึ้นไป — อัปเกรดเพื่อเปิดใช้งาน', 402);
    }
    sets.push('billing_enabled = ?'); vals.push(req.body.billing_enabled ? 1 : 0);
  }
  if ('billing_package_id' in req.body) {
    const pid = req.body.billing_package_id || null;
    if (pid && !get('SELECT id FROM packages WHERE id = ? AND school_id = ?', pid, req.schoolId)) throw bad('billing package not found', 404);
    sets.push('billing_package_id = ?'); vals.push(pid);
  }
  if ('billing_category' in req.body) { sets.push('billing_category = ?'); vals.push(req.body.billing_category || null); }
  if ('billing_discount_type' in req.body) {
    const dt = ['percent', 'amount'].includes(req.body.billing_discount_type) ? req.body.billing_discount_type : null;
    sets.push('billing_discount_type = ?'); vals.push(dt);
  }
  if ('billing_discount_value' in req.body) {
    sets.push('billing_discount_value = ?'); vals.push(Math.max(0, parseInt(req.body.billing_discount_value) || 0));
  }
  // multi-package: packages[] → packages_json + sync aggregate session totals
  if ('packages' in req.body) {
    const enr = buildEnrollments(req.body, req.schoolId);
    if (enr) {
      sets.push('packages_json = ?'); vals.push(enr.json);
      sets.push('course_expires_at = ?'); vals.push(enr.expires); // soonest enrollment expiry (null if none)
      if (!('sessions_total' in req.body)) { sets.push('sessions_total = ?'); vals.push(enr.total); }
      if (!('sessions_remaining' in req.body)) { sets.push('sessions_remaining = ?'); vals.push(enr.remaining); }
      if (!('package_id' in req.body) && enr.firstPkg) { sets.push('package_id = ?'); vals.push(enr.firstPkg); }
    } else {
      sets.push('packages_json = ?'); vals.push(null);
      sets.push('course_expires_at = ?'); vals.push(null);
      // packages cleared — don't leave stale totals from the removed packages behind
      if (!('sessions_total' in req.body)) { sets.push('sessions_total = ?'); vals.push(0); }
      if (!('sessions_remaining' in req.body)) { sets.push('sessions_remaining = ?'); vals.push(0); }
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
