/* Mission Control — Service Worker */
const CACHE = 'mission-control-v1';
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
   - Firebase requests → always network (live data)
   - Everything else → cache first, fallback to network */
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);

  /* Always go live for Firebase */
  if (url.hostname.includes('firebaseio.com') || url.hostname.includes('googleapis.com')) {
    e.respondWith(fetch(e.request));
    return;
  }

  /* Cache-first for app shell */
  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached;
      return fetch(e.request).then(response => {
        /* Cache valid GET responses */
        if (e.request.method === 'GET' && response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE).then(c => c.put(e.request, clone));
        }
        return response;
      }).catch(() => {
        /* Offline fallback: serve app shell */
        if (e.request.mode === 'navigate') {
          return caches.match('/dailytracker/index.html');
        }
      });
    })
  );
});
