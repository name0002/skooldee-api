import { Router } from 'express';
import { get, run } from '../db.js';
import { wrap, bad } from '../util.js';
import { requireRole } from '../auth.js';

const r = Router();

const parseRooms = (json) => { try { const a = JSON.parse(json || '[]'); return Array.isArray(a) ? a.filter((x) => typeof x === 'string' && x.trim()) : []; } catch { return []; } };

// GET /api/schools — current school profile
r.get('/', wrap((req, res) => {
  const school = get('SELECT id, name, slug, category, near_limit_threshold, categories_json, line_token, line_secret, notify_prefs, name_display, hours_start, hours_end, contact_phone, line_oa_url, line_oa_basic_id, liff_id, rooms_json, assessment_criteria_json, show_assessments_to_parents, show_course_no_to_parents, invite_message_template, homework_message_template, payment_qr_image, logo_image, plan, plan_expires, created_at FROM schools WHERE id = ?', req.schoolId);
  if (!school) throw bad('school not found', 404);
  // never expose raw LINE credentials — only whether they are configured
  const { line_token, line_secret, notify_prefs, rooms_json, show_assessments_to_parents, show_course_no_to_parents, ...safe } = school;
  let prefs = {};
  try { prefs = notify_prefs ? JSON.parse(notify_prefs) : {}; } catch { prefs = {}; }
  res.json({ ...safe, rooms: parseRooms(rooms_json), line_configured: !!line_token, line_secret_configured: !!line_secret, notify_prefs: prefs, show_assessments_to_parents: !!show_assessments_to_parents, show_course_no_to_parents: !!show_course_no_to_parents });
}));

