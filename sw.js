// Offline support: keeps a copy of the app on the device.
//
// IMPORTANT: every time you push changes to GitHub, bump CACHE_VERSION
// (v1 -> v2 -> v3 ...). Otherwise phones keep showing the old version.
// The data/ and vendor/ files are not listed here on purpose (too big to download at install).
// vendor/firebase is only downloaded when accounts are set up (js/firebase-config.js).
// They get saved for offline use the first time the app loads them.

const CACHE_VERSION = 'v10';
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
  './js/catalog.js',
  './js/autofind.js',
  './js/dice3d.js',
  './js/tutorial.js',
  './js/firebase-config.js',
  './js/cloud.js',
  './js/sync.js',
  './js/screens/roll.js',
  './js/screens/watched.js',
  './js/screens/tables.js',
  './js/screens/editor.js',
  './js/screens/settings.js',
  './js/screens/creator.js',
  './js/screens/popcorn.js',
  './js/screens/account.js',
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
// cache: 'no-cache' makes the browser check with GitHub every time instead of reusing its own
// 10-minute copy, so a new push never shows up as a mix of old and new files.
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET' || !event.request.url.startsWith(self.location.origin)) return;
  const fresh = new Request(event.request.url, { cache: 'no-cache', credentials: 'same-origin' });
  event.respondWith(
    fetch(fresh)
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
