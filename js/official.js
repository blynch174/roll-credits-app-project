// Official festivals: the published versions admins put out (Halloween, Christmas, …).
// Fetched from the database when the app opens (no account needed) and kept on the device for offline use.
// store.reconcileOfficial decides what each person's copy does with a newer version.

import * as store from './store.js';
import * as cloud from './cloud.js';

const CACHE_KEY = 'roll-credits:official';
const REFRESH_EVERY = 10 * 60 * 1000;

let list = readCache();
let fetchedAt = 0;
let hooks = { changed: () => {} };

function readCache() {
  try {
    const c = JSON.parse(localStorage.getItem(CACHE_KEY) || 'null');
    return c && Array.isArray(c.list) ? c.list : [];
  } catch (e) {
    return [];
  }
}
function writeCache() {
  try { localStorage.setItem(CACHE_KEY, JSON.stringify({ list, savedAt: Date.now() })); } catch (e) { /* full */ }
}

export const published = () => list;
export const get = (id) => list.find((p) => p.id === id) || null;

// Newer published version than this copy came from, or null.
export function updateFor(f) {
  const p = f && f.builtIn ? get(f.id) : null;
  return p && p.rev > (f.sourceRev || 0) ? p : null;
}

export function start(h = {}) {
  hooks = { ...hooks, ...h };
  if (list.length && store.reconcileOfficial(list)) hooks.changed();
  if (!cloud.configured()) return;
  refresh();
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && Date.now() - fetchedAt > REFRESH_EVERY) refresh();
  });
}

export async function refresh() {
  const fb = await cloud.init();
  if (!fb) return;
  try {
    list = await cloud.listOfficial();
  } catch (e) {
    return; // offline: keep the cached list
  }
  fetchedAt = Date.now();
  writeCache();
  store.reconcileOfficial(list);
  hooks.changed();
}

// After the account's data replaces this device's (sync), check it against the latest versions too.
export function reconcileNow() {
  if (list.length && store.reconcileOfficial(list)) hooks.changed();
}

// ---------- What changed ----------

const key = (m) => (m ? `${m.title}|${m.year || ''}` : '');

// Short lines for the Review update sheet: "8 new movies", "'Weird / Campy' is now 'Cult Classics'".
export function diffSummary(f, pub) {
  const lines = [];
  const mine = new Map();
  for (const c of f.categories) for (const m of c.slots) if (m) mine.set(key(m.base || m), m.base || m);
  const theirs = new Map();
  for (const c of pub.tables.categories) for (const m of c.slots) if (m) theirs.set(key(m), m);
  const added = [...theirs.keys()].filter((k) => !mine.has(k)).map((k) => theirs.get(k));
  const removed = [...mine.keys()].filter((k) => !theirs.has(k)).map((k) => mine.get(k));
  const names = (arr) => arr.slice(0, 4).map((m) => m.title).join(', ') + (arr.length > 4 ? `, and ${arr.length - 4} more` : '');
  if (pub.name !== f.name) lines.push(`Renamed to ${pub.name}`);
  if (added.length) lines.push(`${added.length} new movie${added.length === 1 ? '' : 's'}: ${names(added)}`);
  if (removed.length) lines.push(`${removed.length} movie${removed.length === 1 ? '' : 's'} leaving: ${names(removed)}`);
  const n = Math.min(f.categories.length, pub.tables.categories.length);
  for (let i = 0; i < n; i++) {
    const a = f.categories[i];
    const b = pub.tables.categories[i];
    if (a.name !== b.name) lines.push(`“${a.name}” is now “${b.name}”`);
    if (a.die !== b.die) lines.push(`${b.name} now rolls a d${b.die}`);
  }
  const dc = pub.tables.categories.length - f.categories.length;
  if (dc > 0) lines.push(`${dc} new categor${dc === 1 ? 'y' : 'ies'}`);
  if (dc < 0) lines.push(`${-dc} categor${dc === -1 ? 'y' : 'ies'} removed`);
  if (pub.tables.mode !== f.mode) lines.push(pub.tables.mode === 'one' ? 'Now one die, one list' : 'Now two dice');
  if (!lines.length) lines.push('Small fixes');
  return lines;
}