// PATCH /api/schools — update school profile (owner/admin only)
r.patch('/', requireRole('owner', 'admin'), wrap((req, res) => {
  const { name, category, near_limit_threshold, categories_json, line_token, line_secret, notify_prefs, name_display, hours_start, hours_end } = req.body;
  const sets = [], vals = [];
  if (name && String(name).trim()) { sets.push('name = ?'); vals.push(String(name).trim()); }
  if (category !== undefined) { sets.push('category = ?'); vals.push(category || null); }
  if (near_limit_threshold !== undefined) {
    const n = Math.max(1, Math.min(10, parseInt(near_limit_threshold) || 2));
    sets.push('near_limit_threshold = ?'); vals.push(n);
  }
  if (categories_json !== undefined) {
    sets.push('categories_json = ?');
    vals.push(categories_json === null ? null : JSON.stringify(categories_json));
  }
  if (line_token !== undefined) {
    // empty string clears the token; otherwise store trimmed value
    const t = (line_token === null || String(line_token).trim() === '') ? null : String(line_token).trim();
    sets.push('line_token = ?'); vals.push(t);
  }
  if (line_secret !== undefined) {
    const s2 = (line_secret === null || String(line_secret).trim() === '') ? null : String(line_secret).trim();
    sets.push('line_secret = ?'); vals.push(s2);
  }
  if (notify_prefs !== undefined) {
    sets.push('notify_prefs = ?');
    vals.push(notify_prefs && typeof notify_prefs === 'object' ? JSON.stringify(notify_prefs) : null);
  }
  if (name_display !== undefined) {
    sets.push('name_display = ?'); vals.push(['nick', 'both'].includes(name_display) ? name_display : 'full');
  }
  if (hours_start !== undefined) { sets.push('hours_start = ?'); vals.push(Math.max(0, Math.min(1439, parseInt(hours_start) || 600))); }
  if (hours_end !== undefined) { sets.push('hours_end = ?'); vals.push(Math.max(0, Math.min(1440, parseInt(hours_end) || 1200))); }
  if (req.body.contact_phone !== undefined) {
    const ph = String(req.body.contact_phone || '').trim().slice(0, 40);
    sets.push('contact_phone = ?'); vals.push(ph || null);
  }
  if (req.body.line_oa_url !== undefined) {
    const u = String(req.body.line_oa_url || '').trim().slice(0, 200);
    sets.push('line_oa_url = ?'); vals.push(u || null);
  }
  if (req.body.liff_id !== undefined) {
    // LIFF id is a short token like "1656879xxx-AbCdEfGh" (numbers, dash, base62)
    const raw = String(req.body.liff_id || '').trim().slice(0, 60);
    const liff = /^[\w-]+$/.test(raw) ? raw : '';
    sets.push('liff_id = ?'); vals.push(liff || null);
  }
  if (req.body.rooms_json !== undefined) {
    const arr = Array.isArray(req.body.rooms_json) ? req.body.rooms_json : [];
    const clean = [...new Set(arr.map((x) => String(x || '').trim().slice(0, 60)).filter(Boolean))];
    sets.push('rooms_json = ?'); vals.push(JSON.stringify(clean));
  }
  // assessment rubric: { "<catKey>": ["เกณฑ์1","เกณฑ์2",...] } — sanitise names + cap counts
  if (req.body.assessment_criteria_json !== undefined) {
    let clean = null;
    const raw = req.body.assessment_criteria_json;
    if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
      clean = {};
      for (const [k, list] of Object.entries(raw)) {
        if (!Array.isArray(list)) continue;
        const names = [...new Set(list.map((x) => String(x || '').trim().slice(0, 60)).filter(Boolean))].slice(0, 12);
        if (names.length) clean[String(k).slice(0, 40)] = names;
      }
    }
    sets.push('assessment_criteria_json = ?'); vals.push(clean ? JSON.stringify(clean) : null);
  }
  if (req.body.show_assessments_to_parents !== undefined) {
    sets.push('show_assessments_to_parents = ?'); vals.push(req.body.show_assessments_to_parents ? 1 : 0);
  }
  if (req.body.show_course_no_to_parents !== undefined) {
    sets.push('show_course_no_to_parents = ?'); vals.push(req.body.show_course_no_to_parents ? 1 : 0);
  }
  if (req.body.invite_message_template !== undefined) {
    const t = String(req.body.invite_message_template || '').slice(0, 1000).trim();
    sets.push('invite_message_template = ?'); vals.push(t || null);
  }
  if (req.body.homework_message_template !== undefined) {
    const t = String(req.body.homework_message_template || '').slice(0, 1000).trim();
    sets.push('homework_message_template = ?'); vals.push(t || null);
  }
  if (req.body.payment_qr_image !== undefined) {
    const img = req.body.payment_qr_image ? String(req.body.payment_qr_image) : null;
    if (img && img.length > 3_000_000) throw bad('รูป QR ใหญ่เกินไป (สูงสุด 3 MB)');
    sets.push('payment_qr_image = ?'); vals.push(img || null);
  }
  if (req.body.logo_image !== undefined) {
    const img = req.body.logo_image ? String(req.body.logo_image) : null;
    if (img && img.length > 3_000_000) throw bad('รูปโลโก้ใหญ่เกินไป (สูงสุด 3 MB)');
    sets.push('logo_image = ?'); vals.push(img || null);
  }
  if (!sets.length) throw bad('no fields to update');
  run(`UPDATE schools SET ${sets.join(', ')} WHERE id = ?`, ...vals, req.schoolId);
  const s = get('SELECT id, name, slug, category, near_limit_threshold, categories_json, line_token, line_secret, notify_prefs, name_display, hours_start, hours_end, contact_phone, line_oa_url, liff_id, rooms_json, assessment_criteria_json, show_assessments_to_parents, show_course_no_to_parents, invite_message_template, homework_message_template, payment_qr_image, logo_image, plan, plan_expires FROM schools WHERE id = ?', req.schoolId);
  const { line_token: lt, line_secret: ls, notify_prefs: np, rooms_json: rj, show_assessments_to_parents: sap, show_course_no_to_parents: scp, ...safe } = s;
  let prefs = {};
  try { prefs = np ? JSON.parse(np) : {}; } catch { prefs = {}; }
  res.json({ ...safe, rooms: parseRooms(rj), line_configured: !!lt, line_secret_configured: !!ls, notify_prefs: prefs, show_assessments_to_parents: !!sap, show_course_no_to_parents: !!scp });
}));

// POST /api/schools/rooms/rename — rename a classroom EVERYWHERE: all slots, category
// defaults, and the managed room list. { from, to }  (owner/admin only)
r.post('/rooms/rename', requireRole('owner', 'admin'), wrap((req, res) => {
  const from = String(req.body.from || '').trim();
  const to = String(req.body.to || '').trim().slice(0, 60);
  if (!from || !to) throw bad('from/to required');
  if (from === to) return res.json({ ok: true, slots_updated: 0 });
  const upd = run('UPDATE schedule_slots SET room = ? WHERE school_id = ? AND room = ?', to, req.schoolId, from);
  const school = get('SELECT categories_json, rooms_json FROM schools WHERE id = ?', req.schoolId);
  // category default rooms
  try {
    const cats = JSON.parse(school.categories_json || 'null');
    if (Array.isArray(cats)) {
      let changed = false;
      cats.forEach((c) => { if (c && c.room === from) { c.room = to; changed = true; } });
      if (changed) run('UPDATE schools SET categories_json = ? WHERE id = ?', JSON.stringify(cats), req.schoolId);
    }
  } catch { /* ignore */ }
  // managed room registry
  const rooms = parseRooms(school.rooms_json).map((x) => (x === from ? to : x));
  if (rooms.indexOf(to) < 0) rooms.push(to);
  run('UPDATE schools SET rooms_json = ? WHERE id = ?', JSON.stringify([...new Set(rooms)]), req.schoolId);
  res.json({ ok: true, slots_updated: upd.changes, rooms: [...new Set(rooms)] });
}));

export default r;
