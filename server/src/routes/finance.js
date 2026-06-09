import { Router } from 'express';
import { all, get, run } from '../db.js';
import { wrap, required, bad, today } from '../util.js';

const r = Router();

// GET /api/finance/invoices?status=unpaid
r.get('/invoices', wrap((req, res) => {
  let rows = all(
    `SELECT i.*, s.name AS student_name, p.name AS package_name FROM invoices i
       JOIN students s ON s.id = i.student_id
       LEFT JOIN packages p ON p.id = i.package_id
      WHERE i.school_id = ? ORDER BY i.issued_at DESC`, req.schoolId);
  if (req.query.status) rows = rows.filter((i) => i.status === req.query.status);
  res.json(rows);
}));

// POST /api/finance/invoices — issue an invoice. If renewing a package, tops up sessions.
r.post('/invoices', wrap((req, res) => {
  const b = required(req.body, ['student_id', 'amount']);
  const student = get('SELECT * FROM students WHERE id = ? AND school_id = ?', b.student_id, req.schoolId);
  if (!student) throw bad('student not found', 404);
  const result = run(
    'INSERT INTO invoices (school_id, student_id, package_id, amount, status, note) VALUES (?,?,?,?,?,?)',
    req.schoolId, b.student_id, b.package_id || null, b.amount, b.status || 'unpaid', b.note || null);
  res.status(201).json(get('SELECT * FROM invoices WHERE id = ?', Number(result.lastInsertRowid)));
}));

// POST /api/finance/invoices/:id/pay — mark paid; optionally top-up sessions from the package (renewal)
r.post('/invoices/:id/pay', wrap((req, res) => {
  const inv = get('SELECT * FROM invoices WHERE id = ? AND school_id = ?', req.params.id, req.schoolId);
  if (!inv) throw bad('invoice not found', 404);
  if (inv.status === 'paid') throw bad('already paid');
  run("UPDATE invoices SET status = 'paid', paid_at = ? WHERE id = ?", today(), inv.id);

  if (inv.package_id) {
    const pkg = get('SELECT * FROM packages WHERE id = ? AND school_id = ?', inv.package_id, req.schoolId);
    if (pkg) {
      run('UPDATE students SET sessions_remaining = sessions_remaining + ?, sessions_total = ? WHERE id = ?',
        pkg.sessions, pkg.sessions, inv.student_id);
    }
  }
  res.json(get('SELECT * FROM invoices WHERE id = ?', inv.id));
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
      WHERE school_id = ? AND status = 'unpaid'`, sid);
  res.json({ month, revenue, outstanding });
}));

export default r;
