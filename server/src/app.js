import express from 'express';
import cors from 'cors';
import { requireAuth, requireRole } from './auth.js';

import authRoutes from './routes/auth.js';
import students from './routes/students.js';
import teachers from './routes/teachers.js';
import packages from './routes/packages.js';
import schedule from './routes/schedule.js';
import attendance from './routes/attendance.js';
import finance from './routes/finance.js';
import homework from './routes/homework.js';
import points from './routes/points.js';
import referrals from './routes/referrals.js';
import dashboard from './routes/dashboard.js';
import notify from './routes/notify.js';
import leads from './routes/leads.js';
import schools from './routes/schools.js';
import line from './routes/line.js';
import publicRoutes from './routes/public.js';
import users from './routes/users.js';
import assessments from './routes/assessments.js';
import staffEvaluations from './routes/staffEvaluations.js';
import enrollments from './routes/enrollments.js';
import stripeRoutes from './routes/stripe.js';
import adminRoutes from './routes/admin.js';

const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim())
  : true; // dev: allow all

export function createApp() {
  const app = express();
  app.use(cors({ origin: allowedOrigins, credentials: true }));
  // capture raw body so the LINE webhook can verify its HMAC signature
  app.use(express.json({ verify: (req, _res, buf) => { req.rawBody = buf; } }));

  app.get('/api/health', (req, res) => res.json({ ok: true, service: 'skooldee-api' }));

  // public routes (no auth required)
  app.use('/api/auth', authRoutes);
  // leads: POST is public (form submission), GET requires auth (handled inside the router)
  app.use('/api/leads', leads);
  // LINE webhook is public — LINE calls it; the school is identified by the URL param
  app.use('/api/line', line);
  // parent portal is public, read-only, scoped by a per-student random token
  app.use('/api/public', publicRoutes);
  // Stripe: webhook is public; create-checkout and portal use requireAuth inline
  app.use('/api/stripe', stripeRoutes);

  // everything below requires a valid JWT and is automatically scoped to the
  // authenticated user's school (req.schoolId) — the multi-tenant boundary.
  app.use('/api', requireAuth);
  app.use('/api/students', students);
  app.use('/api/teachers', teachers);
  app.use('/api/packages', packages);
  app.use('/api/schedule', schedule);
  app.use('/api/attendance', attendance);
  // finance is restricted — teachers must not see money
  app.use('/api/finance', requireRole('owner', 'admin', 'finance'), finance);
  app.use('/api/users', users);
  app.use('/api/homework', homework);
  app.use('/api/points', points);
  app.use('/api/assessments', assessments);
  app.use('/api/staff-evaluations', staffEvaluations);
  app.use('/api/referrals', referrals);
  app.use('/api/dashboard', dashboard);
  app.use('/api/notify', notify);
  app.use('/api/schools', schools);
  app.use('/api/enrollments', enrollments);
  app.use('/api/admin', adminRoutes);

  app.use((req, res) => res.status(404).json({ error: 'not found' }));
  return app;
}
