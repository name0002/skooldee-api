import { Router } from 'express';
import { all, get, run } from '../db.js';
import { wrap, bad, hhmm } from '../util.js';
import { sendEmail, tplNewEnrollment } from '../email.js';
import { maybeNotifyTeacher, pushToParent } from '../line-push.js';

const r = Router();

const DOW = ['จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์', 'อาทิตย์'];
const KIND_LABEL = { group: 'คลาสกลุ่ม', private: 'เรียนตัวต่อตัว', makeup: 'เรียนชดเชย', trial: 'ทดลองเรียน' };

// Build the non-sensitive parent-portal payload for one student row.
// Never includes phone/parent name/finance internals beyond the unpaid balance.
function buildStudentPayload(s) {
  let cats = [];
  try { if (s.categories_json) cats = JSON.parse(s.categories_json); } catch { cats = []; }
  if (!cats.length && s.category) cats = [s.category];

  const slots = all(
    `SELECT sl.day_of_week, sl.start_min, sl.end_min, sl.category, t.name AS teacher_name
       FROM slot_students ss
       JOIN schedule_slots sl ON sl.id = ss.slot_id
       LEFT JOIN teachers t ON t.id = sl.teacher_id
      WHERE ss.student_id = ? ORDER BY sl.day_of_week, sl.start_min`, s.id);

  const homework = all(
    `SELECT title, detail, due_date, status FROM homework
      WHERE student_id = ? AND school_id = ? ORDER BY created_at DESC LIMIT 10`, s.id, s.school_id);

  const attendance = all(
    `SELECT a.date, a.status, sl.start_min, sl.end_min, sl.category
       FROM attendance a
       LEFT JOIN schedule_slots sl ON sl.id = a.slot_id
      WHERE a.student_id = ? AND a.school_id = ?
      ORDER BY a.date DESC LIMIT 15`, s.id, s.school_id);

  const unpaidInvoices = all(
    `SELECT id, amount, subtotal, discount_type, discount_value, issued_at, status
       FROM invoices WHERE student_id = ? AND school_id = ? AND status IN ('unpaid', 'pending_verification')
      ORDER BY issued_at DESC LIMIT 3`, s.id, s.school_id);

  const paidInvoices = all(
    `SELECT i.id, i.amount, i.subtotal, i.discount_type, i.discount_value,
            i.issued_at, i.paid_at, i.payment_method, i.note, i.category,
            p.name AS package_name
       FROM invoices i
       LEFT JOIN packages p ON p.id = i.package_id
      WHERE i.student_id = ? AND i.school_id = ? AND i.status = 'paid'
      ORDER BY i.paid_at DESC LIMIT 5`, s.id, s.school_id);

  // per-category session breakdown from packages_json (if student has multi-subject packages)
  const schoolFlags = get('SELECT show_assessments_to_parents, show_course_no_to_parents FROM schools WHERE id = ?', s.school_id) || {};
  const showCourseNo = !!schoolFlags.show_course_no_to_parents;
  let sessionsByCategory = [];
  if (s.packages_json) {
    try {
      const pkgs = JSON.parse(s.packages_json);
      if (Array.isArray(pkgs) && pkgs.length > 1) {
        sessionsByCategory = pkgs
          .filter((p) => p.sessions_total > 0)
          .map((p) => ({
            category: p.category || null,
            remaining: p.sessions_remaining || 0,
            total: p.sessions_total || 0,
            round: showCourseNo ? (p.round || 1) : null, // course # only when the school opts in
          }));
      }
    } catch { /* ignore malformed json */ }
  }

  // development assessments — only exposed to parents when the school enables it.
  let assessments = [];
  if (schoolFlags.show_assessments_to_parents) {
    const rows = all(
      `SELECT category, date, scores_json FROM assessments
        WHERE student_id = ? AND school_id = ? ORDER BY date DESC, id DESC LIMIT 12`, s.id, s.school_id);
    const seen = new Set(); // keep only the latest assessment per subject
    for (const a of rows) {
      const key = a.category || '_';
      if (seen.has(key)) continue;
      seen.add(key);
      let scores = {};
      try { scores = JSON.parse(a.scores_json || '{}'); } catch { scores = {}; }
      if (Object.keys(scores).length) assessments.push({ category: a.category || null, date: a.date, scores });
    }
  }

  return {
    token: s.parent_token,
    student: { name: s.name, nickname: s.nickname, goal: s.goal || null },
    categories: cats,
    assessments,
    sessions: { remaining: s.sessions_remaining, total: s.sessions_total, by_category: sessionsByCategory },
    balance_due: s.balance_due || 0,
    schedule: slots.map((sl) => ({
      day: DOW[sl.day_of_week] || '',
      day_of_week: sl.day_of_week,
      start: hhmm(sl.start_min),
      end: hhmm(sl.end_min),
      category: sl.category,
      teacher: sl.teacher_name || '-',
    })),
    attendance_recent: attendance.map((a) => ({
      date: a.date,
      status: a.status,
      start: a.start_min != null ? hhmm(a.start_min) : null,
      end: a.end_min != null ? hhmm(a.end_min) : null,
      category: a.category || null,
    })),
    homework: homework.map((h) => ({
      title: h.title, detail: h.detail, due_date: h.due_date, status: h.status,
    })),
    invoices_unpaid: unpaidInvoices.map((inv) => ({
      id: inv.id,
      amount: inv.amount,
      issued_at: inv.issued_at ? inv.issued_at.slice(0, 10) : null,
      status: inv.status, // 'unpaid' | 'pending_verification'
    })),
    invoices_paid: paidInvoices.map((inv) => ({
      id: inv.id,
      amount: inv.amount,
      subtotal: inv.subtotal != null ? inv.subtotal : inv.amount,
      discount_type: inv.discount_type || null,
      discount_value: inv.discount_value || 0,
      issued_at: inv.issued_at ? inv.issued_at.slice(0, 10) : null,
      paid_at: inv.paid_at ? inv.paid_at.slice(0, 10) : null,
      course: inv.package_name || inv.note || 'คอร์สเรียน',
      category: inv.category || null,
    })),
  };
}

