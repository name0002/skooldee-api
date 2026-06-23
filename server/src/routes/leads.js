import { Router } from 'express';
import { run, all } from '../db.js';
import { requireAuth, requireRole, optionalAuth } from '../auth.js';
import { wrap } from '../util.js';

const router = Router();

// POST /api/leads — public (no auth required). If the caller IS logged in (e.g. the
// sign-up flow posts right after register with its fresh token), the lead is scoped
// to their school via optionalAuth; anonymous posts get school_id = NULL.
router.post('/', optionalAuth, wrap((req, res) => {
  const { school, name, phone, email, category, size, plan, message, source } = req.body;
  if (!email && !phone) {
    return res.status(400).json({ error: 'email หรือ phone จำเป็นต้องระบุ' });
  }
  run(
    `INSERT INTO leads (school_id, school, name, phone, email, category, size, plan, message, source)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    req.schoolId || null,
    school || null, name || null, phone || null, email || null,
    category || null, size || null, plan || null, message || null,
    source || 'signup'
  );
  res.json({ ok: true });
}));

// GET /api/leads — owner/admin only, scoped to the caller's own school
router.get('/', requireAuth, requireRole('owner', 'admin'), wrap((req, res) => {
  const leads = all(`SELECT * FROM leads WHERE school_id = ? ORDER BY created_at DESC LIMIT 200`, req.schoolId);
  res.json(leads);
}));

export default router;
