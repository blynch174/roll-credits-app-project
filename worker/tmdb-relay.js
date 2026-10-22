// Roll Credits TMDB relay (Cloudflare Worker).
//
// The app can't hold the TMDB key (anything in a web page is public), so it asks this relay instead and the relay
// asks TMDB with the key, which is stored as a Cloudflare secret. It only does two things:
//   GET /search?q=Title[&year=1999]   up to 10 movies: id, title, year, poster, short overview
//   GET /movie/123                    one movie, shaped like a catalog movie (data/all_movies.json)
// It only answers the app's own site (ALLOWED_ORIGINS), caches answers for a day, and limits each visitor to
// RATE_LIMIT requests a minute. Deployed by .github/workflows/relay.yml (see RELAY_SETUP.md).

const TMDB = 'https://api.themoviedb.org/3';
const CACHE_SECONDS = 24 * 3600;
const COUNTRY_NAMES = { 'United States of America': 'United States' };
const GENRE_NAMES = { 'Science Fiction': 'Sci-Fi' };

const hits = new Map(); // ip -> { minute, n }. Per Worker instance, so approximate, which is fine here.

function allowedOrigin(req, env) {
  const origin = req.headers.get('Origin') || '';
  const list = String(env.ALLOWED_ORIGINS || '').split(',').map((s) => s.trim()).filter(Boolean);
  return list.includes(origin) ? origin : null;
}

function reply(body, status, origin, extra = {}) {
  return new Response(status === 204 ? null : JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Access-Control-Allow-Origin': origin || 'null',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Max-Age': '86400',
      Vary: 'Origin',
      ...extra,
    },
  });
}

function limited(req, env) {
  const ip = req.headers.get('CF-Connecting-IP') || 'unknown';
  const minute = Math.floor(Date.now() / 60000);
  const h = hits.get(ip);
  if (!h || h.minute !== minute) {
    hits.set(ip, { minute, n: 1 });
    if (hits.size > 5000) hits.clear();
    return false;
  }
  h.n += 1;
  return h.n > (Number(env.RATE_LIMIT) || 60);
}

async function tmdb(path, params, env) {
  const url = new URL((env.TMDB_API_BASE || TMDB) + path);
  for (const [k, v] of Object.entries(params || {})) if (v !== undefined && v !== '') url.searchParams.set(k, v);
  // Works with either TMDB credential: the long "API Read Access Token" (eyJ…) or the short "API Key".
  const token = String(env.TMDB_TOKEN || '').trim();
  const headers = { Accept: 'application/json' };
  if (token.startsWith('eyJ')) headers.Authorization = `Bearer ${token}`;
  else url.searchParams.set('api_key', token);
  const get = () => fetch(url, { headers });
  let res = await get();
  if (res.status === 429) { // TMDB's rate limit: wait a moment and try once more
    await new Promise((r) => setTimeout(r, 1000));
    res = await get();
  }
  if (res.status === 404) return null;
  if (!res.ok) throw new Error('tmdb ' + res.status);
  return res.json();
}

const yearOf = (d) => (d ? parseInt(String(d).slice(0, 4), 10) || null : null);

function trim(text, n = 420) {
  text = (text || '').trim();
  if (text.length <= n) return text || null;
  const cut = text.slice(0, n);
  return cut.slice(0, cut.lastIndexOf(' ')).replace(/[,;:.]+$/, '') + '…';
}

function usRating(releaseDates) {
  for (const r of (releaseDates && releaseDates.results) || []) {
    if (r.iso_3166_1 !== 'US') continue;
    const certs = (r.release_dates || []).filter((d) => d.certification);
    certs.sort((a, b) => (a.type !== 3) - (b.type !== 3) || String(a.release_date || '').localeCompare(String(b.release_date || '')));
    if (certs.length) return certs[0].certification;
  }
  return null;
}

async function search(q, year, env) {
  const d = await tmdb('/search/movie', { query: q, year, include_adult: 'false' }, env);
  return ((d && d.results) || []).slice(0, 10).map((m) => ({
    tmdbId: m.id,
    title: m.title,
    originalTitle: m.original_title && m.original_title !== m.title ? m.original_title : null,
    releaseYear: yearOf(m.release_date),
    posterPath: m.poster_path || null,
    overview: trim(m.overview, 160),
  }));
}

