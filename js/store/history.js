// The watch history: watching a rolled movie, logging one by hand, Popcorn Picks, Save for Later,
// and editing or removing entries.

import { uid } from '../defaults.js';
import { norm } from '../catalog.js';
import { cleanYear, localDay, dayToISO } from '../util.js';
import { state, save, sortHistory } from './state.js';
import { festival, category } from './festivals.js';
import { OFF_MENU, NO_FEST, NO_FEST_NAME, NO_FEST_ICON, POPCORN, POPCORN_NAME, SAVED_MAX } from './constants.js';

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
  if (!e || !/^\d{4}-\d{2}-\d{2}$/.test(day) || localDay(e.date) === day) return;
  e.date = dayToISO(day);
  sortHistory();
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

// Finds the slot in a festival holding this movie (by catalog id, or title + year).
export function findSlot(f, { title, year, catalogId }) {
  const key = norm(title) + '|' + (year || '');
  for (const cat of f.categories) {
    const i = cat.slots.findIndex(
      (m) => m && ((catalogId && m.catalogId === catalogId) || norm(m.title) + '|' + (m.year || '') === key),
    );
    if (i !== -1) return { cat, index: i, movie: cat.slots[i] };
  }
  return null;
}

// Log a movie watched outside the app. If it's on the festival's tables, it's linked to that slot
// (marked Seen, or opened in Replace mode), just like watching it from a roll. festivalId NO_FEST logs it
// with no festival at all.
export function logMovie({ festivalId, title, year, catalogId, date, rating, notes }) {
  const name = String(title || '').trim();
  if (!name) return null;
  const yearVal = cleanYear(year);
  const f = festivalId === NO_FEST ? null : festival(festivalId);
  if (festivalId !== NO_FEST && !f) return null;
  const found = f ? findSlot(f, { title, year: yearVal, catalogId }) : null;
  const where = f
    ? { festivalId: f.id, festivalName: f.name, icon: f.icon, categoryName: found ? found.cat.name : 'Off the menu' }
    : { festivalId: NO_FEST, festivalName: NO_FEST_NAME, icon: NO_FEST_ICON, categoryName: NO_FEST_NAME };
  const entry = {
    id: uid(),
    ...where,
    categoryId: found ? found.cat.id : OFF_MENU,
    movieId: found ? found.movie.id : uid(),
    catalogId: catalogId || (found && found.movie.catalogId) || null,
    title: found ? found.movie.title : name,
    year: found ? found.movie.year : yearVal,
    slotIndex: found ? found.index : null,
    date: date || new Date().toISOString(),
    rating: rating || 0,
    notes: notes || '',
    logged: true,
  };
  state.history.push(entry);
  sortHistory();
  if (found && state.settings.slotMode === 'replace') found.cat.slots[found.index] = null;
  save();
  return { entry, found };
}

// Popcorn Pick: a random movie from the whole catalog. Not a festival, but it gets its own
// "Popcorn Pick" label in the watch history.

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
export const savedPicks = () => state.savedPicks || [];
export const isSaved = (movieId) => savedPicks().some((s) => s.movieId === movieId);
export function savePick(movie, moodList = []) {
  if (isSaved(movie.id) || savedPicks().length >= SAVED_MAX) return false;
  state.savedPicks = [
    ...savedPicks(),
    { movieId: movie.id, title: movie.title, year: movie.releaseYear, moods: moodList, date: new Date().toISOString() },
  ];
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
