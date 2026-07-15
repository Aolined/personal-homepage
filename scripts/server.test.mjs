import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createHomepageServer, resolveServerOptions } from './server.mjs';
import { createFixedWindowRateLimiter } from './server-policy.mjs';

async function startTestServer(options = {}) {
  const server = createHomepageServer(options);
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const { port } = server.address();
  return {
    server,
    request: (path, init) => fetch(`http://127.0.0.1:${port}${path}`, init),
  };
}

test('uses PORT and listens on all interfaces by default', () => {
  assert.deepEqual(resolveServerOptions({ argv: ['node', 'server.mjs'], env: { PORT: '4321' } }), {
    host: '0.0.0.0',
    port: 4321,
    trustProxy: false,
  });
  assert.equal(resolveServerOptions({ argv: ['node', 'server.mjs', '--port', '4444'], env: { PORT: '4321' } }).port, 4444);
  assert.throws(() => resolveServerOptions({ argv: ['node', 'server.mjs'], env: { PORT: 'invalid' } }), /Invalid port/);
});

test('health check is lightweight and does not call the AI service', async (t) => {
  let hotSearchCalls = 0;
  const { server, request } = await startTestServer({
    hotSearch: { getHotSearch: async () => { hotSearchCalls += 1; return {}; } },
  });
  t.after(() => server.close());

  const response = await request('/healthz');

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { status: 'ok', service: 'aolined-personal-scenes' });
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.equal(hotSearchCalls, 0);
});

test('rate limits forced refreshes per forwarded client without blocking cached reads', async (t) => {
  let hotSearchCalls = 0;
  const forcedValues = [];
  const rateLimiter = createFixedWindowRateLimiter({ limit: 2, windowMs: 60_000, now: () => 1_000 });
  const { server, request } = await startTestServer({
    trustProxy: true,
    rateLimiter,
    hotSearch: {
      getHotSearch: async ({ force = false } = {}) => {
        hotSearchCalls += 1;
        forcedValues.push(force);
        return { data: [], status: 'unavailable', updatedAt: null };
      },
    },
  });
  t.after(() => server.close());
  const headers = { 'X-Forwarded-For': '203.0.113.9' };

  const first = await request('/api/hot-search?refresh=1', { headers });
  const second = await request('/api/hot-search?refresh=1', { headers });
  const limited = await request('/api/hot-search?refresh=1', { headers });
  const cached = await request('/api/hot-search', { headers });

  assert.equal(first.status, 200);
  assert.equal(first.headers.get('ratelimit-reset'), '60');
  assert.equal(second.status, 200);
  assert.equal(limited.status, 429);
  assert.equal(limited.headers.get('retry-after'), '60');
  assert.deepEqual(await limited.json(), {
    error: { code: 'RATE_LIMITED', message: 'Too many manual refresh requests' },
  });
  assert.equal(cached.status, 200);
  assert.equal(hotSearchCalls, 3);
  assert.deepEqual(forcedValues, [true, true, false]);
});

test('bounds client tracking and shares an overflow bucket under address floods', () => {
  const rateLimiter = createFixedWindowRateLimiter({ limit: 1, windowMs: 60_000, maxEntries: 2, now: () => 1_000 });

  assert.equal(rateLimiter.consume('client-a').allowed, true);
  assert.equal(rateLimiter.consume('client-b').allowed, true);
  assert.equal(rateLimiter.consume('client-c').allowed, true);
  assert.equal(rateLimiter.consume('client-d').allowed, false);
});
