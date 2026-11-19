// The saved data itself: loading and saving it on this device, combining it with the account's copy, settings,
// admin drafts, undo, and backups. The other store modules read `state` and call save() after changing it.

import { BUILT_IN_FESTIVALS, buildDefaultState, builtInCategories } from '../defaults.js';
import { setExtras } from '../catalog.js';
import { ensureSync, baselineOf, stamp, merge, sameData } from '../merge.js';
import { looksValid, sanitize, migrate } from './migrate.js';
import { SAVED_MAX } from './constants.js';

const STORAGE_KEY = 'roll-credits:data';
const BACKUP_KEY = 'roll-credits:before-sync'; // this device's data from just before a sync changed it

// The live data. Other modules import it read-only (ES modules see reassignments here).
export let state = null;

let storageWorks = true;
let booted = false;
let base = null; // what each item looked like at the last save (merge.js), to tell what changed
let freshInstall = false; // this session started with no saved data: official updates apply without announcements
let draft = null; // an official festival an admin is editing: { fest, onChange }
const saveListeners = []; // sync.js listens here to back changes up to the account

export const getState = () => state;
export const canSave = () => storageWorks;
export const isFreshInstall = () => freshInstall;

// ---------- Load and save ----------

export function load() {
  let saved = null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) saved = JSON.parse(raw);
  } catch (e) {
    storageWorks = false;
  }
  freshInstall = !(saved && looksValid(saved));
  state = freshInstall ? buildDefaultState() : migrate(sanitize(saved));
  save();
  booted = true;
  return state;
}

// silent: write to the device without telling listeners (used when the change came from the account).
// While an admin draft is open, edits belong to the draft, so they go to its onChange instead.
export function save(silent = false) {
  if (draft && !silent) {
    draft.onChange(draft.fest);
    return;
  }
  saveState(silent);
}

// Writes the saved state even while a draft is open (official updates can arrive any time).
// rebase: the state came from elsewhere (the account), so it isn't a change made on this device.
export function saveState(silent = false, rebase = false) {
  if (rebase) {
    ensureSync(state);
    base = baselineOf(state);
  } else {
    base = stamp(state, base);
  }
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    storageWorks = true;
  } catch (e) {
    storageWorks = false;
  }
  setExtras(state.customMovies);
  if (booted && !silent) saveListeners.forEach((cb) => cb());
}

export function onSave(cb) {
  saveListeners.push(cb);
}

// ---------- The account's copy ----------

// Swaps in data that came from the account. Returns false if it doesn't look like Roll Credits data.
export function replaceState(d) {
  if (!looksValid(d)) return false;
  state = migrate(sanitize(d));
  saveState(true, true);
  return true;
}

// Combines data from the account with this device's, item by item (merge.js). Returns false if the account's
// data isn't usable. changed: whether this device's data changed; differs: whether the account needs the result.
export function mergeIn(d, { remoteWinsTies = true } = {}) {
  if (!looksValid(d)) return false;
  const remote = migrate(sanitize(d));
  const merged = merge(state, remote, { remoteWinsTies, savedMax: SAVED_MAX });
  const changed = !sameData(state, merged);
  state = merged;
  saveState(true, true);
  return { changed, differs: !sameData(merged, remote) };
}

// Keeps a copy of this device's data before a sync changes it (Settings → Restore Previous Data).
export function backupBeforeSync() {
  try {
    localStorage.setItem(BACKUP_KEY, JSON.stringify({ at: Date.now(), state }));
  } catch (e) {
    /* storage full or blocked: the backup is best-effort */
  }
}

export function syncBackup() {
  try {
    const b = JSON.parse(localStorage.getItem(BACKUP_KEY) || 'null');
    return b && b.state && looksValid(b.state) ? b : null;
  } catch (e) {
    return null;
  }
}

// Brings back the backed-up data: anything it had that's missing or different now comes back as it was.
// Nothing currently here is deleted, so this never loses data either. It syncs out like any other edit.
export function restoreSyncBackup() {
  const b = syncBackup();
  if (!b) return false;
  const old = migrate(sanitize(JSON.parse(JSON.stringify(b.state))));
  backupBeforeSync(); // the restore itself can be undone the same way
  const put = (list, key) => {
    const byKey = new Map(state[list].map((x, i) => [key(x), i]));
    for (const x of old[list] || []) {
      if (byKey.has(key(x))) state[list][byKey.get(key(x))] = x;
      else state[list].push(x);
    }
  };
  put('festivals', (f) => f.id);
  put('history', (e) => e.id);
  put('savedPicks', (x) => x.movieId);
  sortHistory();
  state.savedPicks = state.savedPicks.slice(-SAVED_MAX);
  state.settings = old.settings;
  const present = new Set(state.festivals.map((f) => f.id));
  state.removedOfficial = (state.removedOfficial || []).filter((id) => !present.has(id));
  save();
  return true;
}

// True when nothing on this device is worth keeping: no history, no custom festivals, built-in tables untouched.
export function isPristine() {
  if (state.history.length || (state.savedPicks || []).length) return false;
  if (state.festivals.some((f) => !f.builtIn)) return false;
  for (const f of state.festivals) {
    const def = BUILT_IN_FESTIVALS.find((d) => d.id === f.id);
    if (!def) return false;
    const fresh = builtInCategories(def);
    const sig = (cats) =>
      JSON.stringify(cats.map((c) => [c.name, c.die, c.slots.map((m) => (m ? m.title + '|' + m.year : ''))]));
    if (sig(f.categories) !== sig(fresh)) return false;
  }
  return true;
}

// Newest first. Every change to a history entry's date keeps this order.
export function sortHistory() {
  state.history.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
}

// ---------- Settings ----------

export function setSetting(key, value) {
  state.settings[key] = value;
  save();
}

// ---------- Admin drafts ----------
// The draft lives outside the saved state. While it's open, edits go to it and onChange saves it to the database.

export function openDraft(fest, onChange) {
  draft = { fest, onChange };
}
export function closeDraft() {
  draft = null;
}
export const currentDraft = () => (draft ? draft.fest : null);

// ---------- Undo ----------

export function snapshot() {
  return JSON.stringify(state);
}

export function restore(snap) {
  const keepSync = state.sync;
  state = JSON.parse(snap);
  state.sync = keepSync;
  save();
}

// ---------- Backup file and reset ----------

export function exportJSON() {
  return JSON.stringify(state, null, 2);
}

export function importJSON(text) {
  let d;
  try {
    d = JSON.parse(text);
  } catch (e) {
    return false;
  }
  if (!looksValid(d)) return false;
  const keepSync = state.sync;
  state = migrate(sanitize(d));
  state.sync = keepSync;
  save();
  return true;
}

export function resetAll() {
  const keepSync = state.sync;
  state = buildDefaultState();
  state.sync = keepSync;
  save();
}