async function movie(id, env) {
  const d = await tmdb(`/movie/${id}`, { append_to_response: 'release_dates,credits,external_ids,keywords' }, env);
  if (!d) return null;
  const imdbId = (d.external_ids && d.external_ids.imdb_id) || d.imdb_id || null;
  return {
    id: `tmdb-${d.id}`,
    tmdbId: d.id,
    tmdbType: 'movie',
    imdbId,
    imdbLink: imdbId ? `https://www.imdb.com/title/${imdbId}/` : null,
    title: d.title,
    originalTitle: d.original_title && d.original_title !== d.title ? d.original_title : null,
    releaseYear: yearOf(d.release_date),
    type: 'Feature Film',
    runtimeMinutes: d.runtime || null,
    contentRating: usRating(d.release_dates),
    countries: (d.production_countries || []).map((c) => COUNTRY_NAMES[c.name] || c.name),
    languages: (d.spoken_languages || []).map((l) => l.english_name || l.name),
    genres: (d.genres || []).map((g) => GENRE_NAMES[g.name] || g.name),
    directors: ((d.credits && d.credits.crew) || []).filter((c) => c.job === 'Director').map((c) => c.name),
    posterPath: d.poster_path || null,
    overview: trim(d.overview),
    moodTone: [],
    keywords: ((d.keywords && d.keywords.keywords) || []).slice(0, 40).map((k) => k.name), // used to suggest moods
  };
}

// GET /health (open in a browser): is the relay up, does it have a key, and does TMDB accept it?
// Shows no secrets.
async function health(env) {
  const out = { relay: 'ok', keySet: !!env.TMDB_TOKEN, tmdb: 'not checked', allowedOrigins: env.ALLOWED_ORIGINS || '' };
  if (!env.TMDB_TOKEN) return out;
  try {
    await tmdb('/configuration', {}, env);
    out.tmdb = 'ok';
  } catch (e) {
    out.tmdb = String(e.message || e).replace('tmdb ', 'TMDB answered ');
    if (/401/.test(out.tmdb)) out.tmdb += ' (the TMDB_TOKEN secret is wrong)';
  }
  return out;
}

export default {
  async fetch(req, env, ctx) {
    if (new URL(req.url).pathname === '/health') {
      return new Response(JSON.stringify(await health(env), null, 2), { headers: { 'Content-Type': 'application/json; charset=utf-8' } });
    }
    const origin = allowedOrigin(req, env);
    if (req.method === 'OPTIONS') return origin ? reply({}, 204, origin) : reply({ error: 'forbidden' }, 403, null);
    if (req.method !== 'GET') return reply({ error: 'method' }, 405, origin);
    if (!origin) return reply({ error: 'forbidden' }, 403, null);
    if (!env.TMDB_TOKEN) return reply({ error: 'not configured' }, 500, origin);
    if (limited(req, env)) return reply({ error: 'slow down' }, 429, origin, { 'Retry-After': '60' });

    const url = new URL(req.url);
    let key; // normalized cache key, independent of origin
    let work;
    const m = url.pathname.match(/^\/movie\/(\d{1,9})$/);
    if (url.pathname === '/search') {
      const q = (url.searchParams.get('q') || '').trim().slice(0, 100);
      const y = (url.searchParams.get('year') || '').match(/^\d{4}$/) ? url.searchParams.get('year') : '';
      if (q.length < 2) return reply({ results: [] }, 200, origin);
      key = `search:${q.toLowerCase()}:${y}`;
      work = async () => ({ results: await search(q, y, env) });
    } else if (m) {
      key = `movie2:${m[1]}`; // movie2: answers include keywords
      work = async () => {
        const mv = await movie(m[1], env);
        return mv ? { movie: mv } : null;
      };
    } else {
      return reply({ error: 'not found' }, 404, origin);
    }

    const cache = typeof caches !== 'undefined' ? caches.default : null;
    const cacheReq = new Request('https://cache.roll-credits/' + encodeURIComponent(key));
    if (cache) {
      const hit = await cache.match(cacheReq);
      if (hit) return reply(await hit.json(), 200, origin);
    }
    let body;
    try {
      body = await work();
    } catch (e) {
      return reply({ error: 'tmdb unavailable' }, 502, origin);
    }
    if (!body) return reply({ error: 'not found' }, 404, origin);
    if (cache) {
      const stored = new Response(JSON.stringify(body), { headers: { 'Cache-Control': `max-age=${CACHE_SECONDS}` } });
      const put = cache.put(cacheReq, stored);
      if (ctx && ctx.waitUntil) ctx.waitUntil(put);
    }
    return reply(body, 200, origin);
  },
};
