// Cloudflare Pages Function: GET /api/music-status
// Returns the "public deployment" shape (same as scripts/music-status.mjs with
// ECHO_MUSIC_PUBLIC_URL set), so the homepage never depends on the overseas
// Render instance for availability data. Version is kept in sync by hand.
// TODO: bump ECHO_MUSIC_VERSION here when Echo Music ships a new release.

const ECHO_MUSIC_BASE = 'https://echo.aolined.icu';
// Windows 安装包（110MB）超出 Pages 单文件 25MB 上限，下载暂留 OnRender 兜底
const ECHO_MUSIC_DOWNLOAD_BASE = 'https://aolined-echo-music.onrender.com';
const ECHO_MUSIC_VERSION = '1.1.1';

const SECURITY_HEADERS = {
  'Content-Security-Policy': "default-src 'self'; img-src 'self' https://images.unsplash.com data:; style-src 'self'; script-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'",
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  'Referrer-Policy': 'no-referrer',
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
};

export async function onRequestGet() {
  const body = {
    available: true,
    deployment: 'public',
    productName: 'Echo Music',
    version: ECHO_MUSIC_VERSION,
    landingUrl: new URL('/', ECHO_MUSIC_BASE).href,
    appUrl: new URL('/app/', ECHO_MUSIC_BASE).href,
    downloadUrl: new URL('/download/windows', ECHO_MUSIC_DOWNLOAD_BASE).href,
  };

  return new Response(JSON.stringify(body), {
    status: 200,
    headers: {
      ...SECURITY_HEADERS,
      'Cache-Control': 'public, max-age=60',
      'Content-Type': 'application/json; charset=utf-8',
    },
  });
}
