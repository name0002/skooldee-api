// Seed a demo school with fictional data (safe to show publicly).
// Login after seeding:  demo@skooldee.com / demo1234
import 'dotenv/config';
import { db, get, run, initSchema } from './db.js';
import { hashPassword } from './auth.js';

initSchema();

if (get('SELECT id FROM users WHERE email = ?', 'demo@skooldee.com')) {
  console.log('Demo data already present. Run `npm run reset` to rebuild from scratch.');
  process.exit(0);
}

const m = (s) => { const [h, mm] = s.split(':').map(Number); return h * 60 + mm; };

function seed() {
  const sid = Number(run(
    'INSERT INTO schools (name, slug, category, near_limit_threshold) VALUES (?,?,?,?)',
    'เมโลดี้ สตูดิโอ', 'melody-studio-demo', 'ดนตรี·เต้น·ศิลปะ', 2).lastInsertRowid);

  run('INSERT INTO users (school_id, email, password_hash, name, role) VALUES (?,?,?,?,?)',
    sid, 'demo@skooldee.com', hashPassword('demo1234'), 'คุณเดโม่ (เจ้าของ)', 'owner');

  // course packages (editable pricing)
  const pkgs = [
    ['10 ครั้ง · 1 ชม.', 10, 60, 8500, 1, 1],
    ['10 ครั้ง · 30 นาที', 10, 30, 5800, 0, 2],
    ['4 ครั้ง · 1 ชม.', 4, 60, 3800, 0, 3],
    ['4 ครั้ง · 30 นาที', 4, 30, 2600, 0, 4],
  ].map((p) => Number(run(
    'INSERT INTO packages (school_id, name, sessions, duration_min, price, is_default, sort) VALUES (?,?,?,?,?,?,?)',
    sid, ...p).lastInsertRowid));

  // teachers (music + dance + art)
  const t = {};
  [['ครูมิ้นต์', 'ดนตรี', 500], ['ครูเจได', 'ดนตรี', 450], ['ครูแพรว', 'เต้น', 400], ['ครูโตโน่', 'ศิลปะ', 400]]
    .forEach(([name, cat, rate]) => {
      t[name] = Number(run('INSERT INTO teachers (school_id, name, category, hourly_rate) VALUES (?,?,?,?)',
        sid, name, cat, rate).lastInsertRowid);
    });

  // students (fictional). [name, nick, age, parentPhone, category, teacher, pkgIdx, remaining, balance, points]
  const s = {};
  [
    ['ด.ญ. ปลายฟ้า ใจดี', 'ปลายฟ้า', 9, '081-111-1111', 'ดนตรี', 'ครูมิ้นต์', 0, 7, 0, 120],
    ['ด.ช. แทนคุณ มากมี', 'แทนคุณ', 11, '081-222-2222', 'ดนตรี', 'ครูเจได', 0, 1, 0, 540],
    ['ด.ญ. เฌอ พราวแสง', 'เฌอ', 8, '081-333-3333', 'เต้น', 'ครูแพรว', 1, 2, 5800, 90],
    ['ด.ช. บินตรา สุขเสมอ', 'บินตรา', 12, '081-444-4444', 'ดนตรี', 'ครูมิ้นต์', 0, 2, 0, 1620],
    ['ด.ญ. มีโม่ แสนดี', 'มีโม่', 7, '081-555-5555', 'ศิลปะ', 'ครูโตโน่', 2, 4, 0, 60],
    ['ด.ช. นาวิน เก่งกล้า', 'นาวิน', 13, '081-666-6666', 'ดนตรี', 'ครูเจได', 0, 9, 0, 300],
    ['ด.ญ. อันดา ฟ้าใส', 'อันดา', 10, '081-777-7777', 'เต้น', 'ครูแพรว', 3, 0, 2600, 30],
    ['ด.ช. ภูมิ ตั้งใจ', 'ภูมิ', 9, '081-888-8888', 'ดนตรี', 'ครูมิ้นต์', 1, 6, 0, 760],
  ].forEach(([name, nick, age, phone, cat, teacher, pk, rem, bal, pts]) => {
    const code = 'MARI-' + nick.slice(0, 2).toUpperCase() + Math.floor(100 + Math.random() * 900);
    s[nick] = Number(run(
      `INSERT INTO students (school_id, name, nickname, age, parent_phone, category, teacher_id, package_id,
         sessions_remaining, sessions_total, balance_due, points, referral_code, status)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?, 'active')`,
      sid, name, nick, age, phone, cat, t[teacher], pkgs[pk], rem, [10, 10, 4, 4][pk], bal, pts, code).lastInsertRowid);
    if (pts) run('INSERT INTO points_ledger (school_id, student_id, delta, reason) VALUES (?,?,?,?)',
      sid, s[nick], pts, 'ยอดสะสมเริ่มต้น');
  });

  // schedule slots (0=Mon..6=Sun)
  [
    ['ครูมิ้นต์', 'ดนตรี', 0, '16:00', '17:00', ['ปลายฟ้า']],
    ['ครูเจได', 'ดนตรี', 0, '17:00', '18:00', ['นาวิน']],
    ['ครูแพรว', 'เต้น', 1, '15:00', '16:00', ['เฌอ', 'อันดา']], // group class
    ['ครูมิ้นต์', 'ดนตรี', 5, '10:00', '11:00', ['บินตรา']],
    ['ครูโตโน่', 'ศิลปะ', 6, '13:00', '14:30', ['มีโม่']],
  ].forEach(([teacher, cat, dow, st, en, kids]) => {
    const isGroup = kids.length > 1 ? 1 : 0;
    const slot = Number(run(
      'INSERT INTO schedule_slots (school_id, teacher_id, category, day_of_week, start_min, end_min, is_group, title) VALUES (?,?,?,?,?,?,?,?)',
      sid, t[teacher], cat, dow, m(st), m(en), isGroup, isGroup ? 'คลาสกลุ่ม' : null).lastInsertRowid);
    kids.forEach((k) => run('INSERT INTO slot_students (slot_id, student_id) VALUES (?,?)', slot, s[k]));
  });

  // invoices: two paid this month + one outstanding
  const ym = new Date().toISOString().slice(0, 10);
  run('INSERT INTO invoices (school_id, student_id, package_id, amount, status, paid_at) VALUES (?,?,?,?,?,?)',
    sid, s['ปลายฟ้า'], pkgs[0], 8500, 'paid', ym);
  run('INSERT INTO invoices (school_id, student_id, package_id, amount, status, paid_at) VALUES (?,?,?,?,?,?)',
    sid, s['ภูมิ'], pkgs[1], 5800, 'paid', ym);
  run('INSERT INTO invoices (school_id, student_id, package_id, amount, status, note) VALUES (?,?,?,?,?,?)',
    sid, s['เฌอ'], pkgs[1], 5800, 'unpaid', 'ต่อคอร์ส');

  // homework
  run('INSERT INTO homework (school_id, student_id, title, detail, status, notified) VALUES (?,?,?,?,?,?)',
    sid, s['ปลายฟ้า'], 'ฝึกสเกล C major', 'วันละ 15 นาที', 'pending', 1);
  run('INSERT INTO homework (school_id, student_id, title, detail, status, notified) VALUES (?,?,?,?,?,?)',
    sid, s['นาวิน'], 'ซ้อมเพลงสอบ', 'ท่อน intro ให้คล่อง', 'done', 1);

  // referral
  run('INSERT INTO referrals (school_id, referrer_student_id, friend_name, friend_phone, status) VALUES (?,?,?,?,?)',
    sid, s['บินตรา'], 'น้องข้าวปั้น', '081-999-9999', 'trial');

  return sid;
}

db.exec('BEGIN');
let sid;
try {
  sid = seed();
  db.exec('COMMIT');
} catch (e) {
  db.exec('ROLLBACK');
  throw e;
}
console.log('Seeded demo school (id=' + sid + ').  Login: demo@skooldee.com / demo1234');
