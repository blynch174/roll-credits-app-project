// Movie details from the catalog: posters (from TMDB's image server), IMDb/TMDB links, and the details sheet.
// Posters only exist after tools/catalog.py fetch has been run. Everything here hides itself when data is missing.

import * as catalog from './catalog.js';
import { esc, openSheet, closeSheet } from './ui.js';
import { iconSVG } from './icons.js';
import * as sync from './sync.js';
import * as streaming from './streaming.js';

const IMG = 'https://image.tmdb.org/t/p/';

export function posterUrl(m, size = 'w342') {
  return m && m.posterPath ? IMG + size + m.posterPath : null;
}

// <img> that quietly disappears if it can't load (offline, missing poster).
export function posterImg(m, cls = 'poster', size = 'w342') {
  const url = posterUrl(m, size);
  return url ? `<img class="${cls}" src="${url}" alt="" loading="lazy" decoding="async" onerror="this.remove()">` : '';
}

export const tmdbUrl = (m) => (m && m.tmdbId ? `https://www.themoviedb.org/${m.tmdbType === 'tv' ? 'tv' : 'movie'}/${m.tmdbId}` : null);

export function linksHTML(m) {
  if (!m) return '';
  const imdb = m.imdbLink || (m.imdbId ? `https://www.imdb.com/title/${m.imdbId}/` : null);
  const tmdb = tmdbUrl(m);
  if (!imdb && !tmdb) return '';
  return `<p class="movie-links">
    ${imdb ? `<a class="mlink" href="${imdb}" target="_blank" rel="noopener">IMDb ↗</a>` : ''}
    ${tmdb ? `<a class="mlink" href="${tmdb}" target="_blank" rel="noopener">TMDB ↗</a>` : ''}
  </p>`;
}

export function metaLine(m) {
  return [m.releaseYear, m.runtimeMinutes ? `${m.runtimeMinutes} min` : '', m.contentRating].filter(Boolean).join(' · ');
}

// Scare factor: the catalog's 1–10 scariness as five skulls and a word. Hidden for movies that aren't scary.
const SCARE_WORDS = ['Mild', 'Spooky', 'Creepy', 'Scary', 'Terrifying'];

export function scareLevel(m) {
  const s = m && Number(m.scariness);
  if (!s || s < 2) return null;
  const skulls = Math.min(5, Math.ceil(s / 2));
  return { skulls, word: SCARE_WORDS[skulls - 1] };
}

export function scareHTML(m, cls = '') {
  const lv = scareLevel(m);
  if (!lv) return '';
  // Five skulls, one point = half a skull: 7 shows three and a half.
  const s = Math.min(10, Math.round(Number(m.scariness)));
  const svg = iconSVG('skull');
  let icons = '';
  for (let i = 1; i <= 5; i++) {
    if (s >= i * 2) icons += `<span class="sk on">${svg}</span>`;
    else if (s === i * 2 - 1) icons += `<span class="sk half">${svg}<span class="sk-fill">${svg}</span></span>`;
    else icons += `<span class="sk">${svg}</span>`;
  }
  return `<p class="scare ${cls}" aria-label="Scare factor ${s} out of 10: ${lv.word}"><span class="sk-row" aria-hidden="true">${icons}</span><span class="sk-word" aria-hidden="true">${lv.word}</span></p>`;
}

// ---------- Where to watch ----------
// Cards drop in a placeholder (watchSlot); fillWatch() fills every one on screen once the data has loaded.

export const watchSlot = (m, compact = false) =>
  (m && m.id ? `<div class="watch${compact ? ' compact' : ''}" data-watch-id="${esc(m.id)}"></div>` : '');

const initials = (name) => esc(name.replace(/[^A-Za-z0-9+ ]/g, '').split(' ').map((w) => w[0]).join('').slice(0, 2) || name.slice(0, 2));
// A logo that can't load turns into the service's initials.
const logoImg = (p, chip = false) => (p.logo ? (chip ? `<img src="${p.logo}" alt="" loading="lazy" onerror="this.remove()">` : `<img src="${p.logo}" alt="${initials(p.name)}" loading="lazy" onerror="this.replaceWith(this.alt)">`) : '');

