import { Router } from 'express';
import { get, run } from '../db.js';
import { wrap, bad } from '../util.js';
import { requireRole } from '../auth.js';
import { planAllows } from '../plans.js';

const r = Router();

// All rich-menu management is owner/admin only (it changes what every follower sees).
r.use(requireRole('owner', 'admin'));

const LINE_API = 'https://api.line.me/v2/bot';
const LINE_DATA = 'https://api-data.line.me/v2/bot';
// LINE only accepts these exact image dimensions (width must be 800/1200/2500).
const VALID_SIZES = [
  { width: 2500, height: 1686 }, { width: 2500, height: 843 },
  { width: 1200, height: 810 },  { width: 1200, height: 405 },
  { width: 800,  height: 540 },  { width: 800,  height: 270 },
];

function requireLine(schoolId) {
  const school = get('SELECT line_token, rich_menu_id, plan, plan_expires FROM schools WHERE id = ?', schoolId);
  if (!school) throw bad('school not found', 404);
  if (!planAllows(school, 'line')) throw bad('Rich Menu ต้องใช้แผน ACADEMY ขึ้นไป — อัปเกรดเพื่อเปิดใช้งาน', 402);
  if (!school.line_token) throw bad('ยังไม่ได้เชื่อมต่อ LINE — ไปที่ ตั้งค่า → LINE แจ้งเตือน เพื่อใส่ Channel Access Token', 409);
  return school;
}

// Validate the areas array the client sends. LINE caps at 20 areas; every bound must
// sit inside the declared menu size; only a small whitelist of action types is allowed.
function validateAreas(areas, size) {
  if (!Array.isArray(areas) || !areas.length) throw bad('ต้องมีปุ่มอย่างน้อย 1 ปุ่ม');
  if (areas.length > 20) throw bad('Rich Menu มีได้สูงสุด 20 ปุ่ม');
  return areas.map((a, i) => {
    const b = a && a.bounds;
    if (!b || ![b.x, b.y, b.width, b.height].every((n) => Number.isFinite(n))) throw bad(`ปุ่มที่ ${i + 1}: พิกัดไม่ถูกต้อง`);
    const x = Math.round(b.x), y = Math.round(b.y), w = Math.round(b.width), h = Math.round(b.height);
    if (w <= 0 || h <= 0 || x < 0 || y < 0 || x + w > size.width || y + h > size.height) throw bad(`ปุ่มที่ ${i + 1}: พิกัดเกินขอบเมนู`);
    const act = a.action || {};
    let action;
    if (act.type === 'uri') {
      const uri = String(act.uri || '').trim();
      if (!/^(https?|tel|line):/i.test(uri)) throw bad(`ปุ่มที่ ${i + 1}: ลิงก์ต้องขึ้นต้นด้วย https:// (หรือ tel: / line:)`);
      action = { type: 'uri', uri, label: String(act.label || '').slice(0, 20) || undefined };
    } else if (act.type === 'postback') {
      const data = String(act.data || '').trim();
      if (!data) throw bad(`ปุ่มที่ ${i + 1}: postback ต้องมี data`);
      action = { type: 'postback', data: data.slice(0, 300), displayText: act.displayText ? String(act.displayText).slice(0, 300) : undefined };
    } else if (act.type === 'message') {
      const text = String(act.text || '').trim();
      if (!text) throw bad(`ปุ่มที่ ${i + 1}: ข้อความว่าง`);
      action = { type: 'message', text: text.slice(0, 300) };
    } else {
      throw bad(`ปุ่มที่ ${i + 1}: ชนิดการกระทำไม่รองรับ`);
    }
    return { bounds: { x, y, width: w, height: h }, action };
  });
}

// Turn a "data:image/png;base64,..." URL into { buffer, contentType }. LINE's image
// endpoint takes raw binary (image/png or image/jpeg, ≤ 1 MB).
function decodeDataUrl(dataUrl) {
  const m = /^data:(image\/(png|jpeg));base64,([\s\S]+)$/.exec(String(dataUrl || ''));
  if (!m) throw bad('รูปเมนูไม่ถูกต้อง (ต้องเป็น PNG หรือ JPEG)');
  const buffer = Buffer.from(m[3], 'base64');
  if (buffer.length > 1024 * 1024) throw bad('รูปเมนูใหญ่เกินไป (สูงสุด 1 MB) — ลองลดความซับซ้อนหรือใช้ JPEG');
  return { buffer, contentType: m[1] };
}

