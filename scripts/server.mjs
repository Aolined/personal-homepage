import { createReadStream, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createAiHotService } from './ai-hot.mjs';
import { resolveStaticPath } from './server-path.mjs';
import { createFixedWindowRateLimiter, getClientAddress } from './server-policy.mjs';

const defaultRoot = fileURLToPath(new URL('..', import.meta.url));

const contentTypes = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
};

const securityHeaders = {
  'Content-Security-Policy': "default-src 'self'; img-src 'self' https://images.unsplash.com data:; style-src 'self'; script-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'",
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  'Referrer-Policy': 'no-referrer',
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
};

function parsePort(value) {
  const port = Number(value);
  if (!Number.isInteger(port) || port < 1 || port > 65_535) throw new Error(`Invalid port: ${value}`);
  return port;
}

export function resolveServerOptions({ argv = process.argv, env = process.env } = {}) {
  const portFlag = argv.indexOf('--port');
  const rawPort = portFlag >= 0 ? argv[portFlag + 1] : env.PORT || '4173';
  return {
    host: env.HOST || '0.0.0.0',
    port: parsePort(rawPort),
    trustProxy: /^(1|true)$/i.test(env.TRUST_PROXY || ''),
  };
}

function writeJson(response, status, body, headers = {}) {
  response.writeHead(status, {
    ...securityHeaders,
    'Cache-Control': 'no-store',
    'Content-Type': 'application/json; charset=utf-8',
    ...headers,
  });
  response.end(JSON.stringify(body));
}

function getRateLimitHeaders(result) {
  return {
    'RateLimit-Limit': String(result.limit),
    'RateLimit-Remaining': String(result.remaining),
    'RateLimit-Reset': String(result.retryAfterSeconds),
  };
}

export function createHomepageServer({
  root = defaultRoot,
  hotSearch = createAiHotService(),
  rateLimiter = createFixedWindowRateLimiter(),
  trustProxy = false,
} = {}) {
  return createServer(async (request, response) => {
    let requestUrl;
    let requestedPath;
    try {
      requestUrl = new URL(request.url, 'http://localhost');
      requestedPath = decodeURIComponent(requestUrl.pathname);
    } catch {
      writeJson(response, 400, { error: { code: 'BAD_REQUEST', message: 'Invalid request URL' } });
      return;
    }

    if (request.method !== 'GET') {
      writeJson(response, 405, { error: { code: 'METHOD_NOT_ALLOWED', message: 'Only GET is supported' } }, { Allow: 'GET' });
      return;
    }

    if (requestedPath === '/healthz') {
      writeJson(response, 200, { status: 'ok', service: 'aolined-personal-scenes' });
      return;
    }

    if (requestedPath === '/api/hot-search') {
      const force = requestUrl.searchParams.get('refresh') === '1';
      let rateLimitHeaders = {};
      if (force) {
        const clientAddress = getClientAddress(request, { trustProxy });
        const limitResult = rateLimiter.consume(clientAddress);
        rateLimitHeaders = getRateLimitHeaders(limitResult);
        if (!limitResult.allowed) {
          writeJson(response, 429, {
            error: { code: 'RATE_LIMITED', message: 'Too many manual refresh requests' },
          }, { ...rateLimitHeaders, 'Retry-After': String(limitResult.retryAfterSeconds) });
          return;
        }
      }

      const result = await hotSearch.getHotSearch({ force });
      writeJson(response, 200, result, rateLimitHeaders);
      return;
    }

    const filePath = resolveStaticPath(root, requestedPath);
    if (!filePath) {
      response.writeHead(403, securityHeaders).end('Forbidden');
      return;
    }

    try {
      if (!statSync(filePath).isFile()) throw new Error('Not a file');
      response.writeHead(200, {
        ...securityHeaders,
        'Cache-Control': 'no-store',
        'Content-Type': contentTypes[extname(filePath)] || 'application/octet-stream',
      });
      createReadStream(filePath).pipe(response);
    } catch {
      response.writeHead(404, { ...securityHeaders, 'Content-Type': 'text/plain; charset=utf-8' }).end('Not found');
    }
  });
}

export function startHomepageServer(options = resolveServerOptions()) {
  const server = createHomepageServer({ trustProxy: options.trustProxy });
  server.listen(options.port, options.host, () => {
    console.log(`Personal homepage running at http://${options.host}:${options.port}`);
  });
  return server;
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) startHomepageServer();