/**
 * GET /api/public/student/:token — read-only parent portal data (NO AUTH).
 * Single child. Kept for backward compatibility (old saved links / Rich Menu).
 * Scoped entirely by the random token.
 */
r.get('/student/:token', wrap((req, res) => {
  const token = String(req.params.token || '');
  if (token.length < 8) throw bad('not found', 404);
  const s = get('SELECT * FROM students WHERE parent_token = ?', token);
  if (!s) throw bad('not found', 404);
  const school = get('SELECT name, slug, contact_phone, logo_image, payment_qr_image, payso_link, slip_enabled FROM schools WHERE id = ?', s.school_id);
  res.json({
    school: school ? school.name : 'โรงเรียน',
    school_slug: (school && school.slug) || null,
    school_contact_phone: (school && school.contact_phone) || null,
    school_logo: (school && school.logo_image) || null,
    payment_qr_image: (school && school.payment_qr_image) || null,
    payso_link: (school && school.payso_link) || null,
    slip_enabled: school ? !!school.slip_enabled : true,
    ...buildStudentPayload(s),
  });
}));

/**
 * GET /api/public/family/:token — read-only parent portal for ALL of a guardian's
 * children at once (NO AUTH). The token identifies one child; siblings are every
 * other ACTIVE student in the SAME school linked to the SAME LINE account
 * (line_user_id). If the child isn't LINE-linked, only that child is returned.
 * The token's own child is always returned first so the page opens on them.
 */
r.get('/family/:token', wrap((req, res) => {
  const token = String(req.params.token || '');
  if (token.length < 8) throw bad('not found', 404);
  const anchor = get('SELECT * FROM students WHERE parent_token = ?', token);
  if (!anchor) throw bad('not found', 404);

  const school = get('SELECT name, slug, contact_phone, logo_image, payment_qr_image, payso_link, slip_enabled FROM schools WHERE id = ?', anchor.school_id);

  let siblings = [anchor];
  if (anchor.line_user_id) {
    const rows = all(
      `SELECT * FROM students
        WHERE school_id = ? AND line_user_id = ? AND status != 'inactive'
        ORDER BY id`,
      anchor.school_id, anchor.line_user_id);
    if (rows.length) {
      // anchor first, then the rest in id order (de-duped)
      siblings = [anchor, ...rows.filter((r2) => r2.id !== anchor.id)];
    }
  }

  res.json({
    school: school ? school.name : 'โรงเรียน',
    school_slug: (school && school.slug) || null,
    school_contact_phone: (school && school.contact_phone) || null,
    school_logo: (school && school.logo_image) || null,
    payment_qr_image: (school && school.payment_qr_image) || null,
    payso_link: (school && school.payso_link) || null,
    slip_enabled: school ? !!school.slip_enabled : true,
    children: siblings.map(buildStudentPayload),
  });
}));

