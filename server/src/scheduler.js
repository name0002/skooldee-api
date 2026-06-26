// Lightweight in-process daily scheduler (no external cron dependency).
// Fires once per Bangkok day after a target hour; idempotent via app_meta markers,
// so a process restart never double-sends and a missed window catches up next tick.
import { all, get, run } from './db.js';
import { pushRaw, notifyPlatformOwner } from './line-push.js';

const TARGET_HOUR = Number(process.env.DAILY_NOTIFY_HOUR || 7); // Asia/Bangkok local hour
const TICK_MS = 5 * 60 * 1000; // re-check every 5 minutes
const DOW = ['จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์', 'อาทิตย์'];
const THAI_MON = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];

const hhmm = (m) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;

// Current wall-clock in Asia/Bangkok, regardless of server TZ (Railway runs UTC).
function bkkNow() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Bangkok', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', weekday: 'short', hour12: false,
  }).formatToParts(new Date());
  const m = {}; parts.forEach((p) => { m[p.type] = p.value; });
  const wk = { Mon: 0, Tue: 1, Wed: 2, Thu: 3, Fri: 4, Sat: 5, Sun: 6 };
  const hour = Number(m.hour === '24' ? '0' : m.hour);
  return {
    date: `${m.year}-${m.month}-${m.day}`, ym: `${m.year}-${m.month}`,
    hour, dow: wk[m.weekday], day: Number(m.day),
    mmdd: `${m.month}-${m.day}`, monthIdx: Number(m.month) - 1,
  };
}

const metaGet = (k) => { const r = get('SELECT value FROM app_meta WHERE key = ?', k); return r ? r.value : null; };
const metaSet = (k, v) => run('INSERT INTO app_meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = ?', k, v, v);

function prefs(school) {
  try { return school.notify_prefs ? JSON.parse(school.notify_prefs) : {}; } catch { return {}; }
}

// add N days to a bkkNow-shaped object → { date, dow(Mon=0..Sun=6), day, monthIdx }
function addDays(now, n) {
  const [y, m, d] = now.date.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + n);
  return {
    date: `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, '0')}-${String(dt.getUTCDate()).padStart(2, '0')}`,
    dow: ((now.dow + n) % 7 + 7) % 7,
    day: dt.getUTCDate(), monthIdx: dt.getUTCMonth(),
  };
}

// resolve a category KEY → human label from the school's categories_json (tolerant of
// both [{key,label}] and {key:{label}} shapes); falls back to the raw key.
function catLabeller(catsJson) {
  let map = {};
  try {
    const c = catsJson ? JSON.parse(catsJson) : null;
    if (Array.isArray(c)) c.forEach((x) => { if (x && (x.key || x.id)) map[x.key || x.id] = x.label || x.name || (x.key || x.id); });
    else if (c && typeof c === 'object') Object.entries(c).forEach(([k, v]) => { map[k] = (v && (v.label || v.name)) || k; });
  } catch { map = {}; }
  return (key) => (key ? (map[key] || key) : '');
}

