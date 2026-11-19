// Offline support: keeps a copy of the app on the device.
//
// IMPORTANT: every time you push changes to GitHub, bump CACHE_VERSION
// (v1 -> v2 -> v3 ...). Otherwise phones keep showing the old version.
// The data/ and vendor/ files are not listed here on purpose (too big to download at install).
// vendor/firebase is only downloaded when accounts are set up (js/firebase-config.js).
// They get saved for offline use the first time the app loads them.

const CACHE_VERSION = 'v40';
const CACHE_NAME = 'roll-credits-' + CACHE_VERSION;

const FILES = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/apple-touch-icon.png',
  // Styles, in the order index.html loads them
  './css/base.css',
  './css/layout.css',
  './css/components.css',
  './css/movie.css',
  './css/roll.css',
  './css/screens.css',
  './css/admin.css',
  // App modules
  './js/admin-loader.js',
  './js/app.js',
  './js/appconfig.js',
  './js/autofind.js',
  './js/catalog.js',
  './js/cloud.js',
  './js/defaults.js',
  './js/dice.js',
  './js/dice3d.js',
  './js/firebase-config.js',
  './js/icons.js',
  './js/merge.js',
  './js/moodmatch.js',
  './js/movieedits.js',
  './js/movieinfo.js',
  './js/official.js',
  './js/store.js',
  './js/streaming.js',
  './js/sync.js',
  './js/themes.js',
  './js/tmdb.js',
  './js/tutorial.js',
  './js/ui.js',
  './js/util.js',
  './js/store/constants.js',
  './js/store/festivals.js',
  './js/store/history.js',
  './js/store/migrate.js',
  './js/store/state.js',
  './js/ui/controls.js',
  './js/ui/dom.js',
  './js/ui/sheet.js',
  './js/ui/swipe.js',
  './js/ui/toast.js',
  // Screens
  './js/screens/account.js',
  './js/screens/creator.js',
  './js/screens/editor.js',
  './js/screens/feedback.js',
  './js/screens/festivals.js',
  './js/screens/library.js',
  './js/screens/popcorn.js',
  './js/screens/roll.js',
  './js/screens/services.js',
  './js/screens/settings.js',
  './js/screens/tables.js',
  './js/screens/theme-picker.js',
  './js/screens/updates.js',
  './js/screens/watched.js',
];

// Not listed above on purpose: Admin Tools load only when an admin opens them (js/admin-loader.js), so nobody
// else downloads them. Like data/ and vendor/, they're saved for offline use the first time they load:
//   './js/screens/admin.js'
//   './js/screens/admin-festivals.js'
//   './js/screens/admin-movies.js'
//   './js/screens/movie-edit.js'

// Each file is saved on its own, so one missing file (say, an uncommitted config) doesn't stop the update.
self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => Promise.all(FILES.map((f) => cache.add(f).catch(() => {})))));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => k.startsWith('roll-credits-') && k !== CACHE_NAME && k !== FONT_CACHE)
            .map((k) => caches.delete(k)),
        ),
      ),
  );
  self.clients.claim();
});

// Network first, so updates show up right away when online.
// Falls back to the saved copy when offline.
// cache: 'no-cache' makes the browser check with GitHub every time instead of reusing its own
// 10-minute copy, so a new push never shows up as a mix of old and new files.
// Theme fonts (Google Fonts): saved after the first download, so themes keep their fonts offline.
const FONT_CACHE = 'roll-credits-fonts';
const isFont = (url) => url.startsWith('https://fonts.googleapis.com/') || url.startsWith('https://fonts.gstatic.com/');

self.addEventListener('fetch', (event) => {
  if (event.request.method === 'GET' && isFont(event.request.url)) {
    event.respondWith(
      caches.open(FONT_CACHE).then((cache) =>
        cache.match(event.request).then(
          (hit) =>
            hit ||
            fetch(event.request).then((res) => {
              if (res.ok || res.type === 'opaque') cache.put(event.request, res.clone());
              return res;
            }),
        ),
      ),
    );
    return;
  }
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
      .catch(() => caches.match(event.request, { ignoreSearch: true })),
  );
});