/**
 * GET /api/public/link-info/:token — data the LIFF auto-link page needs to render
 * (NO AUTH). Returns the school's LIFF id (so the page can liff.init), the child's
 * name, and whether they're already linked. The random parent_token is the capability.
 */
r.get('/link-info/:token', wrap((req, res) => {
  const token = String(req.params.token || '');
  if (token.length < 8) throw bad('not found', 404);
  const s = get('SELECT id, school_id, name, nickname, line_user_id FROM students WHERE parent_token = ?', token);
  if (!s) throw bad('not found', 404);
  const school = get('SELECT name, liff_id, line_oa_basic_id, line_oa_url FROM schools WHERE id = ?', s.school_id);
  let oaBasicId = (school && school.line_oa_basic_id) || '';
  if (!oaBasicId && school && school.line_oa_url) {
    const m = String(school.line_oa_url).match(/@[\w.\-]+/);
    if (m) oaBasicId = m[0];
  }
  res.json({
    liff_id: (school && school.liff_id) || null,
    school: school ? school.name : 'โรงเรียน',
    student: { name: s.name, nickname: s.nickname || null },
    already_linked: !!s.line_user_id,
    oa_basic_id: oaBasicId || null,
  });
}));

/**
 * POST /api/public/link — connect a parent's LINE account to a student (NO AUTH).
 * Body: { token, access_token }. We NEVER trust a userId sent by the client; instead
 * we call LINE's /v2/profile with the LIFF access_token, which returns the genuine
 * userId scoped to the school's channel. The parent_token gates which child is linked.
 */
r.post('/link', async (req, res) => {
  try {
    const token = String((req.body && req.body.token) || '');
    const accessToken = String((req.body && req.body.access_token) || '');
    if (token.length < 8) return res.status(404).json({ error: 'not found' });
    if (!accessToken) return res.status(400).json({ error: 'missing access_token' });

    const s = get('SELECT id, school_id, name, nickname FROM students WHERE parent_token = ?', token);
    if (!s) return res.status(404).json({ error: 'not found' });

    // verify the token with LINE → returns the authenticated userId (cannot be forged)
    const pr = await fetch('https://api.line.me/v2/profile', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!pr.ok) return res.status(401).json({ error: 'line_verify_failed' });
    const profile = await pr.json();
    const userId = profile && profile.userId;
    if (!userId || !/^U[0-9a-f]{32}$/i.test(userId)) {
      return res.status(401).json({ error: 'invalid_line_user' });
    }
    const displayName = (profile && profile.displayName) ? String(profile.displayName).slice(0, 100) : null;

    run('UPDATE students SET line_user_id = ?, line_display_name = ? WHERE id = ? AND school_id = ?', userId, displayName, s.id, s.school_id);
    const school = get('SELECT name FROM schools WHERE id = ?', s.school_id);
    res.json({ ok: true, student: { name: s.name, nickname: s.nickname || null }, school: school ? school.name : 'โรงเรียน' });
  } catch (e) {
    res.status(500).json({ error: 'link_failed' });
  }
});

/**
 * POST /api/public/invoice-slip — parent submits a payment slip (NO AUTH).
 * Authenticated only by parent_token (scoped to that student's invoices).
 * Sets invoice status → 'pending_verification' so the admin sees a notification.
 */
r.post('/invoice-slip', wrap(async (req, res) => {
  const token = String((req.body && req.body.token) || '');
  const invoiceId = parseInt(req.body && req.body.invoice_id) || 0;
  const image = (req.body && req.body.image) ? String(req.body.image) : null;

  if (token.length < 8) throw bad('not found', 404);
  if (!invoiceId) throw bad('invoice_id required');
  if (!image) throw bad('image required');
  if (image.length > 3_000_000) throw bad('รูปใหญ่เกินไป (ลองถ่ายใหม่หรือย่อขนาด)');

  const s = get('SELECT id, school_id FROM students WHERE parent_token = ?', token);
  if (!s) throw bad('not found', 404);

  const inv = get(
    'SELECT id, status FROM invoices WHERE id = ? AND student_id = ? AND school_id = ?',
    invoiceId, s.id, s.school_id);
  if (!inv) throw bad('invoice not found', 404);
  if (inv.status !== 'unpaid') throw bad('ใบแจ้งหนี้นี้ไม่อยู่ในสถานะที่สามารถแนบสลิปได้');

  run("UPDATE invoices SET slip_image = ?, status = 'pending_verification' WHERE id = ? AND school_id = ?",
    image, inv.id, s.school_id);
  res.json({ ok: true });
}));

