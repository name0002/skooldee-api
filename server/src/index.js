import 'dotenv/config';
import { initSchema } from './db.js';
import { createApp } from './app.js';
import { startScheduler } from './scheduler.js';

initSchema(); // ensure tables exist on boot

const PORT = process.env.PORT || 4000;
createApp().listen(PORT, () => {
  console.log(`skooldee API listening on http://localhost:${PORT}`);
  startScheduler(); // daily LINE notifications (teacher schedule, birthdays, monthly pay)
});
