// Checking, repairing, and upgrading saved data, whether it comes from this device, a backup file, or the
// account. Everything here is a plain function of the data: no saving, no screen updates.

import {
  BUILT_IN_FESTIVALS,
  STARTER_FESTIVALS,
  buildBuiltInFestival,
  buildDefaultState,
  BUNDLED_REV,
  tablesSig,
} from '../defaults.js';
import { themeFromOldFestival, isThemeId, retiredTheme } from '../themes.js';
import { SAVED_MAX } from './constants.js';

export const CURRENT_VERSION = 3;

export function looksValid(d) {
  if (!d || typeof d !== 'object' || typeof d.version !== 'number') return false;
  if (d.version === 1) return Array.isArray(d.menus) && d.season && Array.isArray(d.season.watched);
  return Array.isArray(d.festivals) && Array.isArray(d.history) && !!d.settings;
}

// Repairs data from outside this device (a backup file, the account) before it's used: drops entries that
// are broken, trims oversized text, and caps list sizes. Only applies to version 2+ data (version 1 is migrated).
const LIMITS = { festivals: 100, categories: 24, slots: 120, history: 50000, saved: SAVED_MAX, text: 300, notes: 4000 };
const str = (v, max = LIMITS.text) =>
  typeof v === 'string' ? v.slice(0, max) : v == null ? v : String(v).slice(0, max);
const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
function cleanMovie(m) {
  if (!isObj(m) || typeof m.title !== 'string' || !m.title.trim()) return null;
  m.title = str(m.title);
  if (m.note != null) m.note = str(m.note, LIMITS.notes);
  if (isObj(m.base)) m.base = cleanMovie(m.base);
  else delete m.base;
  if (!m.base) delete m.base;
  return m;
}
export function sanitize(d) {
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

// Upgrades older saved data one version at a time, then fills in anything newer versions expect.
export function migrate(d) {
  if (d.version === 1) d = migrateV1toV2(d);
  if (d.version === 2) d = migrateV2toV3(d);
  // Future: if (d.version === 3) d = migrateV3toV4(d);
  ensureBuiltIns(d);
  if (!d.festivals.length) {
    d.festivals = buildDefaultState().festivals;
    d.removedOfficial = [];
  }
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
  if (!isThemeId(d.settings.theme))
    d.settings.theme = themeFromOldFestival(d.festivals.find((f) => f.id === d.activeFestival));
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
      return m
        ? { id: m.id, title: m.title, year: m.year || null, catalogId: null, ...(m.note ? { note: m.note } : {}) }
        : null;
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
  for (const def of BUILT_IN_FESTIVALS)
    if (STARTER_FESTIVALS.includes(def.id)) d.festivals.push(buildBuiltInFestival(def));
}
