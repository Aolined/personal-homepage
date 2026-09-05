// Cloudflare Pages Function: GET /api/hot-search?source=ai|github|weibo[&refresh=1]
// Mirrors scripts/server.mjs /api/hot-search routing, rate limiting, response
// shape and security headers. Adds an edge cache (Cache API, 120s) so most
// requests return instantly without touching upstream sources.

import { createHotSearchService, SOURCES } from '../lib/hot-search-lib.mjs';
import { createFixedWindowRateLimiter } from '../lib/rate-limit.mjs';

const EDGE_TTL_SECONDS = 120;

const SECURITY_HEADERS = {
  'Content-Security-Policy': "default-src 'self'; img-src 'self' https://images.unsplash.com data:; style-src 'self'; script-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'",
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  'Referrer-Policy': 'no-referrer',
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
};

const service = createHotSearchService();
const refreshLimiter = createFixedWindowRateLimiter({ limit: 5, windowMs: 60_000 });

function jsonResponse(status, body, { cacheControl = 'no-store', extra = {} } = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...SECURITY_HEADERS,
      'Cache-Control': cacheControl,
      'Content-Type': 'application/json; charset=utf-8',
      ...extra,
    },
  });
}

export async function onRequestGet(context) {
  const url = new URL(context.request.url);
  const source = url.searchParams.get('source') || 'ai';
  const force = url.searchParams.get('refresh') === '1';

  if (!SOURCES.includes(source)) {
    return jsonResponse(400, { error: { code: 'INVALID_SOURCE', message: 'Unsupported trend source' } });
  }

  if (force) {
    const clientAddress = context.request.headers.get('cf-connecting-ip') || 'unknown';
    const limitResult = refreshLimiter.consume(clientAddress);
    if (!limitResult.allowed) {
      return jsonResponse(429, {
        error: { code: 'RATE_LIMITED', message: 'Too many manual refresh requests' },
      }, {
        extra: {
          'RateLimit-Limit': String(limitResult.limit),
          'RateLimit-Remaining': String(limitResult.remaining),
          'RateLimit-Reset': String(limitResult.retryAfterSeconds),
          'Retry-After': String(limitResult.retryAfterSeconds),
        },
      });
    }
  }

  // Serve from the edge cache when possible (manual refresh bypasses it).
  if (!force) {
    try {
      const cache = caches.default;
      const cacheKey = new Request(url.href);
      const cached = await cache.match(cacheKey);
      if (cached) return cached;
    } catch {
      // Edge cache unavailable: fall through to a live fetch.
    }
  }

  const result = await service.getHotSearch(source, { force });

  const fresh = result.status === 'live';
  const response = jsonResponse(200, result, {
    cacheControl: fresh && !force ? `public, max-age=${EDGE_TTL_SECONDS}` : 'no-store',
  });

  if (fresh && !force) {
    try {
      await caches.default.put(new Request(url.href), response.clone(), { ttl: EDGE_TTL_SECONDS });
    } catch {
      // Cache write failure must not fail the request.
    }
  }

  return response;
}
