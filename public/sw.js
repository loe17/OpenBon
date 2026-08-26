// OpenBon PWA Service Worker v1.2.0 - Offline-First Support
const CACHE_NAME = 'openbon-cache-v3';

// App-Shell aller Stationen, die im Festbetrieb offline weiterlaufen muessen.
const PRECACHE_ASSETS = [
  '/',
  '/pos',
  '/waiter',
  '/waiter/order',
  '/kitchen',
  '/chat',
  '/manifest.json',
  '/icon.png',
];

// Statische API-Endpunkte, die für den Offline-Betrieb zwischengespeichert werden
const CACHEABLE_API_PATHS = [
  '/api/config/public',
  '/api/categories',
  '/api/products',
  '/api/tables',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      // Einzeln cachen: `cache.addAll` bricht komplett ab, sobald EINE Route
      // fehlschlaegt - dann waere gar nichts vorgehalten.
      await Promise.all(
        PRECACHE_ASSETS.map((asset) =>
          cache.add(asset).catch(() => {
            /* Station evtl. deaktiviert - restliche Assets trotzdem cachen */
          })
        )
      );
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
          return undefined;
        })
      );
    })
  );
  self.clients.claim();
});

/**
 * Liefert die zum Request passende Offline-Ersatzseite.
 * WICHTIG: `caches.match` gibt ein Promise zurueck - ein `a || b` waere IMMER
 * wahr und lieferte im Offline-Fall eine leere Antwort (weisse Seite).
 */
async function navigationFallback(request) {
  const url = new URL(request.url);
  const candidates = [url.pathname, '/waiter', '/'];
  for (const candidate of candidates) {
    const hit = await caches.match(candidate);
    if (hit) return hit;
  }
  return new Response(
    '<!doctype html><html lang="de"><head><meta charset="utf-8">' +
      '<meta name="viewport" content="width=device-width,initial-scale=1">' +
      '<title>OpenBon offline</title></head>' +
      '<body style="font-family:system-ui;background:#0f172a;color:#f8fafc;' +
      'display:flex;align-items:center;justify-content:center;height:100vh;margin:0;text-align:center">' +
      '<div><h1 style="font-size:1.5rem;margin:0 0 .5rem">Keine Verbindung</h1>' +
      '<p style="opacity:.8;margin:0">Diese Seite ist noch nicht offline verfügbar.<br>' +
      'Bitte die Station einmal mit Netzwerk öffnen.</p></div></body></html>',
    { status: 503, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
  );
}

self.addEventListener('fetch', (event) => {
  const { request } = event;

  if (request.method !== 'GET') {
    return;
  }

  const url = new URL(request.url);

  // Fremde Ursprünge (CDN, Kartenterminal) nicht anfassen.
  if (url.origin !== self.location.origin) {
    return;
  }

  // 1. API-Katalog für Offline-Betrieb zwischenspeichern (Network First, Cache Fallback)
  if (CACHEABLE_API_PATHS.some((path) => url.pathname.startsWith(path))) {
    event.respondWith(
      fetch(request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const clone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return networkResponse;
        })
        .catch(async () => {
          const cached = await caches.match(request);
          if (cached) return cached;
          return new Response(JSON.stringify({ error: 'Offline – keine zwischengespeicherten Daten.' }), {
            status: 503,
            headers: { 'Content-Type': 'application/json' },
          });
        })
    );
    return;
  }

  // Alle anderen API-Routen nicht cachen
  if (url.pathname.startsWith('/api/')) {
    return;
  }

  const isNavigation = request.mode === 'navigate' || (request.headers.get('accept') || '').includes('text/html');

  // 2. Navigationen: Network First, damit Stationen nach einem Update nicht
  //    dauerhaft auf einer veralteten App-Shell haengen bleiben.
  if (isNavigation) {
    event.respondWith(
      fetch(request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const clone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return networkResponse;
        })
        .catch(() => navigationFallback(request))
    );
    return;
  }

  // 3. Assets (Cache First mit Network-Update im Hintergrund)
  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      if (cachedResponse) {
        fetch(request)
          .then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200) {
              const clone = networkResponse.clone();
              caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
            }
          })
          .catch(() => {});
        return cachedResponse;
      }

      return fetch(request)
        .then((networkResponse) => {
          if (!networkResponse || networkResponse.status !== 200) {
            return networkResponse;
          }
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, responseToCache);
          });
          return networkResponse;
        })
        .catch(() => Response.error());
    })
  );
});
