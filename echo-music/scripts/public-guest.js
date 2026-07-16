const BLOCKED_ROUTES = new Set([
  '/api/update/download',
  '/api/update/download/status',
  '/api/update/patch',
  '/api/update/patch/status',
  '/api/beatmap/cache',
  '/api/beatmap/cache/status',
  '/api/import/qishui',
  '/api/qq/login/cookie',
  '/api/qq/logout',
  '/api/qq/user/playlists',
  '/api/qq/playlist/tracks',
  '/api/podcast/my',
  '/api/podcast/my/items',
  '/api/login/cookie',
  '/api/login/qr/key',
  '/api/login/qr/create',
  '/api/login/qr/check',
  '/api/logout',
  '/api/user/playlists',
  '/api/song/like/check',
  '/api/song/like',
  '/api/playlist/create',
  '/api/playlist/add-song',
]);

function isPublicGuestMode(webRuntime, env = process.env) {
  return !!webRuntime && /^(1|true)$/i.test(String(env.PUBLIC_GUEST_MODE || ''));
}

function publicGuestRouteResponse(pathname) {
  if (pathname === '/api/login/status') {
    return { status: 200, body: { loggedIn: false, publicGuest: true } };
  }
  if (pathname === '/api/qq/login/status') {
    return { status: 200, body: { provider: 'qq', loggedIn: false, publicGuest: true } };
  }
  if (BLOCKED_ROUTES.has(pathname)) {
    return {
      status: 403,
      body: {
        error: 'PUBLIC_GUEST_MODE',
        message: '公开访客模式不提供账号登录或资料写入',
      },
    };
  }
  return null;
}

function getClientAddress(request, trustProxy = false) {
  if (trustProxy) {
    const forwarded = String(request.headers['x-forwarded-for'] || '').split(',')[0].trim();
    if (forwarded) return forwarded.slice(0, 128);
  }
  return String(request.socket.remoteAddress || 'unknown').slice(0, 128);
}

function createFixedWindowRateLimiter({ limit = 180, windowMs = 60_000, maxEntries = 5_000, now = Date.now } = {}) {
  const clients = new Map();
  const overflowKey = '__overflow__';

  return {
    consume(clientAddress) {
      const timestamp = now();
      let key = String(clientAddress || 'unknown');
      if (!clients.has(key) && clients.size >= maxEntries) key = overflowKey;
      let entry = clients.get(key);
      if (!entry || timestamp >= entry.resetAt) {
        entry = { count: 0, resetAt: timestamp + windowMs };
        clients.set(key, entry);
      }
      entry.count += 1;
      return {
        allowed: entry.count <= limit,
        limit,
        remaining: Math.max(0, limit - entry.count),
        retryAfterSeconds: Math.max(1, Math.ceil((entry.resetAt - timestamp) / 1_000)),
      };
    },
  };
}

module.exports = {
  createFixedWindowRateLimiter,
  getClientAddress,
  isPublicGuestMode,
  publicGuestRouteResponse,
};