/**
 * GET /api/public/school/:slug — public school info for the "ต่อคอร์ส" landing page.
 * Exposes only what a parent needs to decide on renewing: name, packages, contact.
 */
r.get('/school/:slug', wrap((req, res) => {
  const slug = String(req.params.slug || '').trim().toLowerCase();
  if (!slug) throw bad('not found', 404);
  const school = get(
    'SELECT id, name, slug, category, categories_json, logo_image, contact_phone, line_oa_url FROM schools WHERE LOWER(slug) = ?', slug);
  if (!school) throw bad('not found', 404);
  const packages = all(
    `SELECT name, sessions, duration_min, price FROM packages
      WHERE school_id = ? ORDER BY sort, price`, school.id);

  const CAT_LABELS = {
    piano:'เปียโน', guitar:'กีตาร์', singing:'ร้องเพลง', sing:'ร้องเพลง',
    dance:'เต้น', art:'ศิลปะ', drums:'กลอง', violin:'ไวโอลิน',
    english:'ภาษาอังกฤษ', math:'คณิตศาสตร์', science:'วิทยาศาสตร์', other:'อื่นๆ',
  };
  let categories = [];
  try {
    if (school.categories_json) {
      const raw = JSON.parse(school.categories_json);
      if (Array.isArray(raw)) categories = raw.map((c) => ({ key: c.key, label: c.label })).filter((c) => c.key && c.label);
    }
  } catch {}
  if (!categories.length && school.category) {
    categories = [{ key: school.category, label: CAT_LABELS[school.category] || school.category }];
  }

  res.json({
    name: school.name,
    slug: school.slug || slug,
    logo_image: school.logo_image || null,
    category: school.category || null,
    categories,
    contact_phone: school.contact_phone || null,
    line_oa_url: school.line_oa_url || null,
    packages: packages.map((p) => ({
      name: p.name, sessions: p.sessions, duration_min: p.duration_min, price: p.price,
    })),
  });
}));

/**
 * POST /api/public/enroll — submit a public enrollment request (NO AUTH).
 * Validates slug, saves to enrollment_requests as 'pending'.
 */
r.post('/enroll', wrap((req, res) => {
  const { slug, student_name, parent_name, phone, line_id, category, note } = req.body || {};
  if (!slug) throw bad('missing slug');
  const school = get('SELECT id, name, category, categories_json FROM schools WHERE LOWER(slug) = ?', String(slug).toLowerCase().trim());
  if (!school) throw bad('ไม่พบโรงเรียน', 404);
  const sName = String(student_name || '').trim().slice(0, 100);
  if (!sName) throw bad('กรุณากรอกชื่อนักเรียน');
  const ph = String(phone || '').trim().slice(0, 30);
  if (!ph) throw bad('กรุณากรอกเบอร์โทรศัพท์');
  const catKey = String(category || '').trim().slice(0, 60) || null;
  const noteVal = String(note || '').trim().slice(0, 500) || null;
  const parentVal = String(parent_name || '').trim().slice(0, 100) || null;
  const lineVal = String(line_id || '').trim().slice(0, 60) || null;
  const result = run(
    `INSERT INTO enrollment_requests (school_id, student_name, parent_name, phone, line_id, category, note)
     VALUES (?,?,?,?,?,?,?)`,
    school.id, sName, parentVal, ph, lineVal, catKey, noteVal,
  );
  res.json({ ok: true, id: Number(result.lastInsertRowid) });

  // Fire-and-forget: email the school's owner/admins so they follow up fast.
  // Must never block or fail the applicant's submission.
  notifyNewEnrollment(school, {
    studentName: sName, parentName: parentVal, phone: ph,
    lineId: lineVal, category: catKey, note: noteVal,
  }).catch(() => {});
}));

