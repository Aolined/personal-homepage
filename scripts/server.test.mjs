import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
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

test('exposes Echo Music availability without leaking unavailable links', async (t) => {
  let calls = 0;
  const { server, request } = await startTestServer({
    musicStatus: {
      getStatus: async () => {
        calls += 1;
        return { available: false, productName: 'Echo Music', version: null, landingUrl: null, appUrl: null, downloadUrl: null };
      },
    },
  });
  t.after(() => server.close());

  const response = await request('/api/music-status');

  assert.equal(response.status, 200);
  assert.equal(calls, 1);
  assert.deepEqual(await response.json(), {
    available: false,
    productName: 'Echo Music',
    version: null,
    landingUrl: null,
    appUrl: null,
    downloadUrl: null,
  });
});

test('serves MP3 assets with a browser-playable content type', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'homepage-audio-'));
  await writeFile(join(root, 'soundtrack.mp3'), Buffer.from('ID3'));
  const { server, request } = await startTestServer({ root });
  t.after(async () => {
    server.close();
    await rm(root, { recursive: true, force: true });
  });

  const response = await request('/soundtrack.mp3');

  assert.equal(response.status, 200);
  assert.equal(response.headers.get('content-type'), 'audio/mpeg');
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

test('routes each supported trend source and rejects unknown sources', async (t) => {
  const calls = [];
  const service = (source) => ({
    getHotSearch: async ({ force }) => {
      calls.push({ source, force });
      return { data: [], source, status: 'live', updatedAt: '2026-07-16T00:00:00.000Z' };
    },
  });
  const { server, request } = await startTestServer({
    trendServices: { ai: service('hn-ai'), github: service('github'), weibo: service('weibo') },
  });
  t.after(() => server.close());

  const ai = await request('/api/hot-search');
  const github = await request('/api/hot-search?source=github');
  const weibo = await request('/api/hot-search?source=weibo');
  const invalid = await request('/api/hot-search?source=other');
  const prototypeName = await request('/api/hot-search?source=toString');

  assert.equal((await ai.json()).source, 'hn-ai');
  assert.equal((await github.json()).source, 'github');
  assert.equal((await weibo.json()).source, 'weibo');
  assert.equal(invalid.status, 400);
  assert.equal(prototypeName.status, 400);
  assert.deepEqual(await invalid.json(), { error: { code: 'INVALID_SOURCE', message: 'Unsupported trend source' } });
  assert.deepEqual(calls, [
    { source: 'hn-ai', force: false },
    { source: 'github', force: false },
    { source: 'weibo', force: false },
  ]);
});

test('bounds client tracking and shares an overflow bucket under address floods', () => {
  const rateLimiter = createFixedWindowRateLimiter({ limit: 1, windowMs: 60_000, maxEntries: 2, now: () => 1_000 });

  assert.equal(rateLimiter.consume('client-a').allowed, true);
  assert.equal(rateLimiter.consume('client-b').allowed, true);
  assert.equal(rateLimiter.consume('client-c').allowed, true);
  assert.equal(rateLimiter.consume('client-d').allowed, false);
});
