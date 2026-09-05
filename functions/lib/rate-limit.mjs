// Port of scripts/server-policy.mjs fixed-window limiter for edge runtimes.
// No Node built-ins. Per-isolate state is a best effort; for global limits
// upgrade to a Workers KV / D1 counter (see docs/cloudflare-pages.md).

export function createFixedWindowRateLimiter({ limit = 5, windowMs = 60_000, now = Date.now } = {}) {
  if (!Number.isInteger(limit) || limit < 1) throw new Error('Rate limit must be a positive integer');
  if (!Number.isInteger(windowMs) || windowMs < 1) throw new Error('Rate limit window must be a positive integer');

  const entries = new Map();
  let nextSweepAt = 0;

  return {
    consume(rawKey) {
      const currentTime = now();
      if (currentTime >= nextSweepAt) {
        for (const [entryKey, entry] of entries) {
          if (entry.resetAt <= currentTime) entries.delete(entryKey);
        }
        nextSweepAt = currentTime + windowMs;
      }

      let entry = entries.get(rawKey);
      if (!entry || entry.resetAt <= currentTime) {
        entry = { count: 0, resetAt: currentTime + windowMs };
        entries.set(rawKey, entry);
      }

      const allowed = entry.count < limit;
      if (allowed) entry.count += 1;
      return {
        allowed,
        limit,
        remaining: Math.max(0, limit - entry.count),
        retryAfterSeconds: Math.max(1, Math.ceil((entry.resetAt - currentTime) / 1000)),
      };
    },
  };
}