// Resolve a category key to its human label (school's own list first, then defaults)
// and email every owner/admin of the school about a new enrollment request.
async function notifyNewEnrollment(school, data) {
  const CAT_LABELS = {
    piano: 'เปียโน', guitar: 'กีตาร์', singing: 'ร้องเพลง', sing: 'ร้องเพลง',
    dance: 'เต้น', art: 'ศิลปะ', drums: 'กลอง', violin: 'ไวโอลิน',
    english: 'ภาษาอังกฤษ', math: 'คณิตศาสตร์', science: 'วิทยาศาสตร์', other: 'อื่นๆ',
  };
  let catLabel = data.category || '';
  try {
    if (school.categories_json) {
      const raw = JSON.parse(school.categories_json);
      const hit = Array.isArray(raw) && raw.find((c) => c.key === data.category);
      if (hit && hit.label) catLabel = hit.label;
    }
  } catch { /* ignore */ }
  if (catLabel && CAT_LABELS[catLabel]) catLabel = CAT_LABELS[catLabel];
  else if (data.category && CAT_LABELS[data.category]) catLabel = CAT_LABELS[data.category];

  const admins = all(
    "SELECT DISTINCT email FROM users WHERE school_id = ? AND role IN ('owner','admin') AND email IS NOT NULL AND email != ''",
    school.id);
  if (!admins.length) return;

  const tpl = tplNewEnrollment({
    schoolName: school.name || 'โรงเรียน',
    studentName: data.studentName, parentName: data.parentName,
    phone: data.phone, lineId: data.lineId, category: catLabel, note: data.note,
  });
  for (const a of admins) {
    try { await sendEmail({ to: a.email, subject: tpl.subject, html: tpl.html }); } catch { /* swallow */ }
  }
}

// ============================================================================
//  Self-service booking (NO AUTH). Two entry points:
//    ?token=<parent_token>  → an existing student books (sees existing|both)
//    ?slug=<school slug>    → a new prospect books (sees public|both, e.g. trials)
// ============================================================================

const todayStr = () => new Date().toISOString().slice(0, 10);
const seatsTaken = (sessionId) =>
  get(`SELECT COUNT(*) AS n FROM bookings WHERE session_id = ? AND status IN ('booked','attended')`, sessionId).n;

// Resolve who is asking from token/slug → { school, student? } or throw 404.
function resolveBooker(token, slug) {
  if (token && token.length >= 8) {
    const student = get('SELECT * FROM students WHERE parent_token = ?', token);
    if (!student) throw bad('not found', 404);
    const school = get('SELECT id, name, slug, logo_image, contact_phone FROM schools WHERE id = ?', student.school_id);
    return { school, student };
  }
  if (slug) {
    const school = get('SELECT id, name, slug, logo_image, contact_phone FROM schools WHERE LOWER(slug) = ?', String(slug).toLowerCase().trim());
    if (!school) throw bad('not found', 404);
    return { school, student: null };
  }
  throw bad('missing token or slug', 400);
}

function publicSession(s) {
  const booked = seatsTaken(s.id);
  return {
    id: s.id,
    kind: s.kind,
    kind_label: KIND_LABEL[s.kind] || s.kind,
    title: s.title || null,
    category: s.category || null,
    teacher: s.teacher_name || null,
    date: s.date,
    day: DOW[(new Date(s.date + 'T00:00:00Z').getUTCDay() + 6) % 7] || '',
    start: hhmm(s.start_min),
    end: hhmm(s.end_min),
    room: s.room || null,
    fee: s.fee != null ? s.fee : null,
    seats_left: Math.max(0, s.capacity - booked),
    full: booked >= s.capacity,
  };
}

// default subject labels (mirrors the other public endpoints) — used to label the
// recurring schedule + makeup-request subject picker on the parent booking page.
const CAT_LABELS = {
  piano: 'เปียโน', guitar: 'กีตาร์', singing: 'ร้องเพลง', sing: 'ร้องเพลง',
  dance: 'เต้น', art: 'ศิลปะ', drums: 'กลอง', violin: 'ไวโอลิน',
  english: 'ภาษาอังกฤษ', math: 'คณิตศาสตร์', science: 'วิทยาศาสตร์', other: 'อื่นๆ',
};
// resolve a category key → human label using the school's own list first, then defaults
function catLabeller(school) {
  const map = {};
  try {
    if (school && school.categories_json) {
      const raw = JSON.parse(school.categories_json);
      if (Array.isArray(raw)) raw.forEach((c) => { if (c.key) map[c.key] = c.label || c.key; });
    }
  } catch { /* ignore malformed json */ }
  return (key) => (key ? (map[key] || CAT_LABELS[key] || key) : null);
}

