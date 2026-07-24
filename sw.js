// Make Your Mark — service worker
// Bump CACHE_VERSION when you want to force every client onto a fresh cached shell
// (e.g. after a big structural change). Day-to-day GitHub deploys reach clients
// automatically without a bump, because navigations are served network-first.
const CACHE_VERSION = 'mym-v5-workouts-nutrition';

const APP_SHELL = [
  '/portal.html',
  '/manifest.webmanifest',
  '/icons/icon-192.png',
  '/icons/icon-512.png'
  // If you ever split CSS/JS/fonts out of portal.html into their own files,
  // list them here so they're available offline.
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // Only touch same-origin GET requests. Everything else passes straight to the
  // network, untouched: the Apps Script auth/data calls (script.google.com),
  // YouTube/Drive video embeds, Google Fonts. Auth POSTs are excluded twice over
  // (non-GET and cross-origin), so magic-link login is never cached or broken.
  if (req.method !== 'GET' || url.origin !== location.origin) return;

  // HTML pages: network-first, so a new GitHub deploy shows up on the next online
  // load. Falls back to the cached shell when the client is offline.
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE_VERSION).then((c) => c.put(req, copy));
          return res;
        })
        .catch(() => caches.match(req).then((r) => r || caches.match('/portal.html')))
    );
    return;
  }

  // Static assets (icons, and any split-out css/js/fonts): stale-while-revalidate.
  // Serve from cache instantly, refresh the cached copy in the background.
  event.respondWith(
    caches.match(req).then((cached) => {
      const network = fetch(req).then((res) => {
        if (res && res.status === 200) {
          const copy = res.clone();
          caches.open(CACHE_VERSION).then((c) => c.put(req, copy));
        }
        return res;
      }).catch(() => cached);
      return cached || network;
    })
  );
});
