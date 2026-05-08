const CACHE_NAME = 'larpfinder-v2';

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      // Don't fail install if a file is missing
      return cache.addAll([
        '/',
        '/index.html',
        '/manifest.json'
      ]).catch(err => console.warn('Cache addAll failed:', err));
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  e.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  
  // Skip cross-origin requests, like Supabase APIs
  if (!e.request.url.startsWith(self.location.origin)) return;

  // Network-First Strategy
  e.respondWith(
    fetch(e.request).then((response) => {
      // Cache the latest version if successful
      if (response && response.status === 200 && response.type === 'basic') {
        const responseToCache = response.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(e.request, responseToCache);
        });
      }
      return response;
    }).catch(() => {
      // Fallback to cache if network fails
      return caches.match(e.request);
    })
  );
});
