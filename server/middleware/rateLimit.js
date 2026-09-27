// Small fixed-window rate limiter kept in memory. Enough for a single API instance; with several
// instances this would move to Redis. Keyed by client IP (Express `trust proxy` is set in app.js
// so the real IP is used behind Render's proxy).
function rateLimit({ windowMs, max, name }) {
  const hits = new Map();
  setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of hits) if (entry.resetAt <= now) hits.delete(key);
  }, windowMs).unref();

  return (req, res, next) => {
    const key = `${name}:${req.ip}`;
    const now = Date.now();
    let entry = hits.get(key);
    if (!entry || entry.resetAt <= now) {
      entry = { count: 0, resetAt: now + windowMs };
      hits.set(key, entry);
    }
    entry.count += 1;
    if (entry.count > max) {
      res.set('Retry-After', String(Math.ceil((entry.resetAt - now) / 1000)));
      return res.status(429).json({ error: 'Too many attempts. Please wait a minute and try again.', code: 'RATE_LIMITED' });
    }
    next();
  };
}

module.exports = rateLimit;
