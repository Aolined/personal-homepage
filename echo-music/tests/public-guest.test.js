const assert = require('node:assert/strict');
const test = require('node:test');

const {
  createFixedWindowRateLimiter,
  getClientAddress,
  isPublicGuestMode,
  publicGuestRouteResponse,
} = require('../scripts/public-guest');

test('enables public guest mode only for an explicit Web deployment', () => {
  assert.equal(isPublicGuestMode(true, { PUBLIC_GUEST_MODE: 'true' }), true);
  assert.equal(isPublicGuestMode(true, { PUBLIC_GUEST_MODE: '1' }), true);
  assert.equal(isPublicGuestMode(false, { PUBLIC_GUEST_MODE: 'true' }), false);
  assert.equal(isPublicGuestMode(true, {}), false);
});

test('blocks account, mutation, update and cache routes in public guest mode', () => {
  const blocked = [
    '/api/login/cookie',
    '/api/login/qr/key',
    '/api/qq/login/cookie',
    '/api/song/like',
    '/api/playlist/create',
    '/api/update/download',
    '/api/update/patch',
    '/api/beatmap/cache',
    '/api/import/qishui',
  ];

  blocked.forEach((pathname) => {
    assert.equal(publicGuestRouteResponse(pathname).status, 403, pathname);
  });
  assert.equal(publicGuestRouteResponse('/api/search'), null);
  assert.equal(publicGuestRouteResponse('/api/audio'), null);
});

test('returns anonymous status without touching shared account state', () => {
  assert.deepEqual(publicGuestRouteResponse('/api/login/status'), {
    status: 200,
    body: { loggedIn: false, publicGuest: true },
  });
  assert.deepEqual(publicGuestRouteResponse('/api/qq/login/status'), {
    status: 200,
    body: { provider: 'qq', loggedIn: false, publicGuest: true },
  });
});

test('rate limits each trusted forwarded client independently', () => {
  const limiter = createFixedWindowRateLimiter({ limit: 2, windowMs: 60_000, now: () => 1_000 });
  const request = {
    headers: { 'x-forwarded-for': '203.0.113.10, 10.0.0.1' },
    socket: { remoteAddress: '127.0.0.1' },
  };

  assert.equal(getClientAddress(request, true), '203.0.113.10');
  assert.equal(getClientAddress(request, false), '127.0.0.1');
  assert.equal(limiter.consume('203.0.113.10').allowed, true);
  assert.equal(limiter.consume('203.0.113.10').allowed, true);
  assert.equal(limiter.consume('203.0.113.10').allowed, false);
  assert.equal(limiter.consume('203.0.113.11').allowed, true);
});
