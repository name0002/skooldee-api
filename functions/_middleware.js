/* Cloudflare Pages middleware — runs on every request.
 * Canonical host: redirect www.skooldee.com → skooldee.com (preserves path + query).
 * Pages `_redirects` cannot match on hostname, so this is done here instead.
 * All other requests fall through to static-asset serving via next().
 */
export async function onRequest(context) {
  const { request, next } = context;
  const url = new URL(request.url);

  if (url.hostname === 'www.skooldee.com') {
    url.hostname = 'skooldee.com';
    return Response.redirect(url.toString(), 301);
  }

  return next();
}
