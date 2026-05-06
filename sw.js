/* Mission Control — Service Worker */
const CACHE = 'mission-control-v2';
const ASSETS = [
  '/dailytracker/',
  '/dailytracker/index.html',
  '/dailytracker/manifest.json',
  '/dailytracker/icon-192.png',
  '/dailytracker/icon-512.png'
];

/* Install: cache all core assets */
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});

/* Activate: clean up old caches */
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

/* Fetch strategy:
   - Firebase / googleapis → always network (live data, never cache)
   - HTML navigation → network-first (so updates propagate), fallback to cache
   - Other assets (icons, manifest) → cache-first */
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);

  /* Always go live for Firebase */
  if (url.hostname.includes('firebaseio.com') || url.hostname.includes('googleapis.com')) {
    e.respondWith(fetch(e.request));
    return;
  }

  /* Network-first for HTML — ensures updates deploy immediately */
  if (e.request.mode === 'navigate' || url.pathname.endsWith('.html') || url.pathname.endsWith('/')) {
    e.respondWith(
      fetch(e.request, {cache: 'no-store'}).then(response => {
        const clone = response.clone();
        caches.open(CACHE).then(c => c.put(e.request, clone));
        return response;
      }).catch(() => caches.match(e.request))
    );
    return;
  }

  /* Cache-first for everything else (icons, manifest, sw.js) */
  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached;
      return fetch(e.request).then(response => {
        if (e.request.method === 'GET' && response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE).then(c => c.put(e.request, clone));
        }
        return response;
      }).catch(() => {
        if (e.request.mode === 'navigate') {
          return caches.match('/dailytracker/index.html');
        }
      });
    })
  );
});
