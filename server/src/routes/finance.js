import { Router } from 'express';
import { all, get, run } from '../db.js';
import { wrap, required, bad, today, addDaysISO } from '../util.js';
import { maybeNotify } from '../line-push.js';

const r = Router();

// GET /api/finance/invoices?status=unpaid
r.get('/invoices', wrap((req, res) => {
  let rows = all(
    `SELECT i.*, s.name AS student_name, p.name AS package_name FROM invoices i
       JOIN students s ON s.id = i.student_id
       LEFT JOIN packages p ON p.id = i.package_id
      WHERE i.school_id = ? ORDER BY i.issued_at DESC`, req.schoolId);
  if (req.query.status) rows = rows.filter((i) => i.status === req.query.status);
  // strip the (potentially large) slip image from the list; expose only whether one exists
  res.json(rows.map(({ slip_image, ...r }) => ({ ...r, has_slip: !!slip_image })));
}));

// GET /api/finance/invoices/:id/slip — the attached payment-slip image (data URL)
r.get('/invoices/:id/slip', wrap((req, res) => {
  const inv = get('SELECT slip_image FROM invoices WHERE id = ? AND school_id = ?', req.params.id, req.schoolId);
  if (!inv) throw bad('invoice not found', 404);
  res.json({ image: inv.slip_image || null });
}));

// POST /api/finance/invoices/:id/slip — attach (or clear, if image is empty) a payment slip
r.post('/invoices/:id/slip', wrap((req, res) => {
  const inv = get('SELECT id FROM invoices WHERE id = ? AND school_id = ?', req.params.id, req.schoolId);
  if (!inv) throw bad('invoice not found', 404);
  const img = req.body && req.body.image ? String(req.body.image) : null;
  if (img && img.length > 3_000_000) throw bad('รูปใหญ่เกินไป (ลองถ่ายใหม่หรือย่อขนาด)');
  run('UPDATE invoices SET slip_image = ? WHERE id = ? AND school_id = ?', img, inv.id, req.schoolId);
  res.json({ ok: true, has_slip: !!img });
}));

// Apply a paid renewal to a student: top up the right SUBJECT inside packages_json
// (so multi-subject students renew the correct course), bump that subject's course
// round, and keep the aggregate sessions_remaining/total in sync. Returns the values
// to persist. Single-subject students (no packages_json yet) get migrated into the
// structured form on their first renewal, preserving any leftover sessions.
function applyRenewal(student, pkg, category) {
  let pj = [];
  try { pj = student.packages_json ? JSON.parse(student.packages_json) : []; } catch { pj = []; }
  if (!Array.isArray(pj)) pj = [];
  const cat = category || student.category || null;

  let entry = pj.find((p) => (p.category || null) === cat);
  if (!entry && pj.length && !category) entry = pj[0]; // no category given on a single enrollment
  if (!entry) {
    // seed from legacy fields only when this is the student's first structured entry
    const seedRem = pj.length === 0 ? (student.sessions_remaining || 0) : 0;
    const seedTot = pj.length === 0 ? (student.sessions_total || 0) : 0;
    entry = { category: cat, package_id: pkg.id, name: pkg.name, sessions_total: seedTot, sessions_remaining: seedRem, round: 1 };
    pj.push(entry);
  }
  entry.round = (entry.round || 1) + 1;                 // first renewal → course #2
  entry.sessions_remaining = (entry.sessions_remaining || 0) + pkg.sessions;
  entry.sessions_total = entry.sessions_remaining;       // fresh course → bar shows full
  entry.package_id = pkg.id;
  entry.name = pkg.name;
  // a fresh course resets the expiry clock: a package with a validity window expires N days
  // from today; one without clears any old expiry (this renewal no longer expires).
  if (pkg.valid_days > 0) entry.expires_at = addDaysISO(pkg.valid_days);
  else delete entry.expires_at;

  const aggRemaining = pj.reduce((a, p) => a + (p.sessions_remaining || 0), 0);
  const aggTotal = pj.reduce((a, p) => a + (p.sessions_total || 0), 0);
  const expDates = pj.map((p) => p.expires_at).filter(Boolean).sort();
  return {
    packages_json: JSON.stringify(pj), sessions_remaining: aggRemaining, sessions_total: aggTotal,
    course_expires_at: expDates[0] || null, round: entry.round,
  };
}

// compute net amount from a subtotal + discount (returns { subtotal, dtype, dval, amount })
export function applyDiscount(rawSubtotal, rawType, rawValue) {
  const subtotal = Math.max(0, parseInt(rawSubtotal) || 0);
  const dtype = ['percent', 'amount'].includes(rawType) ? rawType : null;
  const dval = dtype ? Math.max(0, parseInt(rawValue) || 0) : 0;
  let discount = 0;
  if (dtype === 'percent') discount = Math.round(subtotal * Math.min(dval, 100) / 100);
  else if (dtype === 'amount') discount = Math.min(dval, subtotal);
  return { subtotal, dtype, dval, amount: Math.max(0, subtotal - discount) };
}

