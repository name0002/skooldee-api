// Small helpers shared by routes.

// Turn a thrown error into a clean 4xx/5xx JSON response.
function sendError(res, err) {
  if (res.headersSent) return; // a response already went out — nothing safe to do
  const status = err.status || 500;
  if (status >= 500) console.error(err);
  res.status(status).json({ error: err.message || 'server error' });
}

// Wrap an (req,res) handler so thrown errors become clean 400/500 responses.
// Handles BOTH sync handlers and async handlers: an async handler returns a
// promise, so we must also attach a .catch — otherwise a throw after the first
// await becomes an unhandled rejection (no response sent + can crash the process).
export const wrap = (fn) => (req, res) => {
  try {
    const out = fn(req, res);
    if (out && typeof out.then === 'function') out.catch((err) => sendError(res, err));
  } catch (err) {
    sendError(res, err);
  }
};

export function bad(message, status = 400) {
  const e = new Error(message);
  e.status = status;
  return e;
}

// Require given fields to be present (non-empty) on body; returns them.
export function required(body, fields) {
  for (const f of fields) {
    if (body[f] === undefined || body[f] === null || body[f] === '') {
      throw bad(`field '${f}' is required`);
    }
  }
  return body;
}

export const hhmm = (min) =>
  `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;

export const today = () => new Date().toISOString().slice(0, 10);

// Decide if a student is "near the end of a course".
// For students enrolled in MULTIPLE subjects (packages_json), we must look at each
// subject on its own — otherwise a finished subject is hidden behind the aggregate
// remaining (e.g. piano 0 + guitar 10 → total 10 → looks fine). Returns the WORST
// (lowest-remaining) subject at/under the threshold so the UI can name it.
// Falls back to the aggregate sessions_remaining for single-course students.
export function nearLimitInfo(student, threshold) {
  let pkgs = [];
  try { if (student.packages_json) { const a = JSON.parse(student.packages_json); if (Array.isArray(a)) pkgs = a; } } catch { /* malformed → ignore */ }
  const hits = pkgs
    .filter((p) => p && (p.sessions_total || 0) > 0 && (p.sessions_remaining || 0) <= threshold)
    .sort((a, b) => (a.sessions_remaining || 0) - (b.sessions_remaining || 0));
  if (hits.length) {
    const p = hits[0];
    return { near: true, perSubject: true, remaining: p.sessions_remaining || 0, category: p.category || null, name: p.name || null };
  }
  if (pkgs.length > 1) return { near: false }; // multi-course but every subject is fine
  // single-course / no package breakdown → aggregate
  const rem = student.sessions_remaining || 0;
  if (rem <= threshold) return { near: true, perSubject: false, remaining: rem, category: student.category || null, name: null };
  return { near: false };
}

// Relationship of the LINE recipient → how messages address them and refer to the student.
// Not every student's contact is a parent: some adults learn for themselves, some are
// siblings/relatives. `type`: 'parent' (default) | 'self' | 'sibling' | 'relative'.
//   greet      — salutation referencing the student (e.g. "คุณพ่อคุณแม่ของน้องเอย")
//   studentRef — how to mention the student in the body ("น้องเอย", or "คุณ" when self)
//   care       — closing ask appropriate to the recipient
//   isSelf     — the learner receives their own messages (address directly, no "น้อง")
// `age` tunes the honorific: an adult learner is "คุณ", a child is "น้อง" — never call a
// 46-year-old "น้อง". Unknown age falls back to "น้อง" for guardian-style contacts and
// "คุณ" for self-learners. `honorific` ('น้อง' | 'พี่' | 'คุณ') overrides the age guess
// when the school wants a specific tone (e.g. address an adult as "พี่", not "คุณ").
export function recipientWords(type, name, age, honorific) {
  const n = name || '';
  const a = Number(age);
  const known = Number.isFinite(a) && a > 0;
  const ageAdult = known ? a >= 18 : type === 'self';
  const h = ['น้อง', 'พี่', 'คุณ'].includes(honorific) ? honorific : (ageAdult ? 'คุณ' : 'น้อง');
  const adult = h !== 'น้อง';                          // anyone not "น้อง" gets grown-up tone
  const ref = `${h}${n}`;                              // third-person name for the learner
  const supervise = adult                              // closing ask, tuned to the learner's age
    ? `ฝากช่วยสนับสนุนการฝึกซ้อมของ${ref}ด้วยนะคะ 😊`
    : `รบกวนช่วยดูแล${ref}ฝึกด้วยนะคะ 😊`;
  switch (type) {
    case 'self':
      return { greet: ref, studentRef: ref, care: 'รบกวนฝึกซ้อมตามนี้ด้วยนะคะ 😊', isSelf: true };
    case 'sibling':
      return { greet: `พี่ของ${ref}`, studentRef: ref, care: supervise, isSelf: false };
    case 'relative':
      return { greet: `ครอบครัวของ${ref}`, studentRef: ref, care: supervise, isSelf: false };
    case 'parent':
    default:
      return { greet: `คุณพ่อคุณแม่ของ${ref}`, studentRef: ref,
        care: adult ? supervise : `รบกวนผู้ปกครองช่วยดูแล${ref}ฝึกด้วยนะคะ 😊`, isSelf: false };
  }
}
