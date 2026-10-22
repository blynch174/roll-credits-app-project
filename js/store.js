// All saved data and every change to it. The screens call these and then re-render.

import {
  BUILT_IN_FESTIVALS, STARTER_FESTIVALS, buildBuiltInFestival, buildDefaultState, builtInCategories,
  makeCategory, makeMovie, uid, SWATCHES, BUNDLED_REV, tablesSig, categoriesFromTables, festivalFromOfficial,
} from './defaults.js';
import { themeFromOldFestival, DEFAULT_THEME, isThemeId, retiredTheme } from './themes.js';
import { norm, setExtras } from './catalog.js';
import { ensureSync, baselineOf, stamp, merge, sameData } from './merge.js';

const STORAGE_KEY = 'roll-credits:data';
const BACKUP_KEY = 'roll-credits:before-sync'; // this device's data from just before a sync changed it
const CURRENT_VERSION = 3;

let state = null;
let storageWorks = true;
let booted = false;
let base = null; // what each item looked like at the last save (merge.js), to tell what changed
let freshInstall = false; // this session started with no saved data: official updates apply without announcements
const saveListeners = []; // sync.js listens here to back changes up to the account

// ---------- Load / save ----------

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
export function save(silent = false) {
  if (draft && !silent) {
    draft.onChange(draft.fest);
    return;
  }
  saveState(silent);
}

// Writes the saved state even while a draft is open (official updates can arrive any time).
// rebase: the state came from elsewhere (the account), so it isn't a change made on this device.
function saveState(silent = false, rebase = false) {
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
  } catch (e) { /* storage full or blocked: the backup is best-effort */ }
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
  state.history.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
  state.savedPicks = state.savedPicks.slice(-SAVED_MAX);
  state.settings = old.settings;
  const present = new Set(state.festivals.map((f) => f.id));
  state.removedOfficial = removedOfficial().filter((id) => !present.has(id));
  save();
  return true;
}

// True when nothing on this device is worth keeping: no history, no custom festivals, built-in tables untouched.
export function isPristine() {
  if (state.history.length || savedPicks().length) return false;
  if (state.festivals.some((f) => !f.builtIn)) return false;
  for (const f of state.festivals) {
    const def = BUILT_IN_FESTIVALS.find((d) => d.id === f.id);
    if (!def) return false;
    const fresh = builtInCategories(def);
    const sig = (cats) => JSON.stringify(cats.map((c) => [c.name, c.die, c.slots.map((m) => (m ? m.title + '|' + m.year : ''))]));
    if (sig(f.categories) !== sig(fresh)) return false;
  }
  return true;
}

export const canSave = () => storageWorks;
export const getState = () => state;

function looksValid(d) {
  if (!d || typeof d !== 'object' || typeof d.version !== 'number') return false;
  if (d.version === 1) return Array.isArray(d.menus) && d.season && Array.isArray(d.season.watched);
  return Array.isArray(d.festivals) && Array.isArray(d.history) && !!d.settings;
}

