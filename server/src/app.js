import express from 'express';
import cors from 'cors';
import { requireAuth } from './auth.js';

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

const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim())
  : true; // dev: allow all

export function createApp() {
  const app = express();
  app.use(cors({ origin: allowedOrigins, credentials: true }));
  app.use(express.json());

  app.get('/api/health', (req, res) => res.json({ ok: true, service: 'skooldee-api' }));

  // public routes (no auth required)
  app.use('/api/auth', authRoutes);
  // leads: POST is public (form submission), GET requires auth (handled inside the router)
  app.use('/api/leads', leads);

  // everything below requires a valid JWT and is automatically scoped to the
  // authenticated user's school (req.schoolId) — the multi-tenant boundary.
  app.use('/api', requireAuth);
  app.use('/api/students', students);
  app.use('/api/teachers', teachers);
  app.use('/api/packages', packages);
  app.use('/api/schedule', schedule);
  app.use('/api/attendance', attendance);
  app.use('/api/finance', finance);
  app.use('/api/homework', homework);
  app.use('/api/points', points);
  app.use('/api/referrals', referrals);
  app.use('/api/dashboard', dashboard);
  app.use('/api/notify', notify);

  app.use((req, res) => res.status(404).json({ error: 'not found' }));
  return app;
}
