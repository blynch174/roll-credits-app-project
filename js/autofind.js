// Autofind: catalog suggestions under a title box. Used by the slot editor and "Log a Movie".
// When the movie isn't in the catalog, "Search TMDB" looks it up through the relay (tmdb.js). Picking a TMDB
// movie saves it with the person's data (store.customMovies) and files a catalog request for admins to review.

import * as catalog from './catalog.js';
import * as store from './store.js';
import * as tmdb from './tmdb.js';
import * as sync from './sync.js';
import { $, esc } from './ui.js';

const POSTER = 'https://image.tmdb.org/t/p/w92';

// Markup to drop right after the title/year row.
export const autofindBox = () => '<div class="af-list" id="af-list" hidden></div>';

// Wires up suggestions. Returns get(commit): the chosen catalog id (or an exact match, or null).
// Call get(true) when saving: that's when a movie picked from TMDB is kept and requested.
export function attachAutofind(sheet, { festivalId, onPick } = {}) {
  const titleEl = $('#f-title', sheet);
  const yearEl = $('#f-year', sheet);
  const box = $('#af-list', sheet);
  let picked = null;
  let tmdbRun = 0; // ignores answers to searches that were replaced by newer typing

  catalog.loadCollection(festivalId);

  const tmdbRow = (q) => (tmdb.available() && q.length >= 2
    ? `<button type="button" class="af-item af-tmdb" data-tmdb-search="1">
        <span class="af-title">Search TMDB for “${esc(q)}”</span>
      </button>`
    : '');

  function show() {
    const q = titleEl.value.trim();
    if (picked && q !== picked.title) picked = null;
    tmdbRun++;
    if (picked || q.length < 2) { box.hidden = true; box.innerHTML = ''; return; }
    const results = catalog.search(q, festivalId);
    const rows = results.map((m) => `
      <button type="button" class="af-item" data-id="${esc(m.id)}">
        <span class="af-title">${esc(m.title)} <span class="year">(${m.releaseYear})</span></span>
        <span class="af-sub">${esc([m.originalTitle && m.originalTitle !== m.title ? m.originalTitle : '', (m.directors || []).join(', ')].filter(Boolean).join(' · '))}</span>
      </button>`).join('') + tmdbRow(q);
    box.innerHTML = rows;
    box.hidden = !rows;
  }

  async function searchTmdb() {
    const q = titleEl.value.trim();
    const run = ++tmdbRun;
    box.innerHTML = '<p class="af-note">Searching TMDB…</p>';
    box.hidden = false;
    let results;
    try {
      results = await tmdb.search(q, yearEl.value);
    } catch (e) {
      if (run === tmdbRun) box.innerHTML = `<p class="af-note">Couldn't reach TMDB. Check your connection and try again.</p>${tmdbRow(q)}`;
      return;
    }
    if (run !== tmdbRun) return;
    if (!results.length) {
      box.innerHTML = '<p class="af-note">Nothing on TMDB by that name. You can still save it as typed.</p>';
      return;
    }
    box.innerHTML = results.map((r) => {
      const inCat = catalog.byTmdbId(r.tmdbId);
      return `
      <button type="button" class="af-item af-hit" data-tmdb="${r.tmdbId}">
        ${r.posterPath ? `<img class="af-poster" src="${POSTER}${esc(r.posterPath)}" alt="" loading="lazy">` : '<span class="af-poster"></span>'}
        <span class="af-text">
          <span class="af-title">${esc(r.title)}${r.releaseYear ? ` <span class="year">(${r.releaseYear})</span>` : ''}</span>
          <span class="af-sub">${inCat ? 'In the catalog' : esc(r.overview || '')}</span>
        </span>
      </button>`;
    }).join('');
  }

  async function pickTmdb(tmdbId) {
    const inCat = catalog.byTmdbId(tmdbId);
    if (inCat) return choose(inCat);
    const run = ++tmdbRun;
    box.innerHTML = '<p class="af-note">Getting details…</p>';
    let m;
    try {
      m = await tmdb.details(tmdbId);
    } catch (e) {
      if (run === tmdbRun) box.innerHTML = "<p class=\"af-note\">Couldn't reach TMDB. Try again in a moment.</p>";
      return;
    }
    if (run !== tmdbRun || !m) return;
    choose(m);
  }

  function choose(m) {
    picked = m;
    titleEl.value = m.title;
    yearEl.value = m.releaseYear || '';
    box.hidden = true;
    box.innerHTML = '';
    onPick && onPick(m);
  }

  // Keep focus in the title box while tapping a suggestion.
  box.addEventListener('pointerdown', (e) => e.preventDefault());
  box.addEventListener('click', (e) => {
    const b = e.target.closest('.af-item');
    if (!b) return;
    if (b.dataset.tmdbSearch) return searchTmdb();
    if (b.dataset.tmdb) return pickTmdb(+b.dataset.tmdb);
    const m = catalog.get(b.dataset.id);
    if (m) choose(m);
  });
  titleEl.addEventListener('input', show);
  if (!catalog.isReady()) catalog.onReady(() => { if (document.activeElement === titleEl) show(); });

  return (commit = false) => {
    if (picked && titleEl.value.trim() === picked.title && String(yearEl.value || '') === String(picked.releaseYear || '')) {
      if (commit && String(picked.id).startsWith('tmdb-') && !catalog.byTmdbId(picked.tmdbId)) {
        store.addCustomMovie(picked);
        sync.requestMovie(picked);
      }
      return picked.id;
    }
    const hit = catalog.match(titleEl.value.trim(), parseInt(yearEl.value, 10));
    return hit ? hit.id : null;
  };
}
