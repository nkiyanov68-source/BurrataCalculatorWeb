const CACHE_NAME = 'burrata-calculator-web-v1-13-39';
const CACHE_PREFIX = 'burrata-calculator-web-';
const ASSETS = [
  './index.html',
  './styles.css?v=11339',
  './app.js?v=11339',
  './manifest.webmanifest?v=11339',
  './icons/icon-72.png',
  './icons/icon-96.png',
  './icons/icon-128.png',
  './icons/icon-144.png',
  './icons/icon-152.png',
  './icons/icon-180.png',
  './icons/icon-192.png',
  './icons/icon-384.png',
  './icons/icon-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(
      keys
        .filter((key) => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME)
        .map((key) => caches.delete(key))
    );

    await self.clients.claim();

    // Force already-open old versions to reload once the new worker takes control.
    const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    await Promise.all(clients.map((client) => {
      if (!client.url || !client.url.startsWith(self.location.origin)) return Promise.resolve();
      return client.navigate(client.url).catch(() => undefined);
    }));
  })());
});

async function networkFirst(request, fallback) {
  const cache = await caches.open(CACHE_NAME);
  try {
    const response = await fetch(request, { cache: 'no-store' });
    if (response && response.ok) {
      await cache.put(request, response.clone());
    }
    return response;
  } catch (_) {
    return (await cache.match(request)) || (fallback ? await cache.match(fallback) : undefined) || Response.error();
  }
}

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE_NAME);
      try {
        const response = await fetch(request, { cache: 'no-store' });
        if (response && response.ok) {
          await cache.put('./index.html', response.clone());
        }
        return response;
      } catch (_) {
        return (await cache.match('./index.html')) || Response.error();
      }
    })());
    return;
  }

  const isFreshCore = /\.(?:js|css|html)$/.test(url.pathname) || url.pathname.endsWith('/manifest.webmanifest');
  if (isFreshCore) {
    event.respondWith(networkFirst(request));
    return;
  }

  event.respondWith((async () => {
    const cached = await caches.match(request);
    if (cached) return cached;
    const response = await fetch(request);
    if (response && response.ok) {
      const cache = await caches.open(CACHE_NAME);
      await cache.put(request, response.clone());
    }
    return response;
  })());
});