// GET /api/public/book?token=  OR  ?slug=  → school info + open future sessions you can book.
// For an existing student (token) the payload also carries their recurring weekly classes
// and their make-up requests, so the parent page can show the regular schedule + let them
// propose a make-up day.
r.get('/book', wrap((req, res) => {
  const { school, student } = resolveBooker(req.query.token, req.query.slug);
  const visible = student ? ['existing', 'both'] : ['public', 'both'];
  const rows = all(
    `SELECT bs.*, t.name AS teacher_name FROM bookable_sessions bs
       LEFT JOIN teachers t ON t.id = bs.teacher_id
      WHERE bs.school_id = ? AND bs.status = 'open' AND bs.date >= ?
      ORDER BY bs.date, bs.start_min`,
    school.id, todayStr());
  const sessions = rows.filter((s) => visible.includes(s.open_to)).map(publicSession);

  const out = {
    school: school.name,
    school_logo: school.logo_image || null,
    school_contact_phone: school.contact_phone || null,
    student: student ? { name: student.name, nickname: student.nickname || null } : null,
    sessions,
  };

  if (student) {
    const sch = get('SELECT categories_json FROM schools WHERE id = ?', school.id) || {};
    const label = catLabeller(sch);
    // recurring weekly classes the student is enrolled in
    const slots = all(
      `SELECT sl.day_of_week, sl.start_min, sl.end_min, sl.category, sl.title, t.name AS teacher_name
         FROM slot_students ss
         JOIN schedule_slots sl ON sl.id = ss.slot_id
         LEFT JOIN teachers t ON t.id = sl.teacher_id
        WHERE ss.student_id = ? ORDER BY sl.day_of_week, sl.start_min`, student.id);
    out.schedule = slots.map((sl) => ({
      day: DOW[sl.day_of_week] || '',
      day_of_week: sl.day_of_week,
      start: hhmm(sl.start_min),
      end: hhmm(sl.end_min),
      category: sl.category || null,
      category_label: label(sl.category),
      title: sl.title || null,
      teacher: sl.teacher_name || null,
    }));
    // distinct subjects (for the makeup-request subject picker)
    const seen = new Set();
    out.subjects = [];
    for (const sl of slots) {
      const key = sl.category || '';
      if (seen.has(key)) continue;
      seen.add(key);
      out.subjects.push({ key: sl.category || null, label: label(sl.category) || 'ทั่วไป' });
    }
    // the student's own makeup requests (status badges on the page)
    out.makeup_requests = all(
      `SELECT id, category, date, start_min, end_min, status, review_note, created_at
         FROM makeup_requests WHERE student_id = ? AND school_id = ?
        ORDER BY created_at DESC LIMIT 20`, student.id, school.id)
      .map((m) => ({
        id: m.id,
        category: m.category || null,
        category_label: label(m.category),
        date: m.date,
        day: DOW[(new Date(m.date + 'T00:00:00Z').getUTCDay() + 6) % 7] || '',
        start: hhmm(m.start_min),
        end: hhmm(m.end_min),
        status: m.status,
        review_note: m.review_note || null,
      }));
  }

  res.json(out);
}));

// POST /api/public/book/makeup-request — an existing student's parent proposes a make-up
// day/time/subject (NO AUTH; scoped by parent_token). Stored as 'pending' for admin review.
// Body: { token, date, start_min, end_min, category?, reason? }
r.post('/book/makeup-request', wrap((req, res) => {
  const b = req.body || {};
  const token = String(b.token || '');
  if (token.length < 8) throw bad('not found', 404);
  const student = get('SELECT * FROM students WHERE parent_token = ?', token);
  if (!student) throw bad('not found', 404);

  const date = String(b.date || '');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw bad('กรุณาเลือกวันที่');
  if (date < todayStr()) throw bad('กรุณาเลือกวันที่ในอนาคต');
  const start = parseInt(b.start_min);
  const end = parseInt(b.end_min);
  if (Number.isNaN(start) || Number.isNaN(end)) throw bad('กรุณาเลือกเวลา');
  if (start < 0 || start > 1439 || end < 1 || end > 1440 || end <= start) throw bad('ช่วงเวลาไม่ถูกต้อง');
  const category = b.category ? String(b.category).slice(0, 60) : null;
  const reason = b.reason ? String(b.reason).trim().slice(0, 300) : null;

  // throttle obvious spam: at most a few open (pending) requests at a time
  const pendingCount = get(
    `SELECT COUNT(*) AS n FROM makeup_requests WHERE student_id = ? AND status = 'pending'`, student.id).n;
  if (pendingCount >= 5) throw bad('มีคำขอที่รออนุมัติอยู่หลายรายการแล้ว กรุณารอการตอบกลับก่อนค่ะ');

  const result = run(
    `INSERT INTO makeup_requests (school_id, student_id, category, date, start_min, end_min, reason)
     VALUES (?,?,?,?,?,?,?)`,
    student.school_id, student.id, category, date, start, end, reason);

  res.status(201).json({ ok: true, id: Number(result.lastInsertRowid) });
}));

