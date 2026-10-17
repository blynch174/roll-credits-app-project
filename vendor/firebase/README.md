Firebase JS SDK 12.19.0 (Apache License 2.0), browser builds copied from the `firebase` npm package:
`firebase-app.js`, `firebase-auth.js`, `firebase-firestore-lite.js`. The only change: their import of
`https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js` points at `./firebase-app.js` instead, so the app
doesn't depend on Google's CDN and works offline. Loaded only when Firebase is set up in `js/firebase-config.js`.
