// Reads js/firebase-config.js (your own settings, kept out of update zips). If that file is missing or broken,
// the app still runs: accounts and TMDB search just switch off instead of the whole app failing to load.

let cfg = {};
try {
  cfg = await import('./firebase-config.js');
} catch (e) {
  console.warn('js/firebase-config.js is missing or has an error. Accounts and TMDB search are off.', e);
}

export const firebaseConfig = cfg.firebaseConfig || null;
// The TMDB relay's address (RELAY_SETUP.md), e.g. 'https://roll-credits-tmdb.yourname.workers.dev'. Empty = off.
export const TMDB_RELAY = String(cfg.TMDB_RELAY || '').replace(/\/+$/, '');
