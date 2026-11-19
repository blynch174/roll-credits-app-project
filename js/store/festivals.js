// Festivals and their tables: finding them, editing slots and categories, changing dice, official (published)
// festivals, the Festival Library, and creating or deleting festivals.

import {
  BUILT_IN_FESTIVALS,
  buildBuiltInFestival,
  makeCategory,
  makeMovie,
  uid,
  SWATCHES,
  tablesSig,
  categoriesFromTables,
  festivalFromOfficial,
} from '../defaults.js';
import { DEFAULT_THEME } from '../themes.js';
import { cleanYear } from '../util.js';
import { state, save, saveState, currentDraft, isFreshInstall } from './state.js';
import { CUSTOM_FESTIVAL_LIMIT } from './constants.js';

// ---------- Lookups ----------

export const festivals = () => state.festivals;
// While an admin edits an official festival's draft, that draft is reachable by its id ('draft:halloween')
// so the normal table editing functions work on it.
export const festival = (id) => {
  const d = currentDraft();
  return d && d.id === id ? d : state.festivals.find((f) => f.id === id) || null;
};
export const activeFestival = () => state.festivals.find((f) => f.id === state.activeFestival) || state.festivals[0];
// The festival the Edit screen is showing: the draft when editing one, otherwise the active festival.
export const editFestival = () => currentDraft() || activeFestival();
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

// ---------- Editing tables ----------

export function setSlot(fId, catId, index, { title, year, catalogId = null }) {
  const cat = category(festival(fId), catId);
  if (!cat) return;
  const clean = String(title || '').trim();
  if (!clean) return;
  const yearVal = cleanYear(year);
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
      if (hit) {
        o.catalogId = hit.id;
        changed++;
      }
    }
  };
  for (const f of state.festivals) {
    for (const c of f.categories) {
      for (const m of c.slots) {
        upgrade(m);
        if (m && m.base) upgrade(m.base);
        if (m && !m.catalogId) {
          const hit = matchFn(m.title, m.year);
          if (hit) {
            m.catalogId = hit.id;
            changed++;
          }
        }
      }
    }
  }
  for (const e of state.history) {
    upgrade(e);
    if (!e.catalogId) {
      const hit = matchFn(e.title, e.year);
      if (hit) {
        e.catalogId = hit.id;
        changed++;
      }
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
  Object.assign(f, {
    mode: 'two',
    categoryDie: def.categoryDie,
    categories: fresh.categories,
    sourceRev: fresh.sourceRev,
    sourceSig: fresh.sourceSig,
  });
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
      applyOfficial(f.id, pub, pub.kind === 'version' && !isFreshInstall());
      changed = true;
    } else if (
      pub.kind === 'version' &&
      pub.rev > (f.dismissedRev || 0) &&
      (!f.announce || f.announce.rev !== pub.rev)
    ) {
      f.announce = { rev: pub.rev, message: pub.message || '', applied: false };
      changed = true;
    }
  }
  if (changed) saveState();
  return changed;
}

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

// Free accounts get CUSTOM_FESTIVAL_LIMIT festivals of their own; admins aren't limited.
const customFestivalCount = () => state.festivals.filter((f) => !f.builtIn).length;
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