// ---- daily jobs: teacher schedule + birthday greetings ----
async function runDaily(now) {
  const schools = all("SELECT id, line_token, notify_prefs, categories_json FROM schools WHERE line_token IS NOT NULL AND line_token != ''");
  for (const school of schools) {
    const p = prefs(school);

    // 1) teacher daily teaching schedule
    if (p.t_daily) {
      const teachers = all("SELECT id, name, line_user_id FROM teachers WHERE school_id = ? AND line_user_id IS NOT NULL AND line_user_id != ''", school.id);
      for (const t of teachers) {
        const slots = all(
          `SELECT sl.start_min, sl.end_min, sl.category, sl.room,
                  (SELECT GROUP_CONCAT(COALESCE(s.nickname, s.name), ', ')
                     FROM slot_students ss JOIN students s ON s.id = ss.student_id WHERE ss.slot_id = sl.id) AS students
             FROM schedule_slots sl
            WHERE sl.school_id = ? AND sl.teacher_id = ? AND sl.day_of_week = ?
            ORDER BY sl.start_min`, school.id, t.id, now.dow);
        const head = `🗓️ ตารางสอนวันนี้ (${DOW[now.dow]} ${now.day} ${THAI_MON[now.monthIdx]})`;
        const body = slots.length
          ? slots.map((s) => `• ${hhmm(s.start_min)}–${hhmm(s.end_min)} ${s.students || s.category || ''}${s.room ? ` (${s.room})` : ''}`).join('\n')
          : 'วันนี้ไม่มีคาบสอนค่ะ 😊';
        await pushRaw(school.line_token, t.line_user_id, `${head}\n${body}`);
      }
    }

    // 2) student birthday greeting → linked parent (experimental, opt-in)
    if (p.birthday) {
      const kids = all(
        `SELECT id, name, nickname, line_user_id FROM students
          WHERE school_id = ? AND line_user_id IS NOT NULL AND line_user_id != ''
            AND birthday IS NOT NULL AND substr(birthday, 6, 5) = ?`, school.id, now.mmdd);
      for (const s of kids) {
        await pushRaw(school.line_token, s.line_user_id,
          `🎂 สุขสันต์วันเกิดน้อง${s.nickname || s.name} นะคะ!\nขอให้มีความสุข สุขภาพแข็งแรง เก่ง ๆ และสนุกกับการเรียนทุกวันค่ะ 🎉🎈`);
      }
    }

    // 3) class-confirmation reminder — sent the morning BEFORE class (opt-in).
    if (p.confirm_1d) {
      const tmr = addDays(now, 1);
      const labelOf = catLabeller(school.categories_json);
      const kids = all(
        `SELECT id, name, nickname, line_user_id FROM students
          WHERE school_id = ? AND status = 'active' AND line_user_id IS NOT NULL AND line_user_id != ''`, school.id);
      for (const s of kids) {
        // recurring weekly slots falling on tomorrow's weekday, minus any cancellation on that date
        const slots = all(
          `SELECT sl.start_min, sl.end_min, sl.category, sl.room, t.name AS teacher_name
             FROM slot_students ss
             JOIN schedule_slots sl ON sl.id = ss.slot_id
             LEFT JOIN teachers t ON t.id = sl.teacher_id
            WHERE ss.student_id = ? AND sl.school_id = ? AND sl.day_of_week = ?
              AND NOT EXISTS (SELECT 1 FROM schedule_exceptions e
                               WHERE e.slot_id = sl.id AND e.type = 'cancel' AND e.date = ?)
            ORDER BY sl.start_min`, s.id, school.id, tmr.dow, tmr.date);
        // one-off make-up classes scheduled specifically for tomorrow
        const makeups = all(
          `SELECT e.start_min, e.end_min, e.category, NULL AS room, t.name AS teacher_name
             FROM schedule_exceptions e LEFT JOIN teachers t ON t.id = e.teacher_id
            WHERE e.school_id = ? AND e.type = 'makeup' AND e.student_id = ? AND e.date = ?
            ORDER BY e.start_min`, school.id, s.id, tmr.date);
        const classes = [...slots, ...makeups].sort((a, b) => (a.start_min || 0) - (b.start_min || 0));
        if (!classes.length) continue;
        const lines = classes
          .map((c) => `• ${hhmm(c.start_min)}–${hhmm(c.end_min)} ${labelOf(c.category)}${c.teacher_name ? ` · ครู${c.teacher_name}` : ''}`)
          .join('\n');
        // one-tap confirm / leave buttons → postback handled by the LINE webhook
        const quickReply = {
          items: [
            { type: 'action', action: { type: 'postback', label: '✅ ยืนยันมาเรียน',
              data: `action=confirm_class&sid=${s.id}&date=${tmr.date}`, displayText: 'ยืนยันมาเรียนค่ะ' } },
            { type: 'action', action: { type: 'postback', label: '🙏 ขอลา/ไม่มา',
              data: `action=cancel_class&sid=${s.id}&date=${tmr.date}`, displayText: 'ขอลาค่ะ' } },
          ],
        };
        await pushRaw(school.line_token, s.line_user_id,
          `📅 พรุ่งนี้ (${DOW[tmr.dow]} ${tmr.day} ${THAI_MON[tmr.monthIdx]}) น้อง${s.nickname || s.name} มีเรียนค่ะ\n${lines}\n\nรบกวนกดยืนยัน หรือแจ้งลาล่วงหน้าได้เลยนะคะ 🙏`,
          quickReply);
      }
    }
  }

  // 4) platform owner: ping when a school's trial expires tomorrow (regardless of
  // whether that school itself has LINE configured — this is a platform-level alert)
  const tmr = addDays(now, 1);
  const trialSchools = all("SELECT name, plan_expires FROM schools WHERE plan = 'trial' AND plan_expires IS NOT NULL");
  for (const sch of trialSchools) {
    if (sch.plan_expires.slice(0, 10) === tmr.date) {
      await notifyPlatformOwner(`⚠️ ${sch.name} trial หมดอายุพรุ่งนี้ (${tmr.date})`);
    }
  }
}