// Repairs data from outside this device (a backup file, the account) before it's used: drops entries that
// are broken, trims oversized text, and caps list sizes. Only applies to version 2+ data (version 1 is migrated).
const LIMITS = { festivals: 100, categories: 24, slots: 120, history: 50000, saved: 3, text: 300, notes: 4000 };
const str = (v, max = LIMITS.text) => (typeof v === 'string' ? v.slice(0, max) : v == null ? v : String(v).slice(0, max));
const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
function cleanMovie(m) {
  if (!isObj(m) || typeof m.title !== 'string' || !m.title.trim()) return null;
  m.title = str(m.title);
  if (m.note != null) m.note = str(m.note, LIMITS.notes);
  if (isObj(m.base)) m.base = cleanMovie(m.base); else delete m.base;
  if (!m.base) delete m.base;
  return m;
}
function sanitize(d) {
  if (!isObj(d) || d.version === 1) return d;
  if (!isObj(d.settings)) d.settings = {};
  d.festivals = (Array.isArray(d.festivals) ? d.festivals : [])
    .filter((f) => isObj(f) && typeof f.id === 'string' && Array.isArray(f.categories))
    .slice(0, LIMITS.festivals);
  for (const f of d.festivals) {
    f.name = str(f.name) || 'Festival';
    f.categories = f.categories
      .filter((c) => isObj(c) && typeof c.id === 'string' && Array.isArray(c.slots))
      .slice(0, LIMITS.categories);
    for (const c of f.categories) {
      c.name = str(c.name) || '';
      c.slots = c.slots.slice(0, LIMITS.slots).map(cleanMovie);
    }
  }
  d.history = (Array.isArray(d.history) ? d.history : [])
    .filter((e) => isObj(e) && typeof e.id === 'string' && typeof e.title === 'string' && typeof e.date === 'string')
    .slice(0, LIMITS.history);
  for (const e of d.history) {
    e.title = str(e.title);
    e.notes = str(e.notes || '', LIMITS.notes);
    e.rating = Math.max(0, Math.min(5, Number(e.rating) || 0));
  }
  d.savedPicks = (Array.isArray(d.savedPicks) ? d.savedPicks : [])
    .filter((x) => isObj(x) && x.movieId != null && typeof x.title === 'string')
    .slice(0, LIMITS.saved);
  d.customMovies = (Array.isArray(d.customMovies) ? d.customMovies : [])
    .filter((m) => isObj(m) && typeof m.id === 'string' && /^tmdb-\d+$/.test(m.id) && typeof m.title === 'string')
    .slice(0, 2000);
  for (const m of d.customMovies) {
    m.title = str(m.title);
    m.overview = m.overview ? str(m.overview, 600) : null;
    m.tmdbId = +m.id.slice(5);
    for (const k of ['countries', 'languages', 'genres', 'directors', 'moodTone']) if (!Array.isArray(m[k])) m[k] = [];
  }
  if (!Array.isArray(d.removedOfficial)) d.removedOfficial = [];
  if (Array.isArray(d.librarySeen)) d.librarySeen = d.librarySeen.filter((x) => typeof x === 'string').slice(-500);
  return d;
}

// Upgrades older saved data one version at a time.
function migrate(d) {
  if (d.version === 1) d = migrateV1toV2(d);
  if (d.version === 2) d = migrateV2toV3(d);
  // Future: if (d.version === 3) d = migrateV3toV4(d);
  ensureBuiltIns(d);
  if (!d.festivals.length) { d.festivals = buildDefaultState().festivals; d.removedOfficial = []; }
  if (!Array.isArray(d.savedPicks)) d.savedPicks = [];
  if (!Array.isArray(d.customMovies)) d.customMovies = [];
  // v3.19 Festival Library: festivals that already existed don't count as "New".
  if (!Array.isArray(d.librarySeen)) d.librarySeen = BUILT_IN_FESTIVALS.map((x) => x.id);
  // 3D dice are opt-in for now: anyone who never picked a style themselves goes to flat dice.
  if (!d.settings.diceStyleChosen) d.settings.diceStyle = 'flat';
  // Added in v3.3. Anyone with saved data from before already knows the app, so skip the tour for them.
  if (d.settings.tutorialSeen === undefined) d.settings.tutorialSeen = true;
  if (!d.festivals.some((f) => f.id === d.activeFestival)) d.activeFestival = d.festivals[0].id;
  // v3.6: one app-wide theme instead of one per festival. Keep whatever the current festival looked like.
  // v3.18: themes were redesigned; older picks move to the closest new one.
  if (retiredTheme(d.settings.theme)) d.settings.theme = retiredTheme(d.settings.theme);
  if (!isThemeId(d.settings.theme)) d.settings.theme = themeFromOldFestival(d.festivals.find((f) => f.id === d.activeFestival));
  // v3.6: built-in festivals remember which published version they came from (the bundled one is revision 1).
  for (const f of d.festivals) {
    if (!f.builtIn || f.sourceRev !== undefined) continue;
    const def = BUILT_IN_FESTIVALS.find((x) => x.id === f.id);
    f.sourceRev = BUNDLED_REV;
    f.sourceSig = def ? tablesSig(buildBuiltInFestival(def)) : tablesSig(f);
  }
  d.version = CURRENT_VERSION;
  return d;
}

