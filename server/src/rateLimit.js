// Tiny in-memory fixed-window rate limiter — no new dependency needed for the
// volume the chat feature expects. NOT shared across multiple server instances;
// fine for a single Railway dyno. Resets on deploy/restart (acceptable here).
const buckets = new Map(); // key -> { count, resetAt }

// Returns a middleware that limits `key(req)` to `max` requests per `windowMs`.
export function rateLimit({ windowMs, max, key }) {
  return (req, res, next) => {
    const id = key(req);
    const now = Date.now();
    let bucket = buckets.get(id);
    if (!bucket || bucket.resetAt <= now) {
      bucket = { count: 0, resetAt: now + windowMs };
      buckets.set(id, bucket);
    }
    bucket.count += 1;
    if (bucket.count > max) {
      const retrySec = Math.ceil((bucket.resetAt - now) / 1000);
      res.set('Retry-After', String(retrySec));
      return res.status(429).json({ error: 'ส่งข้อความถี่เกินไป กรุณารอสักครู่' });
    }
    next();
  };
}

// Periodic sweep so the map doesn't grow forever (chat traffic is low-volume).
setInterval(() => {
  const now = Date.now();
  for (const [id, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(id);
  }
}, 10 * 60 * 1000).unref?.();
