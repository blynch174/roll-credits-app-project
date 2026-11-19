// Admins' edits to catalog movies (moods, scare factor). Read from the database when the app opens (no account
// needed), kept on the device for offline use, and laid over the catalog so changes show right away.

import * as catalog from './catalog.js';
import * as cloud from './cloud.js';
import { readJSON, writeJSON } from './util.js';

const CACHE_KEY = 'roll-credits:movie-edits';

function readCache() {
  const c = readJSON(CACHE_KEY, {});
  return typeof c === 'object' ? c : {};
}

export async function start() {
  catalog.applyEdits(readCache(), true);
  const fb = await cloud.init();
  if (!fb) return;
  try {
    const map = await cloud.listCatalogEdits();
    catalog.applyEdits(map, true);
    writeJSON(CACHE_KEY, map);
  } catch (e) {
    /* offline or rules not published yet: keep the cached edits */
  }
}

// After an admin saves: show it on this device now and remember it.
export function remember(id, edit) {
  const map = readCache();
  map[id] = edit;
  catalog.applyEdits({ [id]: edit });
  writeJSON(CACHE_KEY, map);
}
