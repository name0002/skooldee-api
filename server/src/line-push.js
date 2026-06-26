import { get } from './db.js';
import { planAllows } from './plans.js';

/**
 * Fire-and-forget LINE push to a student's linked parent.
 * Gated by the school's opt-in notify prefs — only sends when:
 *   - the school has a LINE token configured
 *   - the matching pref (eventKey) is turned ON
 *   - the student's parent has linked their LINE (line_user_id present)
 * Never throws — must not block the main request (attendance/invoice).
 */
/**
 * Direct LINE push to a student's linked parent — for EXPLICIT actions the staff
 * triggered (e.g. ticking "notify" when assigning homework). Unlike maybeNotify,
 * this is NOT gated by the school's opt-in prefs, but still requires a token and a
 * linked parent. Returns a small status object; never throws.
 */
export async function pushToParent(schoolId, studentId, text) {
  try {
    const school = get('SELECT line_token, plan, plan_expires FROM schools WHERE id = ?', schoolId);
    if (!school || !school.line_token) return { sent: false, reason: 'no_token' };
    if (!planAllows(school, 'line')) return { sent: false, reason: 'plan' };
    const stu = get('SELECT line_user_id FROM students WHERE id = ? AND school_id = ?', studentId, schoolId);
    if (!stu || !stu.line_user_id) return { sent: false, reason: 'not_linked' };
    const res = await fetch('https://api.line.me/v2/bot/message/push', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${school.line_token}` },
      body: JSON.stringify({ to: stu.line_user_id, messages: [{ type: 'text', text }] }),
    });
    return { sent: res.ok, reason: res.ok ? null : 'line_api_error' };
  } catch { return { sent: false, reason: 'error' }; }
}

export async function maybeNotify(schoolId, studentId, eventKey, text) {
  try {
    const school = get('SELECT line_token, notify_prefs, plan, plan_expires FROM schools WHERE id = ?', schoolId);
    if (!school || !school.line_token) return;
    if (!planAllows(school, 'line')) return; // LINE notifications require a paid plan
    let prefs = {};
    try { prefs = school.notify_prefs ? JSON.parse(school.notify_prefs) : {}; } catch { prefs = {}; }
    if (!prefs[eventKey]) return; // opt-in: silent unless explicitly enabled
    const stu = get('SELECT line_user_id FROM students WHERE id = ? AND school_id = ?', studentId, schoolId);
    if (!stu || !stu.line_user_id) return;
    await pushRaw(school.line_token, stu.line_user_id, text);
  } catch { /* swallow — notifications must never break the core action */ }
}

/**
 * Low-level push to a LINE userId. Returns true on success. Never throws.
 * Pass `quickReply` (a LINE quickReply object) to attach tappable buttons.
 */
export async function pushRaw(token, to, text, quickReply) {
  try {
    const message = { type: 'text', text };
    if (quickReply) message.quickReply = quickReply;
    const res = await fetch('https://api.line.me/v2/bot/message/push', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ to, messages: [message] }),
    });
    return res.ok;
  } catch { return false; }
}

/** Direct push to a teacher's linked LINE (explicit/event-driven, not pref-gated). */
export async function pushToTeacher(schoolId, teacherId, text) {
  try {
    const school = get('SELECT line_token, plan, plan_expires FROM schools WHERE id = ?', schoolId);
    if (!school || !school.line_token) return { sent: false, reason: 'no_token' };
    if (!planAllows(school, 'line')) return { sent: false, reason: 'plan' };
    const t = get('SELECT line_user_id FROM teachers WHERE id = ? AND school_id = ?', teacherId, schoolId);
    if (!t || !t.line_user_id) return { sent: false, reason: 'not_linked' };
    const ok = await pushRaw(school.line_token, t.line_user_id, text);
    return { sent: ok, reason: ok ? null : 'line_api_error' };
  } catch { return { sent: false, reason: 'error' }; }
}

/** Pref-gated teacher push — used for automatic events (class cancelled, student absent). */
export async function maybeNotifyTeacher(schoolId, teacherId, eventKey, text) {
  try {
    const school = get('SELECT line_token, notify_prefs, plan, plan_expires FROM schools WHERE id = ?', schoolId);
    if (!school || !school.line_token) return;
    if (!planAllows(school, 'line')) return;
    let prefs = {};
    try { prefs = school.notify_prefs ? JSON.parse(school.notify_prefs) : {}; } catch { prefs = {}; }
    if (!prefs[eventKey]) return;
    const t = get('SELECT line_user_id FROM teachers WHERE id = ? AND school_id = ?', teacherId, schoolId);
    if (!t || !t.line_user_id) return;
    await pushRaw(school.line_token, t.line_user_id, text);
  } catch { /* swallow */ }
}

/**
 * Platform-wide push to the skooldee owner (not a tenant school) — business events
 * like a new school signing up, a plan change, trial expiry, or a failed payment.
 * Not plan-gated (this is platform infra, not a tenant feature). Reuses whichever
 * school row has been linked as the owner's notification channel (owner_line_id +
 * that same school's own line_token). Never throws — must not block the caller.
 */
export async function notifyPlatformOwner(text) {
  try {
    const row = get(`SELECT line_token, owner_line_id FROM schools
                      WHERE owner_line_id IS NOT NULL AND owner_line_id != ''
                        AND line_token IS NOT NULL AND line_token != '' LIMIT 1`);
    if (!row) return;
    await pushRaw(row.line_token, row.owner_line_id, text);
  } catch { /* swallow — must never break the caller's main flow */ }
}