// v1 had one Halloween menu and a per-season watched list.
function migrateV1toV2(old) {
  const menu = old.menus.find((m) => m.id === old.activeMenu) || old.menus[0];
  const hDef = BUILT_IN_FESTIVALS.find((f) => f.id === 'halloween');
  const halloween = buildBuiltInFestival(hDef);
  halloween.theme = old.settings && old.settings.theme ? old.settings.theme : null;
  halloween.categories = menu.categories.map((c) => ({
    id: c.id,
    name: c.name,
    color: c.color,
    die: 12,
    slots: Array.from({ length: 12 }, (_, i) => {
      const m = c.slots[i];
      return m ? { id: m.id, title: m.title, year: m.year || null, catalogId: null, ...(m.note ? { note: m.note } : {}) } : null;
    }),
  }));
  const history = (old.season.watched || []).map((w) => ({
    id: w.id,
    festivalId: 'halloween',
    festivalName: 'Halloween',
    icon: 'skull',
    categoryId: w.categoryId,
    categoryName: w.categoryName,
    movieId: w.movieId,
    catalogId: null,
    title: w.title,
    year: w.year || null,
    slotIndex: w.slotIndex,
    date: w.date,
    rating: w.rating || 0,
    notes: w.notes || '',
  }));
  return {
    version: 2,
    settings: {
      diceMode: (old.settings && old.settings.diceMode) || 'virtual',
      slotMode: (old.settings && old.settings.slotMode) || 'keep',
    },
    activeFestival: 'halloween',
    festivals: [halloween],
    history,
  };
}

// v3 added sequel switching (on by default) and manually logged movies.
function migrateV2toV3(d) {
  d.settings.sequels = true;
  d.version = 3;
  return d;
}

// New built-in festivals shipped in an update appear for existing users too.
// Since v3.19 new official festivals aren't added automatically; they wait in the Festival Library.
// Only a device with no festivals at all gets the starter set back.
function ensureBuiltIns(d) {
  if (d.festivals.length) return;
  for (const def of BUILT_IN_FESTIVALS) if (STARTER_FESTIVALS.includes(def.id)) d.festivals.push(buildBuiltInFestival(def));
}

// ---------- Lookups ----------

export const festivals = () => state.festivals;
// While an admin edits an official festival's draft, that draft is reachable by its id ('draft:halloween')
// so the normal table editing functions work on it.
export const festival = (id) => (draft && draft.fest.id === id ? draft.fest : state.festivals.find((f) => f.id === id) || null);
export const activeFestival = () => state.festivals.find((f) => f.id === state.activeFestival) || state.festivals[0];
// The festival the Edit screen is showing: the draft when editing one, otherwise the active festival.
export const editFestival = () => (draft ? draft.fest : activeFestival());
export const themeId = () => state.settings.theme || DEFAULT_THEME;

export function setActiveFestival(id) {
  const f = state.festivals.find((x) => x.id === id);
  if (!f) return;
  state.activeFestival = id;
  if (f.isNew) delete f.isNew;
  save();
}

export function category(f, catId) {
  return f.categories.find((c) => c.id === catId) || null;
}

export const filledCount = (cat) => cat.slots.filter(Boolean).length;

// In two-dice festivals, an empty category acts as the Wild Card.
export const isWild = (f, cat) => f.mode === 'two' && filledCount(cat) === 0;

// "Seen" only counts history from this festival since its last "Start fresh".
// A movie counts as seen if that exact slot movie was watched, or the same catalog movie was.
function festivalHistory(f) {
  return state.history.filter((e) => e.festivalId === f.id && (!f.freshSince || e.date >= f.freshSince));
}

export function isSeen(f, movie) {
  if (!movie) return false;
  return festivalHistory(f).some((e) => e.movieId === movie.id || (movie.catalogId && e.catalogId === movie.catalogId));
}

// Seen-check for a catalog movie (used when stepping through a franchise).
export function isCatalogSeen(f, catalogId) {
  return festivalHistory(f).some((e) => e.catalogId === catalogId);
}

// Is this catalog movie already sitting in one of the festival's slots?
export function onTables(f, catalogId) {
  return f.categories.some((c) => c.slots.some((s) => s && s.catalogId === catalogId));
}

// Empty slots worth a reminder (skips untouched Wild Card categories).
export function openSlots(f) {
  const out = [];
  for (const cat of f.categories) {
    if (isWild(f, cat)) continue;
    const n = cat.slots.filter((s) => !s).length;
    if (n > 0) out.push({ cat, count: n });
  }
  return out;
}

// ---------- Settings ----------

export function setSetting(key, value) {
  state.settings[key] = value;
  save();
}

// ---------- Editing tables ----------

export function setSlot(fId, catId, index, { title, year, catalogId = null }) {
  const cat = category(festival(fId), catId);
  if (!cat) return;
  const clean = String(title || '').trim();
  if (!clean) return;
  const y = parseInt(year, 10);
  const yearVal = Number.isFinite(y) && y > 1800 && y < 3000 ? y : null;
  const existing = cat.slots[index];
  if (existing && existing.title === clean) {
    existing.year = yearVal; // same movie tidied up: keep its id
    existing.catalogId = catalogId;
  } else {
    cat.slots[index] = makeMovie(clean, yearVal, catalogId);
  }
  save();
}

