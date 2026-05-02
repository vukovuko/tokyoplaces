const CACHE_VERSION = 'v1';
const SHELL_CACHE = 'shell-' + CACHE_VERSION;
const TILE_CACHE  = 'tiles-' + CACHE_VERSION;
const SHELL_URLS = [
  './', './index.html', './manifest.json',
  './android-chrome-192x192.png', './android-chrome-512x512.png',
  './apple-touch-icon.png',
  './favicon.ico', './favicon-16x16.png', './favicon-32x32.png',
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(SHELL_CACHE).then(c => c.addAll(SHELL_URLS).catch(() => {})));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.filter(k => ![SHELL_CACHE, TILE_CACHE].includes(k))
          .map(k => caches.delete(k))
    ))
  );
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // Map tiles: cache-first, opaque-OK. These persist forever once seen.
  const isTile = (
    url.host.endsWith('tile.openstreetmap.org') ||
    url.host.endsWith('basemaps.cartocdn.com') ||
    url.host.endsWith('api.maptiler.com') ||
    url.host.endsWith('arcgisonline.com')
  );
  if (isTile) {
    e.respondWith(
      caches.open(TILE_CACHE).then(cache =>
        cache.match(req).then(hit => hit || fetch(req).then(resp => {
          // cache successful + opaque (cross-origin no-cors) responses
          if (resp && (resp.ok || resp.type === 'opaque')) cache.put(req, resp.clone());
          return resp;
        }).catch(() => hit))
      )
    );
    return;
  }

  // App shell (HTML, manifest, icons): network-first so updates land,
  // but fall back to cache when offline.
  if (url.origin === location.origin) {
    e.respondWith(
      fetch(req).then(resp => {
        if (resp && resp.ok) {
          const clone = resp.clone();
          caches.open(SHELL_CACHE).then(c => c.put(req, clone));
        }
        return resp;
      }).catch(() => caches.match(req).then(hit => hit || caches.match('./index.html')))
    );
  }
});
