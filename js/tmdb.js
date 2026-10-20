// TMDB search through the relay (worker/, RELAY_SETUP.md). The app never holds the TMDB key itself.

import { TMDB_RELAY } from './appconfig.js';

export const available = () => !!TMDB_RELAY;

async function get(path) {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 9000);
  try {
    const res = await fetch(TMDB_RELAY + path, { signal: ctl.signal });
    if (!res.ok) throw new Error('relay ' + res.status);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

// Up to 10 matches: { tmdbId, title, originalTitle, releaseYear, posterPath, overview }
export async function search(query, year) {
  const q = encodeURIComponent(String(query).trim().slice(0, 100));
  const y = /^\d{4}$/.test(String(year || '')) ? `&year=${year}` : '';
  const d = await get(`/search?q=${q}${y}`);
  return d.results || [];
}

// One movie, shaped like a catalog movie, with id 'tmdb-<id>'.
export async function details(tmdbId) {
  const d = await get(`/movie/${encodeURIComponent(tmdbId)}`);
  return d.movie;
}
