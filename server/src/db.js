// Database layer — uses Node's built-in node:sqlite (no native build required).
// Swap to PostgreSQL later by replacing this module with a pg-backed implementation
// that exposes the same query helpers (db.run / db.get / db.all).
import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import crypto from 'node:crypto';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DB_PATH = process.env.DB_PATH || join(__dirname, '..', 'data.sqlite');

export const db = new DatabaseSync(DB_PATH);
db.exec('PRAGMA journal_mode = WAL;');
db.exec('PRAGMA foreign_keys = ON;');

// ---- thin query helpers (positional ? params) ----
export const run = (sql, ...params) => db.prepare(sql).run(...params);
export const get = (sql, ...params) => db.prepare(sql).get(...params);
export const all = (sql, ...params) => db.prepare(sql).all(...params);

export const SCHEMA = `
CREATE TABLE IF NOT EXISTS schools (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  slug TEXT UNIQUE,
  category TEXT,
  near_limit_threshold INTEGER NOT NULL DEFAULT 2,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  school_id INTEGER NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'owner',          -- owner | admin | teacher | finance
  reset_token TEXT,
  reset_expires TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS teachers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  school_id INTEGER NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  category TEXT,
  hourly_rate INTEGER NOT NULL DEFAULT 0,
  phone TEXT, line_id TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS packages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  school_id INTEGER NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  sessions INTEGER NOT NULL,
  duration_min INTEGER NOT NULL,
  price INTEGER NOT NULL,
  is_default INTEGER NOT NULL DEFAULT 0,
  sort INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS students (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  school_id INTEGER NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  nickname TEXT,
  age INTEGER,
  parent_name TEXT, parent_phone TEXT, line_id TEXT,
  category TEXT,
  teacher_id INTEGER REFERENCES teachers(id) ON DELETE SET NULL,
  package_id INTEGER REFERENCES packages(id) ON DELETE SET NULL,
  sessions_remaining INTEGER NOT NULL DEFAULT 0,
  sessions_total INTEGER NOT NULL DEFAULT 0,
  balance_due INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active',        -- active | paused | inactive
  points INTEGER NOT NULL DEFAULT 0,
  referral_code TEXT,
  referred_by INTEGER REFERENCES students(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS schedule_slots (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  school_id INTEGER NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  teacher_id INTEGER REFERENCES teachers(id) ON DELETE SET NULL,
  category TEXT,
  day_of_week INTEGER NOT NULL,                 -- 0=Mon .. 6=Sun
  start_min INTEGER NOT NULL,                   -- minutes from 00:00
  end_min INTEGER NOT NULL,
  is_group INTEGER NOT NULL DEFAULT 0,
  title TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS slot_students (
  slot_id INTEGER NOT NULL REFERENCES schedule_slots(id) ON DELETE CASCADE,
  student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  PRIMARY KEY (slot_id, student_id)
);

-- date-specific exceptions to the recurring weekly schedule:
--   type 'cancel'  → a recurring slot is cancelled on this date (slot_id set)
--   type 'makeup'  → a one-time class on this date (slot_id null; student/teacher/time set)
CREATE TABLE IF NOT EXISTS schedule_exceptions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  school_id INTEGER NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  slot_id INTEGER REFERENCES schedule_slots(id) ON DELETE CASCADE,
  date TEXT NOT NULL,
  type TEXT NOT NULL,
  student_id INTEGER REFERENCES students(id) ON DELETE CASCADE,
  teacher_id INTEGER REFERENCES teachers(id) ON DELETE SET NULL,
  category TEXT,
  start_min INTEGER,
  end_min INTEGER,
  note TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS attendance (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  school_id INTEGER NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  slot_id INTEGER REFERENCES schedule_slots(id) ON DELETE SET NULL,
  date TEXT NOT NULL,
  status TEXT NOT NULL,                          -- present | absent | leave
  points_awarded INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS invoices (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  school_id INTEGER NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  package_id INTEGER REFERENCES packages(id) ON DELETE SET NULL,
  amount INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'unpaid',         -- unpaid | paid
  note TEXT,
  issued_at TEXT NOT NULL DEFAULT (datetime('now')),
  paid_at TEXT
);

CREATE TABLE IF NOT EXISTS homework (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  school_id INTEGER NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  detail TEXT,
  due_date TEXT,
  status TEXT NOT NULL DEFAULT 'pending',         -- pending | done | overdue
  notified INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS points_ledger (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  school_id INTEGER NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  delta INTEGER NOT NULL,
  reason TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS referrals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  school_id INTEGER NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  referrer_student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  friend_name TEXT NOT NULL,
  friend_phone TEXT,
  status TEXT NOT NULL DEFAULT 'invited',         -- invited | trial | subscribed
  referrer_reward INTEGER NOT NULL DEFAULT 0,
  friend_reward INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS leads (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  school TEXT,
  name TEXT,
  phone TEXT,
  email TEXT,
  category TEXT,
  size TEXT,
  plan TEXT,
  message TEXT,
  source TEXT NOT NULL DEFAULT 'signup',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS app_meta (
  key TEXT PRIMARY KEY,
  value TEXT
);

-- Public enrollment / waitlist requests submitted through the school's /join page.
-- Admin reviews each request and can accept (creates a student) or reject it.
CREATE TABLE IF NOT EXISTS enrollment_requests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  school_id INTEGER NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  student_name TEXT NOT NULL,
  parent_name TEXT,
  phone TEXT,
  line_id TEXT,
  category TEXT,
  note TEXT,
  status TEXT NOT NULL DEFAULT 'pending',   -- pending | accepted | rejected
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_enroll_school ON enrollment_requests(school_id, status);

CREATE INDEX IF NOT EXISTS idx_students_school ON students(school_id);
CREATE INDEX IF NOT EXISTS idx_attendance_school_date ON attendance(school_id, date);
CREATE INDEX IF NOT EXISTS idx_slots_school_day ON schedule_slots(school_id, day_of_week);

CREATE TABLE IF NOT EXISTS portal_sessions (
  token TEXT PRIMARY KEY,
  school_id INTEGER NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'parent',
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_portal_sessions_school ON portal_sessions(school_id, student_id);

-- periodic skill/development assessments (star ratings per customizable criterion).
-- scores_json holds { "<criterionName>": <1..5>, ... } for the subject's rubric.
CREATE TABLE IF NOT EXISTS assessments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  school_id INTEGER NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  category TEXT,                                 -- subject this assessment is for
  date TEXT NOT NULL,                            -- YYYY-MM-DD (assessment period)
  scores_json TEXT,                             -- { criterion: 1..5 }
  note TEXT,
  teacher_id INTEGER REFERENCES teachers(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_assessments_student ON assessments(school_id, student_id);

-- parent responses to the "confirm class 1 day before" reminder (day-level: one row
-- per student per class-date). Upserted on each tap so the latest answer wins.
CREATE TABLE IF NOT EXISTS class_confirmations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  school_id INTEGER NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  date TEXT NOT NULL,                            -- YYYY-MM-DD (the class date)
  status TEXT NOT NULL,                          -- confirmed | cancelled
  responded_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(student_id, date)
);
CREATE INDEX IF NOT EXISTS idx_confirm_school_date ON class_confirmations(school_id, date);

-- Self-service booking: a school publishes date-specific sessions that parents/prospects
-- book a seat in (through a public link). One unified table covers every booking model via kind:
--   group   → an open group class (capacity > 1), bookable by existing students
--   private → a 1-on-1 slot from a teacher's availability (capacity 1)
--   makeup  → a make-up class for a missed session (also mirrored into schedule_exceptions)
--   trial   → an intro/trial class open to NEW prospects (no student record yet)
CREATE TABLE IF NOT EXISTS bookable_sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  school_id INTEGER NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  teacher_id INTEGER REFERENCES teachers(id) ON DELETE SET NULL,
  kind TEXT NOT NULL DEFAULT 'group',           -- group | private | makeup | trial
  title TEXT,
  category TEXT,
  date TEXT NOT NULL,                            -- YYYY-MM-DD (a specific calendar date)
  start_min INTEGER NOT NULL,                    -- minutes from 00:00
  end_min INTEGER NOT NULL,
  capacity INTEGER NOT NULL DEFAULT 1,
  room TEXT,
  fee INTEGER,                                  -- optional price shown to the booker (THB)
  open_to TEXT NOT NULL DEFAULT 'existing',      -- existing | public | both
  status TEXT NOT NULL DEFAULT 'open',           -- open | closed | cancelled
  note TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_bookable_school_date ON bookable_sessions(school_id, date);

CREATE TABLE IF NOT EXISTS bookings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  school_id INTEGER NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  session_id INTEGER NOT NULL REFERENCES bookable_sessions(id) ON DELETE CASCADE,
  student_id INTEGER REFERENCES students(id) ON DELETE CASCADE,  -- null for public/new prospects
  booker_name TEXT,                             -- filled when there's no student_id yet
  booker_phone TEXT,
  booker_line TEXT,
  status TEXT NOT NULL DEFAULT 'booked',         -- booked | cancelled | attended | no_show
  note TEXT,
  exception_id INTEGER,                          -- the schedule_exceptions row created for a makeup
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_bookings_session ON bookings(session_id, status);
CREATE INDEX IF NOT EXISTS idx_bookings_school ON bookings(school_id, status);

-- Staff (teacher) evaluation: a school defines reusable rubrics (criteria, 1-5 stars
-- each, same shape as the student-assessment rubric) then an owner/supervisor scores
-- a teacher against one of those templates on a given date.
CREATE TABLE IF NOT EXISTS evaluation_templates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  school_id INTEGER NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  criteria_json TEXT NOT NULL,                   -- ["เกณฑ์1","เกณฑ์2",...]
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_eval_templates_school ON evaluation_templates(school_id);

CREATE TABLE IF NOT EXISTS evaluations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  school_id INTEGER NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  template_id INTEGER REFERENCES evaluation_templates(id) ON DELETE SET NULL,
  teacher_id INTEGER NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
  evaluator_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  date TEXT NOT NULL,                            -- YYYY-MM-DD (evaluation period)
  scores_json TEXT,                              -- { criterion: 1..5 }
  comments TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_evaluations_teacher ON evaluations(school_id, teacher_id);
`;