function watchInner(m, compact) {
  const w = streaming.forMovie(m);
  if (!w) return '';
  const list = [...w.subs, ...w.free];
  const freeIds = new Set(w.free.map((p) => p.id));
  const mineIds = new Set(w.mine.map((p) => p.id));
  const none = w.rentBuy ? 'Not streaming · Rent or buy only' : 'Not streaming right now';
  if (compact) {
    if (!list.length) return `<p class="w-none">${none}</p>`;
    const shown = list.slice(0, 4);
    return `<div class="w-logos">${shown.map((p) => `<span class="w-logo${mineIds.has(p.id) ? ' mine' : ''}" title="${esc(p.name)}">${logoImg(p) || initials(p.name)}</span>`).join('')}${list.length > 4 ? `<span class="w-more">+${list.length - 4}</span>` : ''}</div>
      <p class="w-line">${w.mine.length ? `On your ${esc(w.mine.map((p) => p.name).slice(0, 2).join(' and '))}` : `On ${esc(list[0].name)}${list.length > 1 ? ` and ${list.length - 1} more` : ''}`}</p>`;
  }
  const chips = list.map((p) => `<a class="w-chip${mineIds.has(p.id) ? ' mine' : ''}" href="${w.link || '#'}" target="_blank" rel="noopener">${logoImg(p, true)}<span>${esc(p.name)}</span>${mineIds.has(p.id) ? '<small>Yours</small>' : freeIds.has(p.id) ? '<small>Free</small>' : ''}</a>`).join('');
  return `<span class="w-title">Where to Watch</span>
    ${list.length ? `<div class="w-row">${chips}</div>` : `<p class="w-none">${none}</p>`}
    <p class="w-credit">${w.link ? `<a href="${w.link}" target="_blank" rel="noopener">All options ↗</a> · ` : ''}Streaming data from JustWatch</p>`;
}

export function fillWatch(root = document) {
  if (!streaming.isReady()) return;
  root.querySelectorAll('.watch[data-watch-id]:not(.filled)').forEach((el) => {
    const m = catalog.get(el.dataset.watchId);
    el.innerHTML = watchInner(m, el.classList.contains('compact'));
    el.classList.add('filled');
    if (!el.innerHTML.trim()) el.hidden = true;
  });
}

// Refill after My Services changes.
export function refreshWatch() {
  document.querySelectorAll('.watch.filled').forEach((el) => el.classList.remove('filled'));
  fillWatch();
}

export function initWatchSlots() {
  streaming.load().then(() => fillWatch());
  catalog.onReady(() => fillWatch());
  new MutationObserver(() => fillWatch()).observe(document.body, { childList: true, subtree: true });
}

// Poster + facts + summary + links, for sheets.
export function infoBlock(m) {
  if (!m) return '';
  return `
    <div class="movie-info">
      ${posterImg(m, 'mi-poster', 'w185')}
      <div class="mi-text">
        <p class="mi-meta">${esc(metaLine(m))}</p>
        ${m.directors && m.directors.length ? `<p class="mi-dir">Directed by ${esc(m.directors.join(', '))}</p>` : ''}
        ${m.genres && m.genres.length ? `<p class="mi-dir">${esc(m.genres.slice(0, 3).join(' · '))}</p>` : ''}
        ${scareHTML(m, 'mi-scare')}
        ${linksHTML(m)}
        ${sync.isAdmin() && catalog.get(m.id) === m ? `<button type="button" class="link mi-edit" data-edit-movie="${esc(m.id)}">Edit Movie</button>` : ''}
      </div>
    </div>
    ${m.overview ? `<p class="mi-overview">${esc(m.overview)}</p>` : ''}
    ${watchSlot(m)}`;
}

// The catalog movie behind a table slot or history entry, if it's linked.
export const catalogMovie = (catalogId) => (catalogId ? catalog.get(catalogId) : null);

export function movieInfoSheet(m, onClose = null) {
  if (!m) return;
  openSheet({
    title: `${m.title} (${m.releaseYear})`,
    body: infoBlock(m),
    actions: [{ label: 'Close', kind: 'ghost', onClick: closeSheet }],
    onClose,
  });
}
