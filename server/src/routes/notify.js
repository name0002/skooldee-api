import { Router } from 'express';
import { wrap, required } from '../util.js';
import { get, run } from '../db.js';
import { planAllows } from '../plans.js';

const r = Router();

/**
 * POST /api/notify/line — send a LINE message to a parent.
 *
 * This is a STUB. To make it real:
 *   1. Create a LINE Official Account + Messaging API channel (developers.line.biz)
 *   2. Put the channel access token in env LINE_CHANNEL_ACCESS_TOKEN
 *   3. Store each parent's LINE userId (from LIFF login / webhook follow event)
 *   4. Replace the body below with a POST to https://api.line.me/v2/bot/message/push
 *
 * Example (uncomment once configured):
 *   await fetch('https://api.line.me/v2/bot/message/push', {
 *     method: 'POST',
 *     headers: { 'Content-Type': 'application/json',
 *                Authorization: `Bearer ${process.env.LINE_CHANNEL_ACCESS_TOKEN}` },
 *     body: JSON.stringify({ to: lineUserId, messages: [{ type: 'text', text: message }] }),
 *   });
 */
r.post('/line', wrap(async (req, res) => {
  const { message, student_id } = required(req.body, ['message']);
  // prefer the school's own token (set in Settings), fall back to a global env token
  const school = get('SELECT line_token, plan, plan_expires FROM schools WHERE id = ?', req.schoolId);
  const token = (school && school.line_token) || process.env.LINE_CHANNEL_ACCESS_TOKEN || null;

  // LINE messaging is a paid-plan feature (STUDIO/expired trial cannot send)
  if (!planAllows(school, 'line')) {
    return res.json({
      sent: false, plan_blocked: true,
      note: 'การแจ้งเตือนผ่าน LINE ต้องใช้แผน ACADEMY ขึ้นไป — อัปเกรดเพื่อเปิดใช้งาน',
      preview: message,
    });
  }

  // resolve recipient ONLY from a student in the caller's own school — never accept a
  // raw `to` userId from the body (that would let staff push to any LINE account).
  let to = null;
  if (student_id) {
    const s = get('SELECT line_user_id FROM students WHERE id = ? AND school_id = ?', student_id, req.schoolId);
    to = s && s.line_user_id;
  }

  if (!token) {
    return res.json({
      sent: false, simulated: true,
      note: 'ยังไม่ได้เชื่อมต่อ LINE — ไปที่ ตั้งค่า → LINE แจ้งเตือน เพื่อใส่ Channel Access Token',
      preview: message,
    });
  }
  // token present but this parent hasn't linked their LINE yet (no userId on file).
  if (!to) {
    return res.json({
      sent: false, simulated: true, connected: true,
      note: 'เชื่อมต่อ LINE แล้ว ✓ แต่ผู้ปกครองของนักเรียนคนนี้ยังไม่ได้เชื่อม LINE (ให้แอด Official Account แล้วส่งรหัสเชื่อมต่อ)',
      preview: message,
    });
  }
  // real push
  try {
    const r2 = await fetch('https://api.line.me/v2/bot/message/push', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ to, messages: [{ type: 'text', text: message }] }),
    });
    if (!r2.ok) {
      const body = await r2.text();
      return res.json({ sent: false, error: 'line_api_error', status: r2.status, detail: body.slice(0, 200) });
    }
    res.json({ sent: true, preview: message });
  } catch (e) {
    res.json({ sent: false, error: 'network', detail: String(e).slice(0, 200) });
  }
}));

// POST /api/notify/line/test — verify the saved token works (calls LINE's quota endpoint)
r.post('/line/test', wrap(async (req, res) => {
  const school = get('SELECT line_token FROM schools WHERE id = ?', req.schoolId);
  const token = (school && school.line_token) || process.env.LINE_CHANNEL_ACCESS_TOKEN || null;
  if (!token) return res.json({ ok: false, note: 'ยังไม่ได้ใส่ Token' });
  try {
    const r2 = await fetch('https://api.line.me/v2/bot/info', {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!r2.ok) return res.json({ ok: false, status: r2.status, note: 'Token ไม่ถูกต้องหรือหมดอายุ' });
    const info = await r2.json();
    // persist the OA basic id so the app can build one-tap parent-link deep links
    if (info.basicId) { try { run('UPDATE schools SET line_oa_basic_id = ? WHERE id = ?', info.basicId, req.schoolId); } catch { /* non-critical */ } }
    res.json({ ok: true, bot: { displayName: info.displayName, basicId: info.basicId, pictureUrl: info.pictureUrl } });
  } catch (e) {
    res.json({ ok: false, note: 'เชื่อมต่อ LINE ไม่สำเร็จ', detail: String(e).slice(0, 200) });
  }
}));

export default r;
