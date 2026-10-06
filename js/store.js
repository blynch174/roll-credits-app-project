// Everything about saving, loading, and changing the app's data lives here.
// The UI (app.js) calls these functions and then re-renders.

import { buildDefaultState, makeMovie, SLOTS_PER_CATEGORY } from './defaults.js';

const STORAGE_KEY = 'roll-credits:data';
const CURRENT_VERSION = 1;

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
  state = saved && isValid(saved) ? migrate(saved) : buildDefaultState();
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

export function canSave() {
  return storageWorks;
}

export function getState() {
  return state;
}

// Future data upgrades go here, one step per version.
function migrate(data) {
  // if (data.version === 1) { ...convert...; data.version = 2; }
  data.version = CURRENT_VERSION;
  return data;
}

function isValid(data) {
  return (
    data &&
    typeof data === 'object' &&
    typeof data.version === 'number' &&
    Array.isArray(data.menus) &&
    data.menus.length > 0 &&
    data.menus.every((m) => Array.isArray(m.categories)) &&
    data.season &&
    Array.isArray(data.season.watched) &&
    data.settings
  );
}

// ---------- Lookups ----------

export function activeMenu() {
  return state.menus.find((m) => m.id === state.activeMenu) || state.menus[0];
}

export function categories() {
  return activeMenu().categories;
}

export function categoryById(id) {
  return categories().find((c) => c.id === id) || null;
}

export function filledCount(cat) {
  return cat.slots.filter(Boolean).length;
}

// A category with no movies at all acts as the Wild Card.
export function isWild(cat) {
  return filledCount(cat) === 0;
}

export function watchedIds() {
  return new Set(state.season.watched.map((w) => w.movieId));
}

export function isWatched(movieId) {
  return state.season.watched.some((w) => w.movieId === movieId);
}

// Empty slots worth nagging about: inside categories that have at least one movie.
export function openSlots() {
  const out = [];
  for (const cat of categories()) {
    if (isWild(cat)) continue;
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

export function setSlot(catId, index, { title, year, vibe }) {
  const cat = categoryById(catId);
  if (!cat) return;
  const clean = String(title || '').trim();
  if (!clean) return;
  const y = parseInt(year, 10);
  const yearVal = Number.isFinite(y) && y > 1800 && y < 3000 ? y : null;
  const existing = cat.slots[index];
  if (existing && existing.title === clean) {
    // Same movie, just tidied up: keep its id so watched status sticks.
    existing.year = yearVal;
    existing.vibe = String(vibe || '').trim();
  } else {
    cat.slots[index] = makeMovie(clean, yearVal, String(vibe || '').trim());
  }
  save();
}

export function clearSlot(catId, index) {
  const cat = categoryById(catId);
  if (!cat) return;
  cat.slots[index] = null;
  save();
}

export function updateCategory(catId, { name, vibe, color }) {
  const cat = categoryById(catId);
  if (!cat) return;
  if (name !== undefined && String(name).trim()) cat.name = String(name).trim();
  if (vibe !== undefined) cat.vibe = String(vibe).trim();
  if (color !== undefined) cat.color = color;
  save();
}

export function shuffleCategory(catId, randInt) {
  const cat = categoryById(catId);
  if (!cat) return;
  const a = cat.slots;
  for (let i = a.length - 1; i > 0; i--) {
    const j = randInt(0, i);
    [a[i], a[j]] = [a[j], a[i]];
  }
  save();
}

export function clearCategory(catId) {
  const cat = categoryById(catId);
  if (!cat) return;
  cat.slots = Array.from({ length: SLOTS_PER_CATEGORY }, () => null);
  save();
}

// ---------- Watching ----------

export function watchMovie(catId, index) {
  const cat = categoryById(catId);
  const movie = cat && cat.slots[index];
  if (!movie) return null;
  const entry = {
    id: movie.id + ':' + Date.now(),
    movieId: movie.id,
    title: movie.title,
    year: movie.year,
    vibe: movie.vibe,
    categoryId: cat.id,
    categoryName: cat.name,
    slotIndex: index,
    date: new Date().toISOString(),
    rating: 0,
    notes: '',
  };
  state.season.watched.unshift(entry);
  // Replace mode: the slot opens up and shows in the "slots to fill" reminder.
  if (state.settings.slotMode === 'replace') cat.slots[index] = null;
  save();
  return entry;
}

export function updateWatched(entryId, { rating, notes }) {
  const e = state.season.watched.find((w) => w.id === entryId);
  if (!e) return;
  if (rating !== undefined) e.rating = rating;
  if (notes !== undefined) e.notes = notes;
  save();
}

// reason: 'unfinished' | 'hated' | 'mistake'
// Returns a short message for the UI to show, or ''.
export function removeWatched(entryId, reason) {
  const list = state.season.watched;
  const i = list.findIndex((w) => w.id === entryId);
  if (i === -1) return '';
  const entry = list[i];
  list.splice(i, 1);

  const cat = categoryById(entry.categoryId);
  let msg = '';

  if (reason === 'hated') {
    // Gone for good. If it's still sitting in a table, open its slot.
    if (cat) {
      const at = cat.slots.findIndex((s) => s && s.id === entry.movieId);
      if (at !== -1) cat.slots[at] = null;
    }
    msg = `${entry.title} is gone for good. Its slot is open.`;
  } else {
    // Unfinished or a mistake: put it back in the table if there's room.
    const stillThere = cat && cat.slots.some((s) => s && s.id === entry.movieId);
    if (!stillThere && cat) {
      if (!cat.slots[entry.slotIndex]) {
        cat.slots[entry.slotIndex] = {
          id: entry.movieId,
          title: entry.title,
          year: entry.year,
          vibe: entry.vibe,
        };
        msg = `${entry.title} is back in its slot.`;
      } else {
        msg = `Slot's already filled. Swap ${entry.title} back in manually if you want.`;
      }
    } else if (!cat) {
      msg = 'That category no longer exists.';
    } else {
      msg = `${entry.title} is back in the rotation.`;
    }
    if (reason === 'unfinished' && entry.notes && cat) {
      const m = cat.slots.find((s) => s && s.id === entry.movieId);
      if (m) m.note = entry.notes;
    }
  }
  save();
  return msg;
}

// ---------- Seasons, backup, reset ----------

export function newSeason() {
  state.season = { started: new Date().toISOString(), watched: [] };
  save();
}

export function resetToDefaults() {
  state = buildDefaultState();
  save();
}

export function exportJSON() {
  return JSON.stringify(state, null, 2);
}

// Returns true if the file was accepted.
export function importJSON(text) {
  let data;
  try {
    data = JSON.parse(text);
  } catch (e) {
    return false;
  }
  if (!isValid(data)) return false;
  state = migrate(data);
  save();
  return true;
}
