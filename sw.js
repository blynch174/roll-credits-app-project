// Offline support: keeps a copy of the app on the device.
//
// IMPORTANT: every time you push changes to GitHub, bump CACHE_VERSION
// (v1 -> v2 -> v3 ...). Otherwise phones keep showing the old version.

const CACHE_VERSION = 'v2';
const CACHE_NAME = 'roll-credits-' + CACHE_VERSION;

const FILES = [
  './',
  './index.html',
  './css/styles.css',
  './js/app.js',
  './js/store.js',
  './js/defaults.js',
  './js/dice.js',
  './js/themes.js',
  './js/icons.js',
  './js/ui.js',
  './js/screens/roll.js',
  './js/screens/watched.js',
  './js/screens/tables.js',
  './js/screens/settings.js',
  './js/screens/creator.js',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/apple-touch-icon.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(FILES)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k.startsWith('roll-credits-') && k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Network first, so updates show up right away when online.
// Falls back to the saved copy when offline.
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET' || !event.request.url.startsWith(self.location.origin)) return;
  event.respondWith(
    fetch(event.request)
      .then((res) => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        }
        return res;
      })
      .catch(() => caches.match(event.request, { ignoreSearch: true }))
  );
});
