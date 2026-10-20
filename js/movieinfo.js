// Movie details from the catalog: posters (from TMDB's image server), IMDb/TMDB links, and the details sheet.
// Posters only exist after tools/catalog.py fetch has been run. Everything here hides itself when data is missing.

import * as catalog from './catalog.js';
import { esc, openSheet, closeSheet } from './ui.js';

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
        ${linksHTML(m)}
      </div>
    </div>
    ${m.overview ? `<p class="mi-overview">${esc(m.overview)}</p>` : ''}`;
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