// Fills in catalog links for slots and history typed before the catalog existed.
// matchFn(title, year) returns a catalog movie or null.
// Also: movies picked from TMDB search ('tmdb-123') switch to the catalog's own id once the catalog has them.
export function linkCatalog(matchFn, byTmdbFn = () => null) {
  let changed = 0;
  const upgrade = (o) => {
    if (o && typeof o.catalogId === 'string' && o.catalogId.startsWith('tmdb-')) {
      const hit = byTmdbFn(o.catalogId.slice(5));
      if (hit) { o.catalogId = hit.id; changed++; }
    }
  };
  for (const f of state.festivals) {
    for (const c of f.categories) {
      for (const m of c.slots) {
        upgrade(m);
        if (m && m.base) upgrade(m.base);
        if (m && !m.catalogId) {
          const hit = matchFn(m.title, m.year);
          if (hit) { m.catalogId = hit.id; changed++; }
        }
      }
    }
  }
  for (const e of state.history) {
    upgrade(e);
    if (!e.catalogId) {
      const hit = matchFn(e.title, e.year);
      if (hit) { e.catalogId = hit.id; changed++; }
    }
  }
  const before = customMovies().length;
  state.customMovies = customMovies().filter((m) => !byTmdbFn(m.tmdbId));
  if (state.customMovies.length !== before) changed++;
  if (changed) save();
  return changed;
}

// Movies picked from TMDB search that aren't in the catalog yet. Kept with the person's data (and synced) so
// their posters and details show everywhere. Dropped once the catalog gets the movie (linkCatalog).
export const customMovies = () => state.customMovies || [];
export function addCustomMovie(m) {
  if (!m || !m.id || customMovies().some((x) => x.id === m.id)) return;
  const clean = Object.fromEntries(Object.entries(m).filter(([k]) => !k.startsWith('_')));
  state.customMovies = [...customMovies(), clean];
  save();
}

// Sequel switching: the slot now shows the sequel. The original is kept so Start fresh can restore it.
export function stepToSequel(fId, catId, index, sequel) {
  const cat = category(festival(fId), catId);
  const cur = cat && cat.slots[index];
  if (!cur) return;
  const base = cur.base || { id: cur.id, title: cur.title, year: cur.year, catalogId: cur.catalogId || null };
  cat.slots[index] = { ...makeMovie(sequel.title, sequel.releaseYear, sequel.id), base };
  save();
}

export function clearSlot(fId, catId, index) {
  const cat = category(festival(fId), catId);
  if (!cat) return;
  cat.slots[index] = null;
  save();
}

export function updateCategory(fId, catId, { name, color }) {
  const cat = category(festival(fId), catId);
  if (!cat) return;
  if (name !== undefined && String(name).trim()) cat.name = String(name).trim();
  if (color !== undefined) cat.color = color;
  save();
}

// How many movies would be lost if this category's die changed.
export function categoryDieLoss(cat, die) {
  return cat.slots.slice(die).filter(Boolean).length;
}

export function setCategoryDie(fId, catId, die) {
  const cat = category(festival(fId), catId);
  if (!cat) return;
  cat.slots = Array.from({ length: die }, (_, i) => cat.slots[i] || null);
  cat.die = die;
  save();
}

export function shuffleCategory(fId, catId, randInt) {
  const cat = category(festival(fId), catId);
  if (!cat) return;
  const a = cat.slots;
  for (let i = a.length - 1; i > 0; i--) {
    const j = randInt(0, i);
    [a[i], a[j]] = [a[j], a[i]];
  }
  save();
}

export function clearCategory(fId, catId) {
  const cat = category(festival(fId), catId);
  if (!cat) return;
  cat.slots = Array.from({ length: cat.die }, () => null);
  save();
}

// ---------- Festival structure (dice) ----------

function newCategory(index, die) {
  return makeCategory(`Category ${index + 1}`, SWATCHES[index % SWATCHES.length].id, die);
}

// What a dice change would remove. mode: 'one' | 'two'.
export function festivalDiceLoss(f, mode, categoryDie) {
  const keep = mode === 'one' ? 1 : categoryDie;
  const removed = f.categories.slice(keep);
  return {
    categories: removed.length,
    movies: removed.reduce((n, c) => n + c.slots.filter(Boolean).length, 0),
  };
}