// ---- monthly job: teacher pay summary for the previous month (fires on the 1st) ----
async function runMonthly(prevYm) {
  const schools = all("SELECT id, line_token, notify_prefs FROM schools WHERE line_token IS NOT NULL AND line_token != ''");
  for (const school of schools) {
    const p = prefs(school);
    if (!p.t_monthly) continue;
    const teachers = all("SELECT * FROM teachers WHERE school_id = ? AND line_user_id IS NOT NULL AND line_user_id != ''", school.id);
    for (const t of teachers) {
      const { sessions, minutes, pay } = teacherMonth(school.id, t, prevYm);
      if (sessions === 0) continue;
      const [yy, mm] = prevYm.split('-');
      await pushRaw(school.line_token, t.line_user_id,
        `💰 สรุปค่าสอนเดือน ${THAI_MON[Number(mm) - 1]} ${Number(yy) + 543}\n` +
        `• สอนจริง ${sessions} คาบ · ${(minutes / 60).toFixed(1)} ชม.\n` +
        `• ค่าสอนรวม ฿${pay.toLocaleString()}\n\nขอบคุณสำหรับการสอนเดือนนี้นะคะ 🙏`);
    }
  }
}

// compact attendance-based pay for one teacher in a month (mirrors /payslip core)
function teacherMonth(schoolId, t, month) {
  const defRate = t.hourly_rate || 0;
  let minutes = 0, pay = 0, sessions = 0;
  const slotRows = all(
    `SELECT sl.start_min, sl.end_min, sl.rate AS rate,
            SUM(CASE WHEN a.status = 'present' THEN 1 ELSE 0 END) AS present
       FROM attendance a JOIN schedule_slots sl ON sl.id = a.slot_id
      WHERE sl.teacher_id = ? AND a.school_id = ? AND substr(a.date,1,7) = ?
      GROUP BY a.slot_id, a.date`, t.id, schoolId, month);
  const exRows = all(
    `SELECT e.start_min, e.end_min, e.rate AS rate,
            SUM(CASE WHEN a.status = 'present' THEN 1 ELSE 0 END) AS present
       FROM attendance a JOIN schedule_exceptions e ON e.id = a.exception_id
      WHERE e.teacher_id = ? AND e.type = 'makeup' AND a.school_id = ? AND substr(a.date,1,7) = ?
      GROUP BY e.id`, t.id, schoolId, month);
  for (const row of [...slotRows, ...exRows]) {
    if (!row.present) continue;
    const dur = (row.end_min || 0) - (row.start_min || 0);
    const rate = (row.rate != null) ? row.rate : defRate;
    minutes += dur; pay += (dur / 60) * rate; sessions += 1;
  }
  return { sessions, minutes, pay: Math.round(pay) };
}

function prevMonthOf(ym) {
  const [y, m] = ym.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 1, 1)); d.setUTCMonth(d.getUTCMonth() - 1);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

async function tick() {
  try {
    const now = bkkNow();
    if (now.hour < TARGET_HOUR) return;
    if (metaGet('cron_daily_last') !== now.date) {
      await runDaily(now);
      metaSet('cron_daily_last', now.date);
    }
    // monthly summary on the 1st, for the month that just ended
    if (now.day === 1 && metaGet('cron_monthly_last') !== now.ym) {
      await runMonthly(prevMonthOf(now.ym));
      metaSet('cron_monthly_last', now.ym);
    }
  } catch (e) { console.warn('[scheduler] tick error', e && e.message); }
}

export function startScheduler() {
  setTimeout(tick, 15 * 1000); // first check shortly after boot
  setInterval(tick, TICK_MS);
  console.log(`[scheduler] daily notifications armed (Asia/Bangkok ≥ ${TARGET_HOUR}:00)`);
}
