const CACHE_PREFIX = 'format-workshop-';
const CACHE_NAME = `${CACHE_PREFIX}0.2.0`;
const SCOPE_URL = new URL('./', self.registration.scope).href;
const APP_SHELL = [
  SCOPE_URL,
  new URL('manifest.webmanifest', self.registration.scope).href,
  new URL('app-icon.svg', self.registration.scope).href,
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys
          .filter((key) => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME)
          .map((key) => caches.delete(key)),
      ))
      .then(() => self.clients.claim()),
  );
});

async function cacheResponse(request, response) {
  if (!response.ok || response.type === 'opaque') return response;
  const cache = await caches.open(CACHE_NAME);
  await cache.put(request, response.clone());
  return response;
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => cacheResponse(request, response))
        .catch(() => caches.match(request).then((cached) => cached || caches.match(SCOPE_URL))),
    );
    return;
  }

  const cacheFirst = url.pathname.includes('/ffmpeg/')
    || ['script', 'style', 'worker', 'font'].includes(request.destination);
  if (cacheFirst) {
    event.respondWith(
      caches.match(request).then((cached) => cached || fetch(request)
        .then((response) => cacheResponse(request, response))),
    );
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => {
      const fresh = fetch(request).then((response) => cacheResponse(request, response));
      return cached || fresh;
    }),
  );
});
