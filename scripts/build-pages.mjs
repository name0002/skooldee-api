#!/usr/bin/env node
/**
 * build-pages.mjs — assemble the Cloudflare Pages publish directory.
 *
 * WHY THIS EXISTS (security):
 *   `wrangler pages deploy .` uploads the ENTIRE repo root, which leaked the
 *   server source (e.g. /server/src/db.js was publicly fetchable). Cloudflare
 *   Pages serves any uploaded file verbatim and `_redirects` cannot hide a file
 *   that physically exists in the deployment — so the only real fix is to never
 *   upload non-public files in the first place.
 *
 *   This script copies an EXPLICIT ALLOW-LIST of frontend assets into `dist/`.
 *   Secure by default: if it isn't listed here, it does not ship. Adding a new
 *   public page/asset means adding it to ALLOW below.
 *
 * USAGE:
 *   node scripts/build-pages.mjs           # produces ./dist
 *   npx wrangler pages deploy dist --project-name skooldee --branch=master
 */
import { existsSync, rmSync, mkdirSync, cpSync, readdirSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'dist');

// Explicit directories that are part of the public site.
const ALLOW_DIRS = ['assets', 'functions', 'screenshots'];

// Explicit individual files (non-HTML) that must be published.
const ALLOW_FILES = ['_headers', '_redirects', 'favicon.svg', 'robots.txt', 'sitemap.xml'];

// Anything matching these is NEVER copied, even if it sits next to allowed files.
// (Defence-in-depth; the allow-list already excludes them, but this makes intent loud.)
const DENY = new Set(['server', 'node_modules', '.git', '.wrangler', '.claude', 'dist', 'scripts']);

function copyInto(name) {
  const src = join(ROOT, name);
  if (!existsSync(src)) { console.warn(`  ! skip (missing): ${name}`); return false; }
  cpSync(src, join(OUT, name), { recursive: true });
  return true;
}

// fresh output dir
if (existsSync(OUT)) rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });

let count = 0;

// 1) every top-level *.html page (auto-discovered so new pages are never forgotten)
for (const entry of readdirSync(ROOT)) {
  if (DENY.has(entry)) continue;
  if (entry.toLowerCase().endsWith('.html') && statSync(join(ROOT, entry)).isFile()) {
    if (copyInto(entry)) { count++; console.log(`  + ${entry}`); }
  }
}

// 2) allow-listed directories
for (const d of ALLOW_DIRS) if (copyInto(d)) { count++; console.log(`  + ${d}/`); }

// 3) allow-listed config/meta files
for (const f of ALLOW_FILES) if (copyInto(f)) { count++; console.log(`  + ${f}`); }

console.log(`\n✅ Built ${OUT} (${count} entries). /server is NOT included.`);
