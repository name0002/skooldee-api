import { Router } from 'express';
import crypto from 'crypto';
import { all, get, run } from '../db.js';
import { maybeNotifyTeacher } from '../line-push.js';

const r = Router();

/**
 * POST /api/line/webhook/:schoolId — LINE Messaging API webhook (PUBLIC, no JWT).
 * Each school configures this exact URL (with its own id) in the LINE Developers
 * Console, so we know which school an incoming event belongs to.
 *
 * Linking flow:
 *   1. Parent adds the school's Official Account as friend  → 'follow' event
 *      → we ask them to send their child's "รหัสเชื่อมต่อ" (= student.referral_code)
 *   2. Parent sends the code                                → 'message' event
 *      → match code to a student in that school, store source.userId in
 *        students.line_user_id, and confirm.
 */
r.post('/webhook/:schoolId', async (req, res) => {
  const sid = Number(req.params.schoolId);
  const school = get('SELECT line_token, line_secret, line_welcome_enabled, line_welcome_message, owner_link_code FROM schools WHERE id = ?', sid);
  if (!school) return res.sendStatus(404);

  // verify LINE signature if a channel secret is configured (recommended)
  if (school.line_secret && req.rawBody) {
    const expected = crypto.createHmac('sha256', school.line_secret).update(req.rawBody).digest('base64');
    const got = req.get('X-Line-Signature') || '';
    if (expected !== got) return res.sendStatus(403);
  }

  const events = (req.body && req.body.events) || [];
  for (const ev of events) {
    const userId = ev.source && ev.source.userId;
    if (!userId) continue;

    if (ev.type === 'follow') {
      await reply(school.line_token, ev.replyToken,
        'สวัสดีค่ะ 🎵 ขอบคุณที่เพิ่มเพื่อน!\n\nกรุณาพิมพ์ "รหัสเชื่อมต่อ" ของบุตรหลาน (ขอได้จากทางโรงเรียน) เพื่อเริ่มรับแจ้งเตือนการบ้านและข่าวสารค่ะ');
    } else if (ev.type === 'postback') {
      const params = new URLSearchParams(ev.postback && ev.postback.data || '');
      const action = params.get('action');
      // parent tapped Confirm / Leave on a class-reminder message
      if (action === 'confirm_class' || action === 'cancel_class') {
        const studentId = Number(params.get('sid'));
        const date = String(params.get('date') || '');
        // security: only the LINE account actually linked to this student may answer
        const stu = get('SELECT id, name, nickname FROM students WHERE id = ? AND school_id = ? AND line_user_id = ?',
          studentId, sid, userId);
        if (!stu || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
          await reply(school.line_token, ev.replyToken, 'ขออภัยค่ะ ไม่พบรายการเรียนนี้ในระบบ 🙏');
          continue;
        }
        const status = action === 'confirm_class' ? 'confirmed' : 'cancelled';
        run(`INSERT INTO class_confirmations (school_id, student_id, date, status, responded_at)
               VALUES (?,?,?,?,datetime('now'))
             ON CONFLICT(student_id, date) DO UPDATE SET status = excluded.status, responded_at = datetime('now')`,
          sid, stu.id, date, status);
        const nm = stu.nickname || stu.name;
        if (status === 'confirmed') {
          await reply(school.line_token, ev.replyToken, `รับทราบค่ะ ✓ ยืนยันการมาเรียนของน้อง${nm} แล้วนะคะ ไว้เจอกันค่ะ 😊`);
        } else {
          await reply(school.line_token, ev.replyToken, `รับทราบการลาของน้อง${nm} ค่ะ 🙏 ทางโรงเรียนจะแจ้งครูให้นะคะ`);
          // alert the student's teacher(s) for that weekday (gated by the t_absent pref)
          const dow = (new Date(date + 'T00:00:00Z').getUTCDay() + 6) % 7; // → Mon=0..Sun=6
          const teachers = all(
            `SELECT DISTINCT sl.teacher_id FROM slot_students ss JOIN schedule_slots sl ON sl.id = ss.slot_id
              WHERE ss.student_id = ? AND sl.school_id = ? AND sl.day_of_week = ? AND sl.teacher_id IS NOT NULL`,
            stu.id, sid, dow);
          for (const t of teachers) {
            await maybeNotifyTeacher(sid, t.teacher_id, 't_absent',
              `🙏 ผู้ปกครองแจ้งลาล่วงหน้า: น้อง${nm} จะไม่มาเรียนวันที่ ${date} ค่ะ`);
          }
        }
      } else if (action === 'parent_portal') {
        const students = all(
          'SELECT name, nickname, parent_token FROM students WHERE line_user_id = ? AND school_id = ? AND status != ? ORDER BY id',
          userId, sid, 'inactive'
        );
        if (students.length) {
          // one link opens the combined family page (shows every linked child with a switcher)
          const link = `https://skooldee.com/parent?token=${students[0].parent_token}`;
          const names = students.map((s) => `น้อง${s.nickname || s.name}`).join(', ');
          const who = students.length > 1
            ? `ดูข้อมูลบุตรหลานทุกคน (${names}) ได้ที่ลิงก์เดียวค่ะ`
            : `ดูข้อมูล${names}ได้ที่นี่ค่ะ`;
          await reply(school.line_token, ev.replyToken,
            `🔗 ${who}\n\n${link}\n\n(กดลิงค์เพื่อเปิดในเบราว์เซอร์)`);
        } else {
          await reply(school.line_token, ev.replyToken,
            'ยังไม่พบข้อมูลในระบบค่ะ 🙏\nรบกวนติดต่อทางโรงเรียนเพื่อขอรหัสเชื่อมต่อก่อนนะคะ');
        }
      }
    } else if (ev.type === 'message' && ev.message && ev.message.type === 'text') {
      const raw = String(ev.message.text || '').trim();
      const code = raw.toUpperCase();
      // CRITICAL: only treat a message as a "link code" attempt when it actually looks
      // like one. Parents chatting normally with the school (Thai sentences, messages
      // with spaces) must NOT get an auto-reply — otherwise the OA spams them with
      // "รหัสไม่พบ" over their real conversation. Real codes are either the student
      // referral code (prefix "MARI-") or a teacher code ("T" + 6 hex), or at minimum a
      // single latin-alphanumeric token with no spaces/Thai.
      const looksLikeCode =
        /^MARI-/i.test(raw) ||
        /^T[0-9A-F]{6}$/i.test(raw) ||
        /^[A-Za-z0-9-]{4,16}$/.test(raw);
      if (!looksLikeCode) continue; // free-text chat → stay silent, let the admin reply

      // platform-owner link code is prefixed "OWN-" → the school's own owner linking
      // their personal LINE to receive business notifications (new signups, plan
      // changes, trial expiry, payment failures) through this school's own LINE channel.
      const ownerLinking = code.startsWith('OWN-') && school.owner_link_code &&
        code === String(school.owner_link_code).toUpperCase();
      // teacher link codes are prefixed "T" → try teachers first for those
      const teacher = (!ownerLinking && code.startsWith('T'))
        ? get('SELECT id, name FROM teachers WHERE school_id = ? AND UPPER(link_code) = ?', sid, code)
        : null;
      const stu = (ownerLinking || teacher) ? null : get(
        'SELECT id, name, nickname FROM students WHERE school_id = ? AND UPPER(referral_code) = ?',
        sid, code);
      if (ownerLinking) {
        run('UPDATE schools SET owner_line_id = ?, owner_link_code = NULL WHERE id = ?', userId, sid);
        await reply(school.line_token, ev.replyToken,
          'เชื่อมต่อสำเร็จ ✓\n\nคุณจะได้รับแจ้งเตือนระบบผ่าน LINE นี้ เมื่อมีโรงเรียนสมัครใหม่ อัพเกรด/ดาวน์เกรดแพ็ค trial ใกล้หมดอายุ หรือการชำระเงินล้มเหลวค่ะ 🔔');
      } else if (teacher) {
        run('UPDATE teachers SET line_user_id = ? WHERE id = ?', userId, teacher.id);
        const defaultMsg = `เชื่อมต่อสำเร็จ ✓\n\nครู${teacher.name} จะได้รับแจ้งเตือนตารางสอนและข่าวสารผ่าน LINE นี้แล้วค่ะ 🎉`;
        const msg = school.line_welcome_enabled && school.line_welcome_message ? school.line_welcome_message : defaultMsg;
        await reply(school.line_token, ev.replyToken, msg);
      } else if (stu) {
        run('UPDATE students SET line_user_id = ? WHERE id = ?', userId, stu.id);
        const defaultMsg = `เชื่อมต่อสำเร็จ ✓\n\nคุณจะได้รับแจ้งเตือนของ ${stu.nickname || stu.name} ผ่าน LINE นี้แล้วค่ะ 🎉`;
        const msg = school.line_welcome_enabled && school.line_welcome_message ? school.line_welcome_message : defaultMsg;
        await reply(school.line_token, ev.replyToken, msg);
      } else {
        // it looked like a code but didn't match → soft, helpful reply (not robotic)
        await reply(school.line_token, ev.replyToken,
          'ดูเหมือนรหัสนี้ยังไม่ตรงกับในระบบค่ะ 🙏\nรบกวนตรวจสอบ "รหัสเชื่อมต่อ" จากทางโรงเรียนอีกครั้งนะคะ\n\n(หากต้องการสอบถามเรื่องอื่น พิมพ์ข้อความไว้ได้เลย เดี๋ยวแอดมินมาตอบค่ะ 😊)');
      }
    }
  }
  res.sendStatus(200);
});

async function reply(token, replyToken, text) {
  if (!token || !replyToken) return;
  try {
    await fetch('https://api.line.me/v2/bot/message/reply', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ replyToken, messages: [{ type: 'text', text }] }),
    });
  } catch { /* webhook must still return 200 to LINE */ }
}

export default r;