// POST /api/public/book/makeup-request/cancel — a parent withdraws their own PENDING request.
// Body: { token, request_id }
r.post('/book/makeup-request/cancel', wrap((req, res) => {
  const b = req.body || {};
  const token = String(b.token || '');
  const id = parseInt(b.request_id) || 0;
  if (token.length < 8) throw bad('not found', 404);
  if (!id) throw bad('request_id required');
  const student = get('SELECT id FROM students WHERE parent_token = ?', token);
  if (!student) throw bad('not found', 404);
  const mr = get('SELECT * FROM makeup_requests WHERE id = ? AND student_id = ?', id, student.id);
  if (!mr) throw bad('not found', 404);
  if (mr.status !== 'pending') throw bad('คำขอนี้ถูกพิจารณาไปแล้ว ไม่สามารถยกเลิกได้');
  run("UPDATE makeup_requests SET status = 'cancelled' WHERE id = ?", mr.id);
  res.json({ ok: true });
}));

// POST /api/public/book — book a seat.
// Body: { session_id, token?, slug?, name?, phone?, line?, note? }
r.post('/book', wrap((req, res) => {
  const b = req.body || {};
  const sessionId = parseInt(b.session_id) || 0;
  if (!sessionId) throw bad('session_id required');
  const { school, student } = resolveBooker(b.token, b.slug);

  const s = get('SELECT * FROM bookable_sessions WHERE id = ? AND school_id = ?', sessionId, school.id);
  if (!s) throw bad('ไม่พบคลาสนี้', 404);
  if (s.status !== 'open') throw bad('คลาสนี้ปิดรับจองแล้ว');
  if (s.date < todayStr()) throw bad('คลาสนี้ผ่านไปแล้ว');

  const allowed = student ? ['existing', 'both'] : ['public', 'both'];
  if (!allowed.includes(s.open_to)) throw bad('คุณไม่มีสิทธิ์จองคลาสนี้', 403);

  // prospect bookings need contact details
  let name = null, phone = null, line = null;
  if (!student) {
    name = String(b.name || '').trim().slice(0, 100);
    phone = String(b.phone || '').trim().slice(0, 30);
    line = String(b.line || '').trim().slice(0, 60) || null;
    if (!name) throw bad('กรุณากรอกชื่อ');
    if (!phone) throw bad('กรุณากรอกเบอร์โทร');
  } else {
    // no double-booking the same session
    const dup = get(
      `SELECT id FROM bookings WHERE session_id = ? AND student_id = ? AND status IN ('booked','attended')`,
      s.id, student.id);
    if (dup) throw bad('คุณจองคลาสนี้ไว้แล้ว');
  }

  // capacity — synchronous count+insert, so no race in better-sqlite3
  if (seatsTaken(s.id) >= s.capacity) throw bad('คลาสนี้เต็มแล้ว', 409);

  // a makeup booking by an existing student also lands on the live schedule (+ notifies teacher)
  let exceptionId = null;
  if (s.kind === 'makeup' && student) {
    const exRes = run(
      `INSERT INTO schedule_exceptions (school_id, slot_id, date, type, student_id, teacher_id, category, start_min, end_min, note)
       VALUES (?,?,?,?,?,?,?,?,?,?)`,
      school.id, null, s.date, 'makeup', student.id, s.teacher_id || null, s.category || null,
      s.start_min, s.end_min, 'จองชดเชยผ่านลิงก์');
    exceptionId = Number(exRes.lastInsertRowid);
  }

  const result = run(
    `INSERT INTO bookings (school_id, session_id, student_id, booker_name, booker_phone, booker_line, note, exception_id)
     VALUES (?,?,?,?,?,?,?,?)`,
    school.id, s.id, student ? student.id : null, name, phone, line,
    String(b.note || '').trim().slice(0, 300) || null, exceptionId);

  // notify the assigned teacher about the new booking (any kind, not just makeup)
  if (s.teacher_id) {
    const who = student ? (student.nickname || student.name) : (name || 'นักเรียนใหม่');
    const verb = s.kind === 'makeup' ? 'จองเรียนชดเชย' : `จอง${KIND_LABEL[s.kind] || s.kind}`;
    maybeNotifyTeacher(school.id, s.teacher_id, 't_change',
      `🗓️ มีการ${verb}\nวันที่ ${s.date} เวลา ${hhmm(s.start_min)}–${hhmm(s.end_min)} น.\nนักเรียน: ${who}`);
  }

  // send the booker a LINE receipt — only possible for an existing student whose
  // parent already linked LINE (a prospect's typed-in "line" field isn't a real userId)
  if (student) {
    pushToParent(school.id, student.id,
      `✅ จองคลาสสำเร็จ\n${KIND_LABEL[s.kind] || s.kind}${s.title ? ' · ' + s.title : ''}\n📅 ${s.date} เวลา ${hhmm(s.start_min)}–${hhmm(s.end_min)} น.${s.fee != null ? `\n💰 ${Number(s.fee).toLocaleString()} บาท` : ''}`,
    ).catch(() => {});
  }

  // a trial booking by a prospect also drops into the admin's enrollment-requests inbox
  if (s.kind === 'trial' && !student) {
    try {
      run(
        `INSERT INTO enrollment_requests (school_id, student_name, parent_name, phone, line_id, category, note)
         VALUES (?,?,?,?,?,?,?)`,
        school.id, name, null, phone, line, s.category || null,
        `ทดลองเรียน ${s.date} ${hhmm(s.start_min)}–${hhmm(s.end_min)} น.`);
    } catch { /* non-fatal */ }
  }

  res.status(201).json({
    ok: true,
    booking_id: Number(result.lastInsertRowid),
    session: publicSession({ ...s, teacher_name: null }),
  });
}));