export function initSchema() {
  db.exec(SCHEMA);
  // Safe column additions (ALTER TABLE is idempotent via try/catch)
  const addCol = (sql) => { try { db.exec(sql); } catch {} };
  addCol('ALTER TABLE users ADD COLUMN reset_token TEXT');
  addCol('ALTER TABLE users ADD COLUMN reset_expires TEXT');
  // staff access control: link a teacher-role login to a teacher record (whose data
  // they manage) + per-user permission overrides { scope, pages } as JSON.
  addCol('ALTER TABLE users ADD COLUMN teacher_id INTEGER REFERENCES teachers(id) ON DELETE SET NULL');
  addCol('ALTER TABLE users ADD COLUMN permissions_json TEXT');
  addCol('ALTER TABLE users ADD COLUMN phone TEXT');
  addCol("ALTER TABLE invoices ADD COLUMN payment_method TEXT NOT NULL DEFAULT 'transfer'");
  addCol('ALTER TABLE students ADD COLUMN birthday TEXT');
  addCol('ALTER TABLE schools ADD COLUMN categories_json TEXT');
  addCol('ALTER TABLE schedule_slots ADD COLUMN per_session INTEGER NOT NULL DEFAULT 0');
  addCol('ALTER TABLE schedule_slots ADD COLUMN session_fee INTEGER NOT NULL DEFAULT 0');
  addCol('ALTER TABLE schools ADD COLUMN line_token TEXT');
  addCol('ALTER TABLE schools ADD COLUMN line_secret TEXT');
  addCol('ALTER TABLE schools ADD COLUMN notify_prefs TEXT');
  addCol("ALTER TABLE schools ADD COLUMN name_display TEXT NOT NULL DEFAULT 'full'");
  addCol('ALTER TABLE students ADD COLUMN line_user_id TEXT');
  // display name of the LINE account that linked — lets the owner SEE who is connected
  // and spot a wrong link (e.g. they tapped the parent's link themselves).
  addCol('ALTER TABLE students ADD COLUMN line_display_name TEXT');
  addCol('ALTER TABLE students ADD COLUMN categories_json TEXT');
  addCol('ALTER TABLE teachers ADD COLUMN categories_json TEXT');
  addCol('ALTER TABLE invoices ADD COLUMN subtotal INTEGER');
  addCol("ALTER TABLE invoices ADD COLUMN discount_type TEXT");
  addCol('ALTER TABLE invoices ADD COLUMN discount_value INTEGER NOT NULL DEFAULT 0');
  addCol('ALTER TABLE students ADD COLUMN parent_token TEXT');
  addCol('ALTER TABLE invoices ADD COLUMN slip_image TEXT');
  addCol('ALTER TABLE attendance ADD COLUMN exception_id INTEGER');
  addCol('ALTER TABLE students ADD COLUMN goal TEXT');
  addCol('ALTER TABLE students ADD COLUMN email TEXT');
  addCol('ALTER TABLE students ADD COLUMN packages_json TEXT');
  addCol('ALTER TABLE schedule_slots ADD COLUMN rate INTEGER');
  addCol('ALTER TABLE schedule_slots ADD COLUMN room TEXT');
  addCol('ALTER TABLE schedule_exceptions ADD COLUMN rate INTEGER');
  addCol('ALTER TABLE schools ADD COLUMN hours_start INTEGER');
  addCol('ALTER TABLE schools ADD COLUMN hours_end INTEGER');
  addCol('ALTER TABLE schools ADD COLUMN contact_phone TEXT');
  addCol('ALTER TABLE schools ADD COLUMN line_oa_url TEXT');
  addCol('ALTER TABLE schools ADD COLUMN line_oa_basic_id TEXT');
  // LIFF app id — lets parents tap a link inside LINE and get auto-connected
  // (no typing a code). Configured once per school in settings. Not a secret.
  addCol('ALTER TABLE schools ADD COLUMN liff_id TEXT');
  addCol('ALTER TABLE schools ADD COLUMN rooms_json TEXT'); // managed list of classroom names
  // development-assessment rubric (criteria per subject) + parent visibility toggle
  addCol('ALTER TABLE schools ADD COLUMN assessment_criteria_json TEXT'); // { "<catKey>": ["เทคนิค","จังหวะ",...] }
  addCol('ALTER TABLE schools ADD COLUMN show_assessments_to_parents INTEGER NOT NULL DEFAULT 0');
  // which subject a renewal invoice tops up (so multi-subject students renew the right course)
  addCol('ALTER TABLE invoices ADD COLUMN category TEXT');
  // course-round number (per subject, stored in students.packages_json[].round) — owner always
  // sees it; parents only when this toggle is on.
  addCol('ALTER TABLE schools ADD COLUMN show_course_no_to_parents INTEGER NOT NULL DEFAULT 0');
  // customizable message the admin copies when inviting a parent to link LINE.
  // Placeholders: {ชื่อ} = student nick/name, {ลิงก์} = the one-tap LIFF link, {ผู้รับ} = relationship-aware greeting.
  addCol('ALTER TABLE schools ADD COLUMN invite_message_template TEXT');
  // who actually receives a student's LINE messages, so wording adapts (not always "คุณพ่อคุณแม่"):
  // parent (default/null) | self (adult learner) | sibling (พี่/น้อง) | relative (ญาติ/อื่นๆ)
  addCol('ALTER TABLE students ADD COLUMN recipient_type TEXT');
  // customizable homework-notification template. Placeholders: {ผู้รับ} {ชื่อ} {หัวข้อ} {รายละเอียด} {กำหนดส่ง}
  addCol('ALTER TABLE schools ADD COLUMN homework_message_template TEXT');
  // LINE welcome message when parent/student links their account
  addCol('ALTER TABLE schools ADD COLUMN line_welcome_enabled INTEGER NOT NULL DEFAULT 1');
  addCol('ALTER TABLE schools ADD COLUMN line_welcome_message TEXT');
  // subscription plan: trial | starter | pro | premium | cancelled
  addCol("ALTER TABLE schools ADD COLUMN plan TEXT NOT NULL DEFAULT 'trial'");
  // ISO datetime when current plan/trial expires; NULL means no expiry set yet
  addCol('ALTER TABLE schools ADD COLUMN plan_expires TEXT');
  // Stripe customer/subscription IDs (internal, never exposed to client)
  addCol('ALTER TABLE schools ADD COLUMN stripe_customer_id TEXT');
  addCol('ALTER TABLE schools ADD COLUMN stripe_subscription_id TEXT');
  // QR Code image (data URL) for the school's PromptPay / bank account — shown to
  // parents on the portal so they can scan-to-pay and then upload a slip.
  addCol('ALTER TABLE schools ADD COLUMN payment_qr_image TEXT');
  addCol('ALTER TABLE schools ADD COLUMN logo_image TEXT');
  // platform-owner LINE notifications (new signups, plan changes, trial expiry, payment failures).
  // Stored on whichever school row the platform admin links — that school's own LINE
  // channel (line_token) is reused to push the alert to owner_line_id.
  addCol('ALTER TABLE schools ADD COLUMN owner_line_id TEXT');
  addCol('ALTER TABLE schools ADD COLUMN owner_link_code TEXT');
  // LINE Rich Menu (the tappable menu pinned to the bottom of the OA chat):
  //   rich_menu_id     — the LINE-assigned id of the currently-published menu (so we
  //                      can delete/replace it). NULL = none published.
  //   rich_menu_config — JSON of the builder state (mode, size, layout rows, per-button
  //                      label/icon/action) so the builder reloads exactly as saved.
  //   rich_menu_image  — data-URL of the image we uploaded, kept for preview re-display.
  addCol('ALTER TABLE schools ADD COLUMN rich_menu_id TEXT');
  addCol('ALTER TABLE schools ADD COLUMN rich_menu_config TEXT');
  addCol('ALTER TABLE schools ADD COLUMN rich_menu_image TEXT');
  // teacher LINE linking (parallel to the parent flow): a teacher adds the school's
  // OA and sends their personal link_code to start receiving notifications.
  addCol('ALTER TABLE teachers ADD COLUMN line_user_id TEXT');
  addCol('ALTER TABLE teachers ADD COLUMN link_code TEXT');
  // backfill link_code for existing teachers (short, human-typeable, prefixed so the
  // webhook can tell teacher codes apart from student referral codes)
  try {
    const trows = all("SELECT id FROM teachers WHERE link_code IS NULL OR link_code = ''");
    for (const t of trows) {
      run('UPDATE teachers SET link_code = ? WHERE id = ?', 'T' + crypto.randomBytes(3).toString('hex').toUpperCase(), t.id);
    }
  } catch {}
  // leads belong to the school created at sign-up (scoped per-tenant for the leads list)
  addCol('ALTER TABLE leads ADD COLUMN school_id INTEGER');
  // alternate payment channel: a merchant link (e.g. Payso) shown to parents alongside the QR
  addCol('ALTER TABLE schools ADD COLUMN payso_link TEXT');
  // lets a school show the QR but disable the in-portal slip-upload flow (manual confirmation instead)
  addCol("ALTER TABLE schools ADD COLUMN slip_enabled INTEGER NOT NULL DEFAULT 1");
  // backfill existing leads: the sign-up lead shares the owner's email → resolve its school
  try {
    run(`UPDATE leads SET school_id = (
           SELECT u.school_id FROM users u WHERE u.email = leads.email
         ) WHERE school_id IS NULL AND email IS NOT NULL AND email != ''`);
  } catch {}

  // backfill parent_token for existing students (read-only parent portal link)
  try {
    const rows = all("SELECT id FROM students WHERE parent_token IS NULL OR parent_token = ''");
    for (const r of rows) {
      run('UPDATE students SET parent_token = ? WHERE id = ?', crypto.randomBytes(8).toString('hex'), r.id);
    }
  } catch {}

  // one-time: default name display to "full (nickname)" for schools that never chose explicitly
  try {
    const done = get("SELECT value FROM app_meta WHERE key = 'name_display_both_default'");
    if (!done) {
      run("UPDATE schools SET name_display = 'both' WHERE name_display = 'full' OR name_display IS NULL");
      run("INSERT INTO app_meta (key, value) VALUES ('name_display_both_default', '1')");
    }
  } catch {}
}

// Derive loyalty tier from points (matches prototype concept: bronze/silver/gold)
export function tierOf(points) {
  if (points >= 1500) return 'gold';
  if (points >= 500) return 'silver';
  return 'bronze';
}
