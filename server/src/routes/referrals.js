import { Router } from 'express';
import { all, get, run } from '../db.js';
import { wrap, required, bad } from '../util.js';

const r = Router();
const REFERRER_REWARD = 200; // matches prototype
const FRIEND_REWARD = 100;

// GET /api/referrals
r.get('/', wrap((req, res) => {
  res.json(all(
    `SELECT rf.*, s.name AS referrer_name, s.referral_code FROM referrals rf
       JOIN students s ON s.id = rf.referrer_student_id
      WHERE rf.school_id = ? ORDER BY rf.created_at DESC`, req.schoolId));
}));

// POST /api/referrals — record an invite from a student
r.post('/', wrap((req, res) => {
  const b = required(req.body, ['referrer_student_id', 'friend_name']);
  if (!get('SELECT id FROM students WHERE id = ? AND school_id = ?', b.referrer_student_id, req.schoolId))
    throw bad('referrer not found', 404);
  const result = run(
    'INSERT INTO referrals (school_id, referrer_student_id, friend_name, friend_phone, status) VALUES (?,?,?,?,?)',
    req.schoolId, b.referrer_student_id, b.friend_name, b.friend_phone || null, 'invited');
  res.status(201).json(get('SELECT * FROM referrals WHERE id = ?', Number(result.lastInsertRowid)));
}));

// PATCH /api/referrals/:id — advance status. On 'subscribed', award points to referrer.
r.patch('/:id', wrap((req, res) => {
  const ref = get('SELECT * FROM referrals WHERE id = ? AND school_id = ?', req.params.id, req.schoolId);
  if (!ref) throw bad('referral not found', 404);
  const status = req.body.status;
  if (!['invited', 'trial', 'subscribed'].includes(status)) throw bad('invalid status');

  if (status === 'subscribed' && ref.status !== 'subscribed') {
    run('UPDATE referrals SET status = ?, referrer_reward = ?, friend_reward = ? WHERE id = ?',
      status, REFERRER_REWARD, FRIEND_REWARD, ref.id);
    run('UPDATE students SET points = points + ? WHERE id = ?', REFERRER_REWARD, ref.referrer_student_id);
    run('INSERT INTO points_ledger (school_id, student_id, delta, reason) VALUES (?,?,?,?)',
      req.schoolId, ref.referrer_student_id, REFERRER_REWARD, `แนะนำเพื่อน: ${ref.friend_name}`);
  } else {
    run('UPDATE referrals SET status = ? WHERE id = ?', status, ref.id);
  }
  res.json(get('SELECT * FROM referrals WHERE id = ?', ref.id));
}));

export default r;
