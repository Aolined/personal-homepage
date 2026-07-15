import { isIP } from 'node:net';

export function createFixedWindowRateLimiter({ limit = 5, windowMs = 60_000, maxEntries = 10_000, now = Date.now } = {}) {
  if (!Number.isInteger(limit) || limit < 1) throw new Error('Rate limit must be a positive integer');
  if (!Number.isInteger(windowMs) || windowMs < 1) throw new Error('Rate limit window must be a positive integer');
  if (!Number.isInteger(maxEntries) || maxEntries < 2) throw new Error('Rate limit entry cap must be at least two');

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

      let key = rawKey;
      if (!entries.has(key) && entries.size >= maxEntries) {
        key = '__overflow__';
        if (!entries.has(key)) entries.delete(entries.keys().next().value);
      }

      let entry = entries.get(key);
      if (!entry || entry.resetAt <= currentTime) {
        entry = { count: 0, resetAt: currentTime + windowMs };
        entries.set(key, entry);
      }

      const allowed = entry.count < limit;
      if (allowed) entry.count += 1;
      return {
        allowed,
        limit,
        remaining: Math.max(0, limit - entry.count),
        resetAt: entry.resetAt,
        retryAfterSeconds: Math.max(1, Math.ceil((entry.resetAt - currentTime) / 1000)),
      };
    },
  };
}

export function getClientAddress(request, { trustProxy = false } = {}) {
  if (trustProxy) {
    const forwarded = request.headers['x-forwarded-for'];
    const value = Array.isArray(forwarded) ? forwarded[0] : forwarded;
    const firstAddress = value?.split(',')[0].trim();
    if (firstAddress && isIP(firstAddress)) return firstAddress;
  }

  return request.socket.remoteAddress || 'unknown';
}
