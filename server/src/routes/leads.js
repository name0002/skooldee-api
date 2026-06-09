import { Router } from 'express';
import { run, all } from '../db.js';
import { requireAuth, requireRole } from '../auth.js';
import { wrap } from '../util.js';

const router = Router();

// POST /api/leads — public, no auth (lead capture from landing page)
router.post('/', wrap((req, res) => {
  const { school, name, phone, email, category, size, plan, message, source } = req.body;
  if (!email && !phone) {
    return res.status(400).json({ error: 'email หรือ phone จำเป็นต้องระบุ' });
  }
  run(
    `INSERT INTO leads (school, name, phone, email, category, size, plan, message, source)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    school || null, name || null, phone || null, email || null,
    category || null, size || null, plan || null, message || null,
    source || 'signup'
  );
  res.json({ ok: true });
}));

// GET /api/leads — owner/admin only, view all leads
router.get('/', requireAuth, requireRole('owner', 'admin'), wrap((req, res) => {
  const leads = all(`SELECT * FROM leads ORDER BY created_at DESC LIMIT 200`);
  res.json(leads);
}));

export default router;