export function setFestivalDice(fId, mode, categoryDie) {
  const f = festival(fId);
  if (!f) return;
  const count = mode === 'one' ? 1 : categoryDie;
  const baseDie = (f.categories[0] && f.categories[0].die) || 12;
  const cats = f.categories.slice(0, count);
  while (cats.length < count) cats.push(newCategory(cats.length, baseDie));
  f.categories = cats;
  f.mode = mode;
  f.categoryDie = mode === 'one' ? null : categoryDie;
  save();
}

// ---------- Festivals ----------

export function updateFestivalLook(fId, { name, icon }) {
  const f = festival(fId);
  if (!f || f.builtIn) return;
  if (name && name.trim()) f.name = name.trim();
  if (icon) f.icon = icon;
  save();
}

// Clears Seen marks on the tables without touching history.
export function startFresh(fId) {
  const f = festival(fId);
  if (!f) return;
  f.freshSince = new Date().toISOString();
  // Slots that stepped through a franchise go back to the original movie.
  for (const c of f.categories) {
    c.slots = c.slots.map((m) => (m && m.base ? { ...m.base } : m));
  }
  save();
}

// Back to the official tables: the latest published version if we have it, otherwise the bundled one.
export function restoreBuiltIn(fId, pub = null) {
  const f = festival(fId);
  if (!f) return;
  if (pub) return applyOfficial(fId, pub, false);
  const def = BUILT_IN_FESTIVALS.find((d) => d.id === fId);
  if (!def) return;
  const fresh = buildBuiltInFestival(def);
  Object.assign(f, { mode: 'two', categoryDie: def.categoryDie, categories: fresh.categories, sourceRev: fresh.sourceRev, sourceSig: fresh.sourceSig });
  delete f.announce;
  save();
}

// ---------- Official festivals (published by admins) ----------
// pub = { id, name, icon, rev, kind: 'version' | 'fix', message, hidden, tables }

export const isUntouched = (f) => !!f.sourceSig && tablesSig(f) === f.sourceSig;

// Replace a festival's tables with a published version. keepAnnounce: show "X got an update" afterwards.
export function applyOfficial(fId, pub, announce = false) {
  const f = state.festivals.find((x) => x.id === fId);
  if (!f) return;
  f.name = pub.name;
  f.icon = pub.icon;
  f.mode = pub.tables.mode;
  f.categoryDie = pub.tables.categoryDie;
  f.categories = categoriesFromTables(pub.tables, f);
  f.sourceRev = pub.rev;
  f.sourceSig = tablesSig(f);
  delete f.dismissedRev;
  if (announce && pub.message) f.announce = { rev: pub.rev, message: pub.message, applied: true };
  else delete f.announce;
  saveState();
}

// "Keep mine": don't ask about this version again.
export function keepMine(fId, rev) {
  const f = state.festivals.find((x) => x.id === fId);
  if (!f) return;
  f.dismissedRev = rev;
  delete f.announce;
  saveState();
}

export function clearAnnounce(fId) {
  const f = state.festivals.find((x) => x.id === fId);
  if (!f || !f.announce) return;
  delete f.announce;
  saveState();
}

// Called with the published list whenever it's fetched. Returns true if anything changed.
//  - Untouched festivals update by themselves (a New version also shows its message once).
//  - Edited ones get a "Review" banner for a New version; a Quick fix waits quietly in Festival settings.
//  - Official festivals the user doesn't have yet are added with a New badge (unless hidden).
export function reconcileOfficial(list) {
  let changed = false;
  for (const pub of list) {
    const f = state.festivals.find((x) => x.id === pub.id);
    if (!f) continue; // not added: it's waiting in the Festival Library
    if (!f.builtIn || !(pub.rev > (f.sourceRev || 0))) continue;
    if (isUntouched(f)) {
      applyOfficial(f.id, pub, pub.kind === 'version' && !freshInstall);
      changed = true;
    } else if (pub.kind === 'version' && pub.rev > (f.dismissedRev || 0) && (!f.announce || f.announce.rev !== pub.rev)) {
      f.announce = { rev: pub.rev, message: pub.message || '', applied: false };
      changed = true;
    }
  }
  if (changed) saveState();
  return changed;
}

// ---------- Admin drafts ----------
// The draft lives outside the saved state. While it's open, edits go to it and onChange saves it to the database.

let draft = null;

export function openDraft(fest, onChange) {
  draft = { fest, onChange };
}
export function closeDraft() {
  draft = null;
}
export const currentDraft = () => (draft ? draft.fest : null);