// POST /api/finance/invoices — issue an invoice. If renewing a package, tops up sessions.
r.post('/invoices', wrap((req, res) => {
  const b = required(req.body, ['student_id', 'amount']);
  const student = get('SELECT * FROM students WHERE id = ? AND school_id = ?', b.student_id, req.schoolId);
  if (!student) throw bad('student not found', 404);
  const validMethods = ['transfer','cash','qr','card'];
  const method = validMethods.includes(b.payment_method) ? b.payment_method : 'transfer';
  // subtotal defaults to amount when no explicit subtotal sent (back-compat)
  const { subtotal, dtype, dval, amount } = applyDiscount(b.subtotal != null ? b.subtotal : b.amount, b.discount_type, b.discount_value);
  const category = (b.category && String(b.category).trim()) ? String(b.category).trim() : null;
  const result = run(
    'INSERT INTO invoices (school_id, student_id, package_id, amount, status, note, payment_method, subtotal, discount_type, discount_value, category) VALUES (?,?,?,?,?,?,?,?,?,?,?)',
    req.schoolId, b.student_id, b.package_id || null, amount, b.status || 'unpaid', b.note || null, method, subtotal, dtype, dval, category);

  const invId = Number(result.lastInsertRowid);
  if ((b.status || 'unpaid') === 'paid') {
    // created already-paid → stamp paid_at and apply the renewal top-up now
    run("UPDATE invoices SET paid_at = ? WHERE id = ? AND school_id = ?", today(), invId, req.schoolId);
    if (b.package_id) {
      const pkg = get('SELECT * FROM packages WHERE id = ? AND school_id = ?', b.package_id, req.schoolId);
      if (pkg) {
        const up = applyRenewal(student, pkg, category);
        run('UPDATE students SET sessions_remaining = ?, sessions_total = ?, packages_json = ?, course_expires_at = ? WHERE id = ? AND school_id = ?',
          up.sessions_remaining, up.sessions_total, up.packages_json, up.course_expires_at, student.id, req.schoolId);
      }
    }
  } else {
    // opt-in LINE notification for a new (unpaid) invoice
    maybeNotify(req.schoolId, b.student_id, 'invoice',
      `🧾 มีใบแจ้งหนี้ใหม่สำหรับน้อง${student.nickname || student.name}\nจำนวน ฿${Number(amount).toLocaleString()} — กรุณาติดต่อโรงเรียนเพื่อชำระค่ะ`);
  }
  res.status(201).json(get('SELECT * FROM invoices WHERE id = ?', invId));
}));

// PATCH /api/finance/invoices/:id — edit an invoice (fix typos). Recomputes net from discount.
r.patch('/invoices/:id', wrap((req, res) => {
  const inv = get('SELECT * FROM invoices WHERE id = ? AND school_id = ?', req.params.id, req.schoolId);
  if (!inv) throw bad('invoice not found', 404);
  const b = req.body || {};

  let studentId = inv.student_id;
  if (b.student_id !== undefined && b.student_id !== inv.student_id) {
    const s = get('SELECT id FROM students WHERE id = ? AND school_id = ?', b.student_id, req.schoolId);
    if (!s) throw bad('student not found', 404);
    studentId = b.student_id;
  }
  const validMethods = ['transfer','cash','qr','card'];
  const method = b.payment_method !== undefined && validMethods.includes(b.payment_method) ? b.payment_method : inv.payment_method;
  const baseSubtotal = b.subtotal !== undefined ? b.subtotal : (inv.subtotal != null ? inv.subtotal : inv.amount);
  const dt = b.discount_type !== undefined ? b.discount_type : inv.discount_type;
  const dv = b.discount_value !== undefined ? b.discount_value : inv.discount_value;
  const { subtotal, dtype, dval, amount } = applyDiscount(baseSubtotal, dt, dv);

  const category = b.category !== undefined
    ? ((b.category && String(b.category).trim()) ? String(b.category).trim() : null)
    : inv.category;
  run(`UPDATE invoices SET student_id = ?, package_id = ?, note = ?, payment_method = ?,
         subtotal = ?, discount_type = ?, discount_value = ?, amount = ?, category = ? WHERE id = ? AND school_id = ?`,
    studentId,
    b.package_id !== undefined ? (b.package_id || null) : inv.package_id,
    b.note !== undefined ? (b.note || null) : inv.note,
    method, subtotal, dtype, dval, amount, category, inv.id, req.schoolId);
  res.json(get('SELECT * FROM invoices WHERE id = ?', inv.id));
}));

// DELETE /api/finance/invoices/:id — void/remove an invoice issued by mistake
r.delete('/invoices/:id', wrap((req, res) => {
  const result = run('DELETE FROM invoices WHERE id = ? AND school_id = ?', req.params.id, req.schoolId);
  if (!result.changes) throw bad('invoice not found', 404);
  res.json({ ok: true });
}));

