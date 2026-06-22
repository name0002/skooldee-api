# Deploy

## Frontend — Cloudflare Pages (project: `skooldee`, direct-upload)

⚠️ **NEVER run `wrangler pages deploy .`** — that uploads the whole repo root,
which publicly exposed `/server/src/*` (the API source). Always deploy the
**built** `dist/` directory, which contains only public frontend files.

```bash
# from repo root
node scripts/build-pages.mjs        # assembles ./dist (allow-list only)
npx wrangler pages deploy dist --project-name skooldee --branch=master
```

`scripts/build-pages.mjs` copies only: every root `*.html`, `assets/`,
`functions/`, `screenshots/`, `_headers`, `_redirects`, `favicon.svg`,
`robots.txt`, `sitemap.xml`. Anything else (incl. `server/`, `scripts/`, fonts,
`*.pdf`, `*.zip`, `*.py`) is **excluded by default**. Add new public assets to the
allow-list in that script.

`_redirects` also hard-blocks `/server/*` and `/scripts/*` → `404.html` (404) as
defence-in-depth.

> This is a **direct-upload** Pages project (Git provider: No), so there is **no
> "Root directory / Build settings" in the dashboard** to change — exclusion is
> controlled entirely by which directory you pass to `wrangler pages deploy`.

### Purging the CDN cache (after a security-sensitive change)

A new deployment does **not** purge already-cached responses on the custom
domain (`skooldee.com`). To clear stale cache immediately:

Cloudflare dashboard → **skooldee.com** zone → **Caching** → **Configuration** →
**Purge Everything** (or *Custom Purge* → by URL for specific paths).
Otherwise cached entries expire on their own within ~4 hours (`max-age=14400`).

## Backend — Railway (project: `skooldee-api`)

```bash
cd server
railway up --detach
```
