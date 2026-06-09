// Database layer — uses Node's built-in node:sqlite (no native build required).
// Swap to PostgreSQL later by replacing this module with a pg-backed implementation
// that exposes the same query helpers (db.run / db.get / db.all).
import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

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

CREATE INDEX IF NOT EXISTS idx_students_school ON students(school_id);
CREATE INDEX IF NOT EXISTS idx_attendance_school_date ON attendance(school_id, date);
CREATE INDEX IF NOT EXISTS idx_slots_school_day ON schedule_slots(school_id, day_of_week);
`;

export function initSchema() {
  db.exec(SCHEMA);
}

// Derive loyalty tier from points (matches prototype concept: bronze/silver/gold)
export function tierOf(points) {
  if (points >= 1500) return 'gold';
  if (points >= 500) return 'silver';
  return 'bronze';
}
