const WEB_AUDIO_HOSTS = [
  'music.126.net',
  'music.163.com',
  'qqmusic.qq.com',
  'music.tc.qq.com',
];

const WEB_COVER_HOSTS = [
  ...WEB_AUDIO_HOSTS,
  'qpic.cn',
  'qlogo.cn',
  'gtimg.cn',
];

function hostMatches(hostname, allowed) {
  const host = String(hostname || '').toLowerCase().replace(/\.$/, '');
  return allowed.some((suffix) => host === suffix || host.endsWith(`.${suffix}`));
}

function isAllowedWebProxyUrl(value, kind) {
  try {
    const url = new URL(String(value || ''));
    if (!/^https?:$/.test(url.protocol) || url.username || url.password) return false;
    if (url.port && url.port !== '80' && url.port !== '443') return false;
    return hostMatches(url.hostname, kind === 'cover' ? WEB_COVER_HOSTS : WEB_AUDIO_HOSTS);
  } catch (_) {
    return false;
  }
}

function responseSecurityHeaders(webRuntime) {
  if (!webRuntime) return { 'Access-Control-Allow-Origin': '*' };
  return {
    'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com data:; img-src 'self' data: blob: https:; media-src 'self' blob: https:; connect-src 'self' https: wss:; worker-src 'self' blob:; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'",
    'Cross-Origin-Opener-Policy': 'same-origin',
    'Permissions-Policy': 'camera=(self), geolocation=(self), microphone=()',
    'Referrer-Policy': 'no-referrer',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
  };
}

function runtimeMetadata(webRuntime, publicGuest = false) {
  return {
    mode: webRuntime ? 'web' : 'desktop',
    publicGuest: !!publicGuest,
    capabilities: {
      desktopLyrics: !webRuntime,
      wallpaper: !webRuntime,
      globalHotkeys: !webRuntime,
      nativeFileDialogs: !webRuntime,
      windowControls: !webRuntime,
    },
  };
}

module.exports = {
  isAllowedWebProxyUrl,
  responseSecurityHeaders,
  runtimeMetadata,
};
