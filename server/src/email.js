/**
 * skooldee email helper — powered by Resend.
 * Set RESEND_API_KEY in Railway env to activate.
 * Falls back to console.log in dev / when key is missing.
 *
 * Usage:
 *   import { sendEmail } from './email.js';
 *   await sendEmail({ to, subject, html });
 */

const API_KEY   = process.env.RESEND_API_KEY;
const FROM_ADDR = process.env.EMAIL_FROM || 'skooldee <noreply@skooldee.com>';
const BRAND_LOGO = 'https://skooldee.com/favicon.svg';

export const emailEnabled = !!API_KEY && !API_KEY.startsWith('PLACEHOLDER');

export async function sendEmail({ to, subject, html, text }) {
  if (!emailEnabled) {
    console.log(`[email] RESEND not configured — would send to ${to}: ${subject}`);
    return { ok: false, reason: 'not_configured' };
  }
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${API_KEY}` },
    body: JSON.stringify({ from: FROM_ADDR, to: [to], subject, html, text }),
  });
  const json = await res.json();
  if (!res.ok) throw Object.assign(new Error(json.message || 'resend error'), { status: res.status });
  return json;
}

// ─────────────── Email templates ───────────────

export function tplWelcome({ schoolName, ownerName, loginUrl = 'https://skooldee.com/app' }) {
  return {
    subject: `ยินดีต้อนรับสู่ skooldee — ${schoolName} พร้อมใช้งานแล้ว!`,
    html: `
<div style="font-family:sans-serif;max-width:560px;margin:0 auto;padding:32px 24px">
  <div style="font-size:22px;font-weight:700;margin-bottom:8px">🎉 บัญชีของคุณพร้อมแล้ว!</div>
  <p>สวัสดีคุณ${ownerName},</p>
  <p><b>${schoolName}</b> ลงทะเบียนกับ skooldee สำเร็จแล้ว ทดลองใช้ได้ฟรี 14 วัน</p>
  <a href="${loginUrl}" style="display:inline-block;margin:20px 0;padding:12px 28px;background:#0D9488;color:#fff;border-radius:10px;text-decoration:none;font-weight:700">
    เข้าสู่ระบบ skooldee →
  </a>
  <p style="color:#666;font-size:13px">มีคำถาม? ทักเราได้ที่ LINE @skooldee หรือ support@skooldee.com</p>
  <hr style="border:none;border-top:1px solid #eee;margin:24px 0"/>
  <p style="color:#999;font-size:12px">skooldee · ระบบจัดการโรงเรียนสอนพิเศษ</p>
</div>`,
  };
}

export function tplPasswordReset({ email, resetUrl }) {
  return {
    subject: 'รีเซ็ตรหัสผ่าน skooldee ของคุณ',
    html: `
<div style="font-family:sans-serif;max-width:560px;margin:0 auto;padding:32px 24px">
  <div style="font-size:20px;font-weight:700;margin-bottom:8px">🔐 รีเซ็ตรหัสผ่าน</div>
  <p>เราได้รับคำขอรีเซ็ตรหัสผ่านสำหรับบัญชี <b>${email}</b></p>
  <p>กดปุ่มด้านล่างเพื่อตั้งรหัสผ่านใหม่ (ลิงก์หมดอายุใน 1 ชั่วโมง)</p>
  <a href="${resetUrl}" style="display:inline-block;margin:20px 0;padding:12px 28px;background:#0D9488;color:#fff;border-radius:10px;text-decoration:none;font-weight:700">
    ตั้งรหัสผ่านใหม่ →
  </a>
  <p style="color:#666;font-size:13px">หากคุณไม่ได้ขอรีเซ็ต ไม่ต้องทำอะไร รหัสผ่านของคุณยังเหมือนเดิม</p>
  <hr style="border:none;border-top:1px solid #eee;margin:24px 0"/>
  <p style="color:#999;font-size:12px">skooldee · ระบบจัดการโรงเรียนสอนพิเศษ</p>
</div>`,
  };
}

export function tplNewEnrollment({ schoolName, studentName, parentName, phone, lineId, category, note, adminUrl = 'https://skooldee.com/app' }) {
  const rows = [
    ['นักเรียน', studentName],
    ['ผู้ปกครอง', parentName || '-'],
    ['เบอร์โทร', phone || '-'],
    ['LINE ID', lineId || '-'],
    ['วิชาที่สนใจ', category || '-'],
    ['ข้อความ', note || '-'],
  ];
  return {
    subject: `🎓 ผู้สมัครเรียนใหม่: ${studentName} — ${schoolName}`,
    html: `
<div style="font-family:sans-serif;max-width:560px;margin:0 auto;padding:32px 24px">
  <div style="font-size:20px;font-weight:700;margin-bottom:6px">🎓 มีผู้สมัครเรียนใหม่!</div>
  <p style="color:#555;margin-bottom:18px"><b>${schoolName}</b> ได้รับใบสมัครเรียนใหม่ผ่านหน้าสมัครออนไลน์</p>
  <table style="width:100%;border-collapse:collapse">
    ${rows.map(([k, v]) => `
    <tr><td style="padding:8px 12px;background:#f9f9f9;font-weight:600;border-bottom:1px solid #eee;width:32%">${k}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #eee">${v}</td></tr>`).join('')}
  </table>
  <a href="${adminUrl}" style="display:inline-block;margin:22px 0 8px;padding:12px 28px;background:#0D9488;color:#fff;border-radius:10px;text-decoration:none;font-weight:700">
    ดูใบสมัคร & รับเข้าเรียน →
  </a>
  <p style="color:#999;font-size:12.5px">เปิดเมนู "นักเรียน → ผู้สมัคร" เพื่อกดรับเข้าเรียนหรือปฏิเสธ</p>
  <hr style="border:none;border-top:1px solid #eee;margin:24px 0"/>
  <p style="color:#999;font-size:12px">skooldee · ระบบจัดการโรงเรียนสอนพิเศษ</p>
</div>`,
  };
}

export function tplNewLead({ school, name, email, phone, category, plan }) {
  return {
    subject: `🚀 Lead ใหม่: ${school} (${category||'ไม่ระบุ'})`,
    html: `
<div style="font-family:sans-serif;max-width:560px;margin:0 auto;padding:32px 24px">
  <div style="font-size:20px;font-weight:700;margin-bottom:16px">📋 Lead ใหม่เข้ามา!</div>
  <table style="width:100%;border-collapse:collapse">
    ${[['โรงเรียน',school],['ชื่อ',name],['อีเมล',email],['เบอร์',phone||'-'],['ประเภท',category||'-'],['แผน',plan||'-']].map(([k,v])=>`
    <tr><td style="padding:8px 12px;background:#f9f9f9;font-weight:600;border-bottom:1px solid #eee;width:30%">${k}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #eee">${v}</td></tr>`).join('')}
  </table>
  <a href="https://skooldee.com/admin" style="display:inline-block;margin:20px 0;padding:10px 22px;background:#0D9488;color:#fff;border-radius:8px;text-decoration:none;font-weight:700">
    ดูใน Admin →
  </a>
</div>`,
  };
}
