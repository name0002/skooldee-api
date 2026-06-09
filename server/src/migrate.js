// Apply the schema. Use `--fresh` to wipe the database file first.
import 'dotenv/config';
import { existsSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const dbPath = process.env.DB_PATH || join(__dirname, '..', 'data.sqlite');

if (process.argv.includes('--fresh')) {
  for (const f of [dbPath, `${dbPath}-wal`, `${dbPath}-shm`]) if (existsSync(f)) rmSync(f);
  console.log('Dropped existing database.');
}

const { initSchema } = await import('./db.js');
initSchema();
console.log('Schema applied at', dbPath);
