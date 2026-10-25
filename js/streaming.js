// Where to watch: subscription and free services for catalog movies, from data/streaming/<REGION>.json.
// The nightly catalog update fills that file from TMDB's watch providers (data from JustWatch).
// "My Services" (Settings) is optional: once someone picks their services, their matches are marked and
// Popcorn Pick can stick to them.

import * as store from './store.js';

export const REGION = 'US'; // one place to change, or to read from a setting later
const LOGO = 'https://image.tmdb.org/t/p/w92';

let data = null; // { providers: {id: {n, l, p}}, movies: {movieId: {s, f, rb}} }
let loading = null;
const readyCallbacks = [];

export function load() {
  if (data) return Promise.resolve(data);
  if (loading) return loading;
  loading = fetch(`data/streaming/${REGION}.json`)
    .then((r) => (r.ok ? r.json() : null))
    .then((d) => {
      data = d && d.movies ? d : { providers: {}, movies: {} };
      readyCallbacks.splice(0).forEach((cb) => cb());
      return data;
    })
    .catch(() => { loading = null; return null; });
  return loading;
}
export const isReady = () => !!data;
export function onReady(cb) { if (data) cb(); else readyCallbacks.push(cb); }
export const hasData = () => !!(data && Object.keys(data.movies).length);

const provider = (id) => {
  const p = data && data.providers[String(id)];
  return p ? { id: +id, name: p.n, logo: p.l ? LOGO + p.l : null, priority: p.p } : null;
};

// Every service in the file, most popular first (for the My Services picker).
export function allProviders() {
  if (!data) return [];
  return Object.keys(data.providers).map(provider).filter(Boolean).sort((a, b) => a.priority - b.priority || a.name.localeCompare(b.name));
}

export const myServices = () => {
  const v = store.getState().settings.myServices;
  return Array.isArray(v) ? v.map(Number) : [];
};

// For one catalog movie: null when there's no data for it (not loaded, or not a catalog movie).
export function forMovie(m) {
  if (!data || !m || !m.id) return null;
  const rec = data.movies[m.id];
  const mine = new Set(myServices());
  if (!rec) return { subs: [], free: [], rentBuy: false, mine: [], link: watchLink(m) };
  const subs = (rec.s || []).map(provider).filter(Boolean);
  const free = (rec.f || []).map(provider).filter(Boolean);
  const all = [...subs, ...free];
  const order = (list) => list.sort((a, b) => (mine.has(b.id) - mine.has(a.id)) || a.priority - b.priority);
  return { subs: order(subs), free: order(free), rentBuy: !!rec.rb, mine: all.filter((p) => mine.has(p.id)), link: watchLink(m) };
}

// On one of this person's services? (Popcorn Pick's "My Services" filter.)
export function onMyServices(m) {
  const mine = myServices();
  const rec = data && m && data.movies[m.id];
  if (!rec || !mine.length) return false;
  return [...(rec.s || []), ...(rec.f || [])].some((id) => mine.includes(id));
}

export const watchLink = (m) => (m && m.tmdbId && m.tmdbType !== 'tv' ? `https://www.themoviedb.org/movie/${m.tmdbId}/watch?locale=${REGION}` : null);
