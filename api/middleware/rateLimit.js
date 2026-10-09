// Small in-memory fixed-window limiter, keyed by client IP. Used on the public
// result / certificate endpoints so a registration or mobile number cannot be
// guessed at speed. Counters live in this process only: with several app
// instances the effective limit is per instance, which is still enough to make
// enumeration impractical.

const clientKey = (req) => req.ip || req.socket?.remoteAddress || "unknown";

const createLimiter = ({ windowMs, max }) => {
  const hits = new Map();

  const sweep = setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of hits) {
      if (entry.resetAt <= now) hits.delete(key);
    }
  }, Math.max(windowMs, 60 * 1000));
  // Never keep the process alive just for housekeeping.
  if (typeof sweep.unref === "function") sweep.unref();

  const current = (key) => {
    const entry = hits.get(key);
    if (!entry || entry.resetAt <= Date.now()) return null;
    return entry;
  };

  return {
    // Count one event against `req`'s client.
    hit(req) {
      const key = clientKey(req);
      const entry = current(key);
      if (entry) entry.count += 1;
      else hits.set(key, { count: 1, resetAt: Date.now() + windowMs });
    },
    // True once the client has used up its budget in the current window.
    isBlocked(req) {
      const entry = current(clientKey(req));
      return !!entry && entry.count >= max;
    },
    retryAfterSeconds(req) {
      const entry = current(clientKey(req));
      return entry ? Math.max(1, Math.ceil((entry.resetAt - Date.now()) / 1000)) : 1;
    },
  };
};

// Express middleware form: every request counts, over-budget requests get 429.
const rateLimit = ({ windowMs, max, message }) => {
  const limiter = createLimiter({ windowMs, max });
  return (req, res, next) => {
    if (limiter.isBlocked(req)) {
      res.set("Retry-After", String(limiter.retryAfterSeconds(req)));
      const text = message || "Too many requests. Please try again in a few minutes.";
      return res.status(429).json({ success: false, code: "TOO_MANY_REQUESTS", message: text, customMessage: text });
    }
    limiter.hit(req);
    next();
  };
};

module.exports = { createLimiter, rateLimit };