// Any festival can be deleted except the last one. Official festivals are remembered as removed, so updates
// don't bring them back; the festival menu can add them again (restoreOfficialFestival).
export function deleteFestival(fId) {
  const f = state.festivals.find((x) => x.id === fId);
  if (!f || state.festivals.length <= 1) return false;
  state.festivals = state.festivals.filter((x) => x.id !== fId);
  if (f.builtIn) state.removedOfficial = [...new Set([...(state.removedOfficial || []), fId])];
  if (state.activeFestival === fId) state.activeFestival = state.festivals[0].id;
  save();
  return true;
}

export const removedOfficial = () => state.removedOfficial || [];

// Festival Library: which official festivals this person has already seen there (the rest get a "New" badge).
export const librarySeen = () => state.librarySeen || [];
export function markLibrarySeen(ids) {
  const seen = new Set(librarySeen());
  const before = seen.size;
  ids.forEach((id) => seen.add(id));
  if (seen.size === before) return;
  state.librarySeen = [...seen].slice(-500);
  save();
}

// Adds a deleted official festival back: the latest published version if we have it, otherwise the bundled one.
export function restoreOfficialFestival(id, pub = null) {
  const def = BUILT_IN_FESTIVALS.find((d) => d.id === id);
  if (!pub && !def) return null;
  const f = pub ? festivalFromOfficial(pub) : buildBuiltInFestival(def);
  state.festivals.push(f);
  state.removedOfficial = removedOfficial().filter((x) => x !== id);
  save();
  return f;
}

// Free accounts get a few festivals of their own (official ones don't count). Admins aren't limited.
// Only checked here in the app: when paid plans exist this needs enforcing on the server too.
export const CUSTOM_FESTIVAL_LIMIT = 3;
export const customFestivalCount = () => state.festivals.filter((f) => !f.builtIn).length;
export const canCreateFestival = (admin = false) => admin || customFestivalCount() < CUSTOM_FESTIVAL_LIMIT;

// opts: { name, icon, mode, categoryDie, movieDie, copyFrom }
export function createFestival(opts) {
  const id = uid();
  let categories;
  const count = opts.mode === 'one' ? 1 : opts.categoryDie;
  const src = opts.copyFrom ? festival(opts.copyFrom) : null;
  if (src) {
    // Copy names, colors, and movies; fit them to the new dice.
    categories = Array.from({ length: count }, (_, i) => {
      const c = src.categories[i];
      if (!c) return newCategory(i, opts.movieDie);
      return {
        id: uid(),
        name: c.name,
        color: c.color,
        die: opts.movieDie,
        slots: Array.from({ length: opts.movieDie }, (_, j) => {
          const m = c.slots[j];
          return m ? { id: uid(), title: m.title, year: m.year, catalogId: m.catalogId || null } : null;
        }),
      };
    });
  } else {
    categories = Array.from({ length: count }, (_, i) => newCategory(i, opts.movieDie));
    if (opts.mode === 'one') categories[0].name = 'Movies';
  }
  const f = {
    id,
    name: opts.name.trim(),
    builtIn: false,
    icon: opts.icon,
    mode: opts.mode,
    categoryDie: opts.mode === 'one' ? null : opts.categoryDie,
    freshSince: null,
    categories,
  };
  state.festivals.push(f);
  state.activeFestival = id;
  save();
  return f;
}

// ---------- Watching ----------

export function watchMovie(fId, catId, index) {
  const f = festival(fId);
  const cat = category(f, catId);
  const movie = cat && cat.slots[index];
  if (!movie) return null;
  const entry = {
    id: uid(),
    festivalId: f.id,
    festivalName: f.name,
    icon: f.icon,
    categoryId: cat.id,
    categoryName: cat.name,
    movieId: movie.id,
    catalogId: movie.catalogId || null,
    title: movie.title,
    year: movie.year,
    slotIndex: index,
    date: new Date().toISOString(),
    rating: 0,
    notes: '',
  };
  state.history.unshift(entry);
  if (state.settings.slotMode === 'replace') cat.slots[index] = null;
  save();
  return entry;
}

export function entry(id) {
  return state.history.find((e) => e.id === id) || null;
}

export function updateEntry(id, { rating, notes }) {
  const e = entry(id);
  if (!e) return;
  if (rating !== undefined) e.rating = rating;
  if (notes !== undefined) e.notes = notes;
  save();
}