// POST /api/finance/invoices/:id/approve-slip — admin confirms a parent-submitted slip → paid
r.post('/invoices/:id/approve-slip', wrap((req, res) => {
  const inv = get('SELECT * FROM invoices WHERE id = ? AND school_id = ?', req.params.id, req.schoolId);
  if (!inv) throw bad('invoice not found', 404);
  if (inv.status !== 'pending_verification') throw bad('สถานะต้องเป็น pending_verification');
  run("UPDATE invoices SET status = 'paid', paid_at = ? WHERE id = ? AND school_id = ?", today(), inv.id, req.schoolId);
  if (inv.package_id) {
    const pkg = get('SELECT * FROM packages WHERE id = ? AND school_id = ?', inv.package_id, req.schoolId);
    const student = get('SELECT * FROM students WHERE id = ? AND school_id = ?', inv.student_id, req.schoolId);
    if (pkg && student) {
      const up = applyRenewal(student, pkg, inv.category);
      run('UPDATE students SET sessions_remaining = ?, sessions_total = ?, packages_json = ?, course_expires_at = ? WHERE id = ? AND school_id = ?',
        up.sessions_remaining, up.sessions_total, up.packages_json, up.course_expires_at, inv.student_id, req.schoolId);
    }
  }
  res.json(get('SELECT * FROM invoices WHERE id = ?', inv.id));
}));

// POST /api/finance/invoices/:id/reject-slip — admin rejects a parent-submitted slip → back to unpaid
r.post('/invoices/:id/reject-slip', wrap((req, res) => {
  const inv = get('SELECT id, status FROM invoices WHERE id = ? AND school_id = ?', req.params.id, req.schoolId);
  if (!inv) throw bad('invoice not found', 404);
  // never reject a slip on an already-paid invoice: that would flip it back to unpaid
  // without reversing the sessions the payment already granted (free top-up on an unpaid bill).
  if (inv.status === 'paid') throw bad('ใบแจ้งหนี้นี้ชำระแล้ว ไม่สามารถปฏิเสธสลิปได้');
  run("UPDATE invoices SET status = 'unpaid', slip_image = NULL WHERE id = ? AND school_id = ?", inv.id, req.schoolId);
  res.json({ ok: true });
}));

// POST /api/finance/invoices/:id/pay — mark paid; optionally top-up sessions from the package (renewal)
r.post('/invoices/:id/pay', wrap((req, res) => {
  const inv = get('SELECT * FROM invoices WHERE id = ? AND school_id = ?', req.params.id, req.schoolId);
  if (!inv) throw bad('invoice not found', 404);
  if (inv.status === 'paid') throw bad('already paid');
  run("UPDATE invoices SET status = 'paid', paid_at = ? WHERE id = ? AND school_id = ?", today(), inv.id, req.schoolId);

  if (inv.package_id) {
    const pkg = get('SELECT * FROM packages WHERE id = ? AND school_id = ?', inv.package_id, req.schoolId);
    const student = get('SELECT * FROM students WHERE id = ? AND school_id = ?', inv.student_id, req.schoolId);
    if (pkg && student) {
      const up = applyRenewal(student, pkg, inv.category);
      run('UPDATE students SET sessions_remaining = ?, sessions_total = ?, packages_json = ?, course_expires_at = ? WHERE id = ? AND school_id = ?',
        up.sessions_remaining, up.sessions_total, up.packages_json, up.course_expires_at, inv.student_id, req.schoolId);
    }
  }
  res.json(get('SELECT * FROM invoices WHERE id = ?', inv.id));
}));

// GET /api/finance/revenue?months=7 — monthly revenue breakdown (for the bar chart)
r.get('/revenue', wrap((req, res) => {
  const sid = req.schoolId;
  const months = Math.min(parseInt(req.query.months) || 7, 24);
  const thaiMon = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];
  const rows = [];
  const now = new Date();
  for (let i = months - 1; i >= 0; i--) {
    // Use UTC consistently. paid_at, the dashboard KPI and /summary all group by the UTC
    // year-month (today() is UTC). Building the month from a LOCAL-midnight date and then
    // toISOString() shifted `ym` back a month in UTC+7 while `label` stayed local — so in
    // Thailand every bar showed the wrong month and the current month read ฿0.
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    const ym = d.toISOString().slice(0, 7); // YYYY-MM
    const rev = get(
      `SELECT COALESCE(SUM(amount),0) t FROM invoices WHERE school_id=? AND status='paid' AND substr(paid_at,1,7)=?`,
      sid, ym).t;
    rows.push({ month: ym, label: thaiMon[d.getUTCMonth()], revenue: rev });
  }
  res.json(rows);
}));

// GET /api/finance/summary — monthly revenue + outstanding
r.get('/summary', wrap((req, res) => {
  const sid = req.schoolId;
  const month = (req.query.month || today().slice(0, 7)); // YYYY-MM
  const revenue = get(
    `SELECT COALESCE(SUM(amount),0) total, COUNT(*) count FROM invoices
      WHERE school_id = ? AND status = 'paid' AND substr(paid_at,1,7) = ?`, sid, month);
  const outstanding = get(
    `SELECT COALESCE(SUM(amount),0) total, COUNT(*) count FROM invoices
      WHERE school_id = ? AND status IN ('unpaid', 'pending_verification')`, sid);
  res.json({ month, revenue, outstanding });
}));

export default r;
