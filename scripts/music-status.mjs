import { get as httpGet } from 'node:http';
import { get as httpsGet } from 'node:https';

function normalizeBaseUrl(value) {
  const url = new URL(value);
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error('Echo Music URL must use HTTP or HTTPS');
  url.pathname = '/';
  url.search = '';
  url.hash = '';
  return url;
}

function requestJson(rawUrl) {
  const get = rawUrl.startsWith('https:') ? httpsGet : httpGet;
  return new Promise((resolve, reject) => {
    const request = get(rawUrl, { headers: { Accept: 'application/json', 'User-Agent': 'AolinedHomepage/1.0' } }, (response) => {
      let body = '';
      response.setEncoding('utf8');
      response.on('data', (chunk) => {
        body += chunk;
        if (body.length > 64 * 1024) request.destroy(new Error('Echo Music response is too large'));
      });
      response.on('end', () => resolve({
        ok: response.statusCode >= 200 && response.statusCode < 300,
        status: response.statusCode,
        json: async () => JSON.parse(body),
      }));
    });
    request.setTimeout(1500, () => request.destroy(new Error('Echo Music request timed out')));
    request.on('error', reject);
  });
}

export function createMusicStatusService({
  baseUrl = process.env.ECHO_MUSIC_URL || 'http://127.0.0.1:4175',
  fetchImpl = requestJson,
  onError = () => {},
} = {}) {
  const base = normalizeBaseUrl(baseUrl);

  return {
    async getStatus() {
      try {
        const response = await fetchImpl(new URL('/api/app/version', base).href);
        if (!response.ok) throw new Error(`Echo Music returned ${response.status}`);
        const payload = await response.json();
        const version = typeof payload?.version === 'string' ? payload.version.slice(0, 24) : null;
        return {
          available: true,
          productName: 'Echo Music',
          version,
          landingUrl: base.href,
          appUrl: new URL('/app', base).href,
          downloadUrl: new URL('/download/windows', base).href,
        };
      } catch (error) {
        onError(error);
        return {
          available: false,
          productName: 'Echo Music',
          version: null,
          landingUrl: null,
          appUrl: null,
          downloadUrl: null,
        };
      }
    },
  };
}
