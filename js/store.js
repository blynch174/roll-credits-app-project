// All saved data and every change to it. The screens call these and then re-render.

import {
  BUILT_IN_FESTIVALS, buildBuiltInFestival, buildDefaultState, builtInCategories,
  makeCategory, makeMovie, uid, SWATCHES,
} from './defaults.js';

const STORAGE_KEY = 'roll-credits:data';
const CURRENT_VERSION = 2;

let state = null;
let storageWorks = true;

// ---------- Load / save ----------

export function load() {
  let saved = null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) saved = JSON.parse(raw);
  } catch (e) {
    storageWorks = false;
  }
  state = saved && looksValid(saved) ? migrate(saved) : buildDefaultState();
  save();
  return state;
}

export function save() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    storageWorks = true;
  } catch (e) {
    storageWorks = false;
  }
}

export const canSave = () => storageWorks;
export const getState = () => state;

function looksValid(d) {
  if (!d || typeof d !== 'object' || typeof d.version !== 'number') return false;
  if (d.version === 1) return Array.isArray(d.menus) && d.season && Array.isArray(d.season.watched);
  return Array.isArray(d.festivals) && Array.isArray(d.history) && !!d.settings;
}

// Upgrades older saved data one version at a time.
function migrate(d) {
  if (d.version === 1) d = migrateV1toV2(d);
  // Future: if (d.version === 2) d = migrateV2toV3(d);
  ensureBuiltIns(d);
  if (!d.festivals.some((f) => f.id === d.activeFestival)) d.activeFestival = d.festivals[0].id;
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

// New built-in festivals shipped in an update appear for existing users too.
function ensureBuiltIns(d) {
  for (const def of BUILT_IN_FESTIVALS) {
    if (!d.festivals.some((f) => f.id === def.id)) d.festivals.push(buildBuiltInFestival(def));
  }
}

// ---------- Lookups ----------

export const festivals = () => state.festivals;
export const festival = (id) => state.festivals.find((f) => f.id === id) || null;
export const activeFestival = () => festival(state.activeFestival) || state.festivals[0];

export function setActiveFestival(id) {
  if (!festival(id)) return;
  state.activeFestival = id;
  save();
}

export function category(f, catId) {
  return f.categories.find((c) => c.id === catId) || null;
}

export const filledCount = (cat) => cat.slots.filter(Boolean).length;

// In two-dice festivals, an empty category acts as the Wild Card.
export const isWild = (f, cat) => f.mode === 'two' && filledCount(cat) === 0;

// "Seen" only counts history from this festival since its last "Start fresh".
export function isSeen(f, movieId) {
  return state.history.some(
    (e) => e.festivalId === f.id && e.movieId === movieId && (!f.freshSince || e.date >= f.freshSince)
  );
}

export function seenIds(f) {
  return new Set(
    state.history
      .filter((e) => e.festivalId === f.id && (!f.freshSince || e.date >= f.freshSince))
      .map((e) => e.movieId)
  );
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

export function setSlot(fId, catId, index, { title, year }) {
  const cat = category(festival(fId), catId);
  if (!cat) return;
  const clean = String(title || '').trim();
  if (!clean) return;
  const y = parseInt(year, 10);
  const yearVal = Number.isFinite(y) && y > 1800 && y < 3000 ? y : null;
  const existing = cat.slots[index];
  if (existing && existing.title === clean) {
    existing.year = yearVal; // same movie tidied up: keep its id
  } else {
    cat.slots[index] = makeMovie(clean, yearVal);
  }
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

export function setFestivalTheme(fId, themeId) {
  const f = festival(fId);
  if (!f) return;
  f.theme = themeId;
  save();
}

export function updateFestivalLook(fId, { name, icon, accent }) {
  const f = festival(fId);
  if (!f || f.builtIn) return;
  if (name && name.trim()) f.name = name.trim();
  if (icon) f.icon = icon;
  if (accent) f.accent = accent;
  save();
}

// Clears Seen marks on the tables without touching history.
export function startFresh(fId) {
  const f = festival(fId);
  if (!f) return;
  f.freshSince = new Date().toISOString();
  save();
}

export function restoreBuiltIn(fId) {
  const f = festival(fId);
  const def = BUILT_IN_FESTIVALS.find((d) => d.id === fId);
  if (!f || !def) return;
  f.mode = 'two';
  f.categoryDie = def.categoryDie;
  f.categories = builtInCategories(def);
  save();
}

export function deleteFestival(fId) {
  const f = festival(fId);
  if (!f || f.builtIn) return;
  state.festivals = state.festivals.filter((x) => x.id !== fId);
  if (state.activeFestival === fId) state.activeFestival = state.festivals[0].id;
  save();
}

// opts: { name, icon, accent, base, mode, categoryDie, movieDie, copyFrom }
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
    accent: opts.accent,
    theme: opts.base === 'light' ? 'custom-light' : 'custom-dark',
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

// reason: 'unfinished' | 'hated' | 'mistake'. Returns a message for the UI.
export function removeEntry(id, reason) {
  const i = state.history.findIndex((e) => e.id === id);
  if (i === -1) return '';
  const e = state.history[i];
  state.history.splice(i, 1);
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

// scope: a festival id, or 'all'.
export function clearHistory(scope) {
  const before = state.history.length;
  state.history = scope === 'all' ? [] : state.history.filter((e) => e.festivalId !== scope);
  save();
  return before - state.history.length;
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
  state = migrate(d);
  save();
  return true;
}

export function resetAll() {
  state = buildDefaultState();
  save();
}