// Moves a history entry to another festival (or No Festival). If that festival has the movie on a table, the entry
// is matched to it (so it shows as Seen there); otherwise it's "Off the menu". Tables themselves aren't changed.
export function moveEntry(id, festivalId) {
  const e = entry(id);
  if (!e || e.festivalId === festivalId) return null;
  if (festivalId === NO_FEST || festivalId === POPCORN) {
    Object.assign(e, {
      festivalId,
      festivalName: festivalId === NO_FEST ? NO_FEST_NAME : POPCORN_NAME,
      icon: festivalId === NO_FEST ? NO_FEST_ICON : 'popcorn',
      categoryId: OFF_MENU,
      categoryName: festivalId === NO_FEST ? NO_FEST_NAME : 'Any mood',
      slotIndex: null,
    });
    save();
    return { found: null };
  }
  const f = festival(festivalId);
  if (!f) return null;
  const found = findSlot(f, { title: e.title, year: e.year, catalogId: e.catalogId });
  Object.assign(e, {
    festivalId: f.id,
    festivalName: f.name,
    icon: f.icon,
    categoryId: found ? found.cat.id : OFF_MENU,
    categoryName: found ? found.cat.name : 'Off the menu',
    movieId: found ? found.movie.id : e.movieId,
    slotIndex: found ? found.index : null,
  });
  save();
  return { found };
}

// day: 'YYYY-MM-DD'. Keeps the newest-first order.
export function setEntryDate(id, day) {
  const e = entry(id);
  if (!e || !/^\d{4}-\d{2}-\d{2}$/.test(day)) return;
  const old = new Date(e.date);
  const oldDay = `${old.getFullYear()}-${String(old.getMonth() + 1).padStart(2, '0')}-${String(old.getDate()).padStart(2, '0')}`;
  if (oldDay === day) return;
  e.date = new Date(day + 'T12:00:00').toISOString();
  state.history.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
  save();
}

// reason: 'unfinished' | 'hated' | 'mistake'. Returns a message for the UI.
export function removeEntry(id, reason) {
  const i = state.history.findIndex((e) => e.id === id);
  if (i === -1) return '';
  const e = state.history[i];
  state.history.splice(i, 1);
  if (e.categoryId === OFF_MENU || e.festivalId === POPCORN) {
    save();
    return `${e.title} removed from your history.`;
  }
  const f = festival(e.festivalId);
  const cat = f && category(f, e.categoryId);

  if (reason === 'hated') {
    if (cat) {
      const at = cat.slots.findIndex((s) => s && s.id === e.movieId);
      if (at !== -1) cat.slots[at] = null;
    }
    save();
    return `${e.title} is gone for good.${cat ? ' Its slot is open.' : ''}`;
  }

  let msg;
  if (!cat) {
    msg = 'Removed. Its festival or category no longer exists.';
  } else if (cat.slots.some((s) => s && s.id === e.movieId)) {
    msg = `${e.title} is back in the rotation.`;
  } else if (e.slotIndex < cat.slots.length && !cat.slots[e.slotIndex]) {
    cat.slots[e.slotIndex] = { id: e.movieId, title: e.title, year: e.year, catalogId: e.catalogId || null };
    msg = `${e.title} is back in its slot.`;
  } else {
    msg = `Slot's already filled. Swap ${e.title} back in manually if you want.`;
  }
  if (reason === 'unfinished' && e.notes && cat) {
    const m = cat.slots.find((s) => s && s.id === e.movieId);
    if (m) m.note = e.notes;
  }
  save();
  return msg;
}

// Movies logged by hand that aren't on any of the festival's tables.
export const OFF_MENU = 'off-menu';

// Finds the slot in a festival holding this movie (by catalog id, or title + year).
export function findSlot(f, { title, year, catalogId }) {
  const key = norm(title) + '|' + (year || '');
  for (const cat of f.categories) {
    const i = cat.slots.findIndex((m) =>
      m && ((catalogId && m.catalogId === catalogId) || norm(m.title) + '|' + (m.year || '') === key)
    );
    if (i !== -1) return { cat, index: i, movie: cat.slots[i] };
  }
  return null;
}

// Log a movie watched outside the app. If it's on the festival's tables, it's linked to that slot
// (marked Seen, or opened in Replace mode), just like watching it from a roll.
// Logging a movie that isn't part of any festival.
export const NO_FEST = 'none';
export const NO_FEST_NAME = 'No Festival';
export const NO_FEST_ICON = 'star';