// GET /api/public/book/mine?token=  OR  ?slug=&phone=  → list of MY OWN bookings.
// Existing students are scoped by their token; prospects (no account) are scoped by
// the phone number they booked with, same trust level already used by /book/cancel.
r.get('/book/mine', wrap((req, res) => {
  const token = String(req.query.token || '');
  const slug = String(req.query.slug || '');
  const phone = String(req.query.phone || '').trim();

  let schoolId, where, param;
  if (token.length >= 8) {
    const student = get('SELECT id, school_id FROM students WHERE parent_token = ?', token);
    if (!student) throw bad('not found', 404);
    schoolId = student.school_id; where = 'b.student_id = ?'; param = student.id;
  } else if (slug && phone) {
    const school = get('SELECT id FROM schools WHERE LOWER(slug) = ?', slug.toLowerCase().trim());
    if (!school) throw bad('not found', 404);
    schoolId = school.id; where = "b.student_id IS NULL AND b.booker_phone = ?"; param = phone;
  } else {
    throw bad('missing token or slug+phone', 400);
  }

  const rows = all(
    `SELECT b.id, b.status, b.created_at, bs.kind, bs.title, bs.category, bs.date,
            bs.start_min, bs.end_min, bs.fee, t.name AS teacher_name
       FROM bookings b JOIN bookable_sessions bs ON bs.id = b.session_id
       LEFT JOIN teachers t ON t.id = bs.teacher_id
      WHERE b.school_id = ? AND ${where}
      ORDER BY bs.date DESC, bs.start_min DESC LIMIT 20`, schoolId, param);

  res.json({ bookings: rows.map((b) => ({
    id: b.id, status: b.status,
    kind: b.kind, kind_label: KIND_LABEL[b.kind] || b.kind,
    title: b.title || null, category: b.category || null, teacher: b.teacher_name || null,
    date: b.date, day: DOW[(new Date(b.date + 'T00:00:00Z').getUTCDay() + 6) % 7] || '',
    start: hhmm(b.start_min), end: hhmm(b.end_min), fee: b.fee != null ? b.fee : null,
  })) });
}));

// POST /api/public/book/cancel — cancel a booking (token-scoped, or by booking id + phone)
r.post('/book/cancel', wrap((req, res) => {
  const b = req.body || {};
  const bookingId = parseInt(b.booking_id) || 0;
  if (!bookingId) throw bad('booking_id required');
  const bk = get('SELECT * FROM bookings WHERE id = ?', bookingId);
  if (!bk) throw bad('not found', 404);

  // authorize: existing student via their token, or prospect via matching phone
  if (b.token && String(b.token).length >= 8) {
    const student = get('SELECT id FROM students WHERE parent_token = ?', b.token);
    if (!student || bk.student_id !== student.id) throw bad('not found', 404);
  } else if (b.phone) {
    if (!bk.booker_phone || bk.booker_phone !== String(b.phone).trim()) throw bad('not found', 404);
  } else {
    throw bad('missing token or phone', 400);
  }
  if (bk.status === 'cancelled') return res.json({ ok: true });

  run("UPDATE bookings SET status = 'cancelled' WHERE id = ?", bk.id);
  // a makeup booking also removes itself from the live schedule
  if (bk.exception_id) run('DELETE FROM schedule_exceptions WHERE id = ? AND school_id = ?', bk.exception_id, bk.school_id);
  res.json({ ok: true });
}));

export default r;