// Best-effort delete of a menu on LINE (used when replacing). Never throws.
async function deleteLineMenu(token, id) {
  if (!id) return;
  try { await fetch(`${LINE_API}/richmenu/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } }); } catch { /* ignore */ }
}

/**
 * GET /api/rich-menu — current saved builder state + published status.
 * Returns the stored config/image and, when a token is set, whether the saved menu
 * is still the active default on LINE (so the UI can warn if it was removed there).
 */
r.get('/', wrap(async (req, res) => {
  const s = get('SELECT line_token, rich_menu_id, rich_menu_config, rich_menu_image FROM schools WHERE id = ?', req.schoolId);
  if (!s) throw bad('school not found', 404);
  let config = null;
  try { config = s.rich_menu_config ? JSON.parse(s.rich_menu_config) : null; } catch { config = null; }

  let liveDefault = null; // the richMenuId LINE currently shows to all users
  if (s.line_token) {
    try {
      const lr = await fetch(`${LINE_API}/user/all/richmenu`, { headers: { Authorization: `Bearer ${s.line_token}` } });
      if (lr.ok) { const j = await lr.json().catch(() => ({})); liveDefault = j.richMenuId || null; }
    } catch { /* offline / token issue — treat as unknown */ }
  }

  res.json({
    line_configured: !!s.line_token,
    rich_menu_id: s.rich_menu_id || null,
    config,
    image: s.rich_menu_image || null,
    published: !!s.rich_menu_id,
    active_on_line: s.rich_menu_id ? (liveDefault === s.rich_menu_id) : null,
  });
}));

/**
 * POST /api/rich-menu/publish — create the menu on LINE, upload its image, set it as
 * the default for every follower, then persist id/config/image. Replaces any previous
 * menu. Body: { size, chatBarText, name, areas:[{bounds,action}], image, config }.
 */
r.post('/publish', wrap(async (req, res) => {
  const school = requireLine(req.schoolId);
  const token = school.line_token;
  const { size, chatBarText, name, areas, image, config } = req.body || {};

  const sz = VALID_SIZES.find((v) => size && v.width === Number(size.width) && v.height === Number(size.height));
  if (!sz) throw bad('ขนาดเมนูไม่ถูกต้อง (รองรับ 2500×1686, 2500×843)');
  const cleanAreas = validateAreas(areas, sz);
  const { buffer, contentType } = decodeDataUrl(image);

  // 1) create the rich menu object (returns its id)
  const createRes = await fetch(`${LINE_API}/richmenu`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      size: sz,
      selected: true,
      name: String(name || 'skooldee menu').slice(0, 300),
      chatBarText: String(chatBarText || 'เมนู').slice(0, 14) || 'เมนู',
      areas: cleanAreas,
    }),
  });
  if (!createRes.ok) {
    const detail = await createRes.text().catch(() => '');
    throw bad(`LINE สร้างเมนูไม่สำเร็จ (${createRes.status}): ${detail.slice(0, 200)}`, 502);
  }
  const { richMenuId } = await createRes.json();
  if (!richMenuId) throw bad('LINE ไม่ได้คืนค่า richMenuId', 502);

  // 2) upload the image to the data endpoint
  const imgRes = await fetch(`${LINE_DATA}/richmenu/${richMenuId}/content`, {
    method: 'POST',
    headers: { 'Content-Type': contentType, Authorization: `Bearer ${token}` },
    body: buffer,
  });
  if (!imgRes.ok) {
    const detail = await imgRes.text().catch(() => '');
    await deleteLineMenu(token, richMenuId); // roll back the half-created menu
    throw bad(`LINE อัปโหลดรูปไม่สำเร็จ (${imgRes.status}): ${detail.slice(0, 200)}`, 502);
  }

  // 3) make it the default menu for all followers
  const defRes = await fetch(`${LINE_API}/user/all/richmenu/${richMenuId}`, {
    method: 'POST', headers: { Authorization: `Bearer ${token}` },
  });
  if (!defRes.ok) {
    const detail = await defRes.text().catch(() => '');
    await deleteLineMenu(token, richMenuId);
    throw bad(`LINE ตั้งเมนูเริ่มต้นไม่สำเร็จ (${defRes.status}): ${detail.slice(0, 200)}`, 502);
  }

  // 4) success → remove the old menu on LINE and persist the new state
  await deleteLineMenu(token, school.rich_menu_id);
  run('UPDATE schools SET rich_menu_id = ?, rich_menu_config = ?, rich_menu_image = ? WHERE id = ?',
    richMenuId,
    config && typeof config === 'object' ? JSON.stringify(config) : null,
    String(image),
    req.schoolId);

  res.json({ ok: true, rich_menu_id: richMenuId });
}));

/**
 * DELETE /api/rich-menu — unset the default and delete the menu on LINE, then clear
 * the stored state. Tolerant of LINE being unreachable (still clears locally).
 */
r.delete('/', wrap(async (req, res) => {
  const s = get('SELECT line_token, rich_menu_id FROM schools WHERE id = ?', req.schoolId);
  if (!s) throw bad('school not found', 404);
  if (s.line_token) {
    try { await fetch(`${LINE_API}/user/all/richmenu`, { method: 'DELETE', headers: { Authorization: `Bearer ${s.line_token}` } }); } catch { /* ignore */ }
    await deleteLineMenu(s.line_token, s.rich_menu_id);
  }
  run('UPDATE schools SET rich_menu_id = NULL, rich_menu_config = NULL, rich_menu_image = NULL WHERE id = ?', req.schoolId);
  res.json({ ok: true });
}));

export default r;
