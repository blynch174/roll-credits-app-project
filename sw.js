// Offline support: keeps a copy of the app on the device.
//
// IMPORTANT: every time you push changes to GitHub, bump CACHE_VERSION
// (v1 -> v2 -> v3 ...). Otherwise phones keep showing the old version.

const CACHE_VERSION = 'v1';
const CACHE_NAME = 'roll-credits-' + CACHE_VERSION;

const FILES = [
  './',
  './index.html',
  './css/styles.css',
  './js/app.js',
  './js/store.js',
  './js/defaults.js',
  './js/dice.js',
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

// Serve from the cache first, fall back to the network.
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  event.respondWith(
    caches.match(event.request, { ignoreSearch: true }).then((hit) => hit || fetch(event.request))
  );
});
