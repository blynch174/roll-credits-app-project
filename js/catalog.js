// The movie catalog (data/all_movies.json): search, title matching, and franchise lookups.
// Loaded in the background after the app starts. If it can't load (offline on first run),
// the app keeps working without autofind and sequel switching.

const CATALOG_URL = 'data/all_movies.json';

// Which collection file each built-in festival searches first.
const COLLECTIONS = {
  halloween: 'data/halloween_collection.json',
  christmas: 'data/christmas_collection.json',
  awards: 'data/roll_credits_oscars.json',
};

// Titles on the built-in tables (or older saved data) that are spelled differently in the catalog.
const ALIASES = {
  'santaclausthemovie|1985': 'santa-claus-1985',
  'drstrangelove|1964': 'dr-strangelove-or-how-i-learned-to-stop-worrying-and-love-the-bomb-1964',
  'deadalivebraindead|1992': 'dead-alive-1992',
};

let status = 'idle'; // idle | loading | ready | failed
let loading = null;
let byId = new Map();
let byKey = new Map(); // normalized title|year -> movie
let franchises = new Map(); // franchise -> movies sorted by seriesOrder
let list = [];
const collections = new Map(); // festival id -> Set of catalog ids
const readyCallbacks = [];

// "The Evil Dead" -> "evildead", so small spelling differences still match.
export function norm(s) {
  return String(s || '')
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/&/g, 'and')
    .replace(/^(the|a|an) /, '')
    .replace(/[^a-z0-9]/g, '');
}

export const isReady = () => status === 'ready';
export const get = (id) => byId.get(id) || null;

export function onReady(cb) {
  if (status === 'ready') cb();
  else readyCallbacks.push(cb);
}

export function load() {
  if (loading) return loading;
  status = 'loading';
  loading = fetch(CATALOG_URL)
    .then((res) => {
      if (!res.ok) throw new Error('catalog ' + res.status);
      return res.json();
    })
    .then((movies) => {
      list = movies;
      for (const m of movies) {
        m._t = norm(m.title);
        m._o = m.originalTitle ? norm(m.originalTitle) : '';
        byId.set(m.id, m);
        byKey.set(m._t + '|' + m.releaseYear, m);
        if (m._o) byKey.set(m._o + '|' + m.releaseYear, m);
        if (m.franchise) {
          if (!franchises.has(m.franchise)) franchises.set(m.franchise, []);
          franchises.get(m.franchise).push(m);
        }
      }
      for (const arr of franchises.values()) arr.sort((a, b) => (a.seriesOrder || 0) - (b.seriesOrder || 0));
      status = 'ready';
      readyCallbacks.splice(0).forEach((cb) => cb());
    })
    .catch(() => {
      status = 'failed';
      loading = null; // allow a retry later
    });
  return loading;
}

// Loads a festival's collection so its movies rank first in search.
export function loadCollection(festivalId) {
  const url = COLLECTIONS[festivalId];
  if (!url || collections.has(festivalId)) return Promise.resolve();
  collections.set(festivalId, new Set());
  return fetch(url)
    .then((r) => r.json())
    .then((c) => collections.set(festivalId, new Set(c.movieIds || [])))
    .catch(() => collections.delete(festivalId));
}

// Exact match on title + year (or a known alias). Returns a catalog movie or null.
export function match(title, year) {
  if (status !== 'ready' || !title) return null;
  const key = norm(title) + '|' + year;
  if (ALIASES[key]) return byId.get(ALIASES[key]) || null;
  return byKey.get(key) || null;
}

// Title search for autofind. Current festival's collection ranks first.
export function search(query, festivalId, limit = 6) {
  if (status !== 'ready') return [];
  const q = norm(query);
  if (q.length < 2) return [];
  const yearMatch = String(query).match(/\b(18|19|20)\d{2}\b/);
  const coll = collections.get(festivalId);
  const scored = [];
  for (const m of list) {
    let score = 0;
    for (const t of [m._t, m._o]) {
      if (!t) continue;
      if (t === q) score = Math.max(score, 100);
      else if (t.startsWith(q)) score = Math.max(score, 70);
      else if (t.includes(q)) score = Math.max(score, 40);
    }
    if (!score && yearMatch) {
      const qNoYear = norm(String(query).replace(yearMatch[0], ''));
      if (qNoYear.length >= 2 && (m._t.includes(qNoYear) || (m._o && m._o.includes(qNoYear)))) score = 40;
    }
    if (!score) continue;
    if (yearMatch && m.releaseYear === +yearMatch[0]) score += 30;
    if (coll && coll.has(m.id)) score += 25;
    scored.push([score, m]);
  }
  scored.sort((a, b) => b[0] - a[0] || a[1].title.length - b[1].title.length || a[1].releaseYear - b[1].releaseYear);
  return scored.slice(0, limit).map((x) => x[1]);
}

// Next entry in a movie's franchise that passes `isOpen` (unseen and not already on the tables).
export function nextInFranchise(catalogId, isOpen) {
  const m = byId.get(catalogId);
  if (!m || !m.franchise) return null;
  const arr = franchises.get(m.franchise) || [];
  const start = m.seriesOrder || 0;
  return arr.find((x) => (x.seriesOrder || 0) > start && isOpen(x)) || null;
}
