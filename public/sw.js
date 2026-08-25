// OpenBon PWA Service Worker v1.1.0 - Offline-First Support
const CACHE_NAME = 'openbon-cache-v2';
const PRECACHE_ASSETS = [
  '/',
  '/waiter',
  '/waiter/order',
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
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(PRECACHE_ASSETS);
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
        })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;

  if (request.method !== 'GET') {
    return;
  }

  const url = new URL(request.url);

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
        .catch(() => {
          return caches.match(request);
        })
    );
    return;
  }

  // Alle anderen API-Routen nicht cachen
  if (url.pathname.startsWith('/api/')) {
    return;
  }

  // 2. App-Shell & Assets (Cache First mit Network-Update im Hintergrund)
  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      if (cachedResponse) {
        fetch(request)
          .then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200) {
              caches.open(CACHE_NAME).then((cache) => cache.put(request, networkResponse));
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
        .catch(() => {
          // Navigation Fallback bei vollständigem Offline-Zustand
          if (request.headers.get('accept')?.includes('text/html')) {
            return caches.match('/waiter') || caches.match('/');
          }
        });
    })
  );
});