export function logMovie({ festivalId, title, year, catalogId, date, rating, notes }) {
  if (festivalId === NO_FEST) return logUnfiled({ title, year, catalogId, date, rating, notes });
  const f = festival(festivalId);
  if (!f || !String(title || '').trim()) return null;
  const y = parseInt(year, 10);
  const yearVal = Number.isFinite(y) && y > 1800 && y < 3000 ? y : null;
  const found = findSlot(f, { title, year: yearVal, catalogId });
  const entry = {
    id: uid(),
    festivalId: f.id,
    festivalName: f.name,
    icon: f.icon,
    categoryId: found ? found.cat.id : OFF_MENU,
    categoryName: found ? found.cat.name : 'Off the menu',
    movieId: found ? found.movie.id : uid(),
    catalogId: catalogId || (found && found.movie.catalogId) || null,
    title: found ? found.movie.title : String(title).trim(),
    year: found ? found.movie.year : yearVal,
    slotIndex: found ? found.index : null,
    date: date || new Date().toISOString(),
    rating: rating || 0,
    notes: notes || '',
    logged: true,
  };
  state.history.push(entry);
  state.history.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
  if (found && state.settings.slotMode === 'replace') found.cat.slots[found.index] = null;
  save();
  return { entry, found };
}

function logUnfiled({ title, year, catalogId, date, rating, notes }) {
  if (!String(title || '').trim()) return null;
  const y = parseInt(year, 10);
  const entry = {
    id: uid(),
    festivalId: NO_FEST,
    festivalName: NO_FEST_NAME,
    icon: NO_FEST_ICON,
    categoryId: OFF_MENU,
    categoryName: NO_FEST_NAME,
    movieId: uid(),
    catalogId: catalogId || null,
    title: String(title).trim(),
    year: Number.isFinite(y) && y > 1800 && y < 3000 ? y : null,
    slotIndex: null,
    date: date || new Date().toISOString(),
    rating: rating || 0,
    notes: notes || '',
    logged: true,
  };
  state.history.push(entry);
  state.history.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
  save();
  return { entry, found: null };
}

// Popcorn Pick: a random movie from the whole catalog. Not a festival, but it gets its own
// "Popcorn Pick" label in the watch history.
export const POPCORN = 'popcorn';
export const POPCORN_NAME = 'Popcorn Pick';

// moodList: the moods that were selected (empty = any).
export function addPopcornPick(movie, moodList = []) {
  const entry = {
    id: uid(),
    festivalId: POPCORN,
    festivalName: POPCORN_NAME,
    icon: 'popcorn',
    categoryId: 'popcorn-' + (moodList.length ? moodList.map(norm).join('-') : 'any'),
    categoryName: moodList.length ? `${moodList.join(' / ')} mood${moodList.length > 1 ? 's' : ''}` : 'Any mood',
    movieId: movie.id,
    catalogId: movie.id,
    title: movie.title,
    year: movie.releaseYear,
    slotIndex: null,
    date: new Date().toISOString(),
    rating: 0,
    notes: '',
  };
  state.history.unshift(entry);
  removeSaved(movie.id, true); // watched it, so it's no longer saved for later
  save();
  return entry;
}

// Save for Later (Popcorn Pick): up to SAVED_MAX movies kept for another night.
export const SAVED_MAX = 3;
export const savedPicks = () => state.savedPicks || [];
export const isSaved = (movieId) => savedPicks().some((s) => s.movieId === movieId);
export function savePick(movie, moodList = []) {
  if (isSaved(movie.id) || savedPicks().length >= SAVED_MAX) return false;
  state.savedPicks = [...savedPicks(), { movieId: movie.id, title: movie.title, year: movie.releaseYear, moods: moodList, date: new Date().toISOString() }];
  save();
  return true;
}
export function removeSaved(movieId, silent = false) {
  if (!isSaved(movieId)) return;
  state.savedPicks = savedPicks().filter((s) => s.movieId !== movieId);
  if (!silent) save();
}
// Moves a saved movie into the watch history as a Popcorn Pick.
export function watchSaved(movie) {
  const s = savedPicks().find((x) => x.movieId === movie.id);
  removeSaved(movie.id, true);
  return addPopcornPick(movie, s ? s.moods : []);
}

// Display name for a history group: festival name, Popcorn Pick, or a deleted festival.
export function historyGroupName(id) {
  if (id === POPCORN) return POPCORN_NAME;
  if (id === NO_FEST) return NO_FEST_NAME;
  const f = festival(id);
  if (f) return f.name;
  const e = state.history.find((x) => x.festivalId === id);
  return (e ? e.festivalName : 'Unknown') + ' (deleted)';
}

// scope: a festival id, or 'all'.
export function clearHistory(scope) {
  const before = state.history.length;
  state.history = scope === 'all' ? [] : state.history.filter((e) => e.festivalId !== scope);
  save();
  return before - state.history.length;
}

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

// ---------- Backup and reset ----------

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
