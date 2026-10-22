// Admin Tools → Movie Manager: Pending, Approved, Rejected, and Add New.
// Approved movies (from requests or added here) join the catalog when the "Update movie catalog" GitHub
// Action runs next (every push and nightly).

import * as cloud from '../cloud.js';
import * as catalog from '../catalog.js';
import * as tmdb from '../tmdb.js';
import { suggestMoods } from '../moodmatch.js';
import { $, $$, esc, toast } from '../ui.js';

const POSTER = 'https://image.tmdb.org/t/p/w92';
const TITLES = { movies: 'Movie Manager', 'movies:pending': 'Pending', 'movies:approved': 'Approved', 'movies:rejected': 'Rejected', 'movies:add': 'Add New' };

let requests = null; // null = not loaded
let moodPick = new Map(); // movie id -> Set of moods chosen on screen
let suggested = new Map(); // movie id -> moods suggested from TMDB
let addState = { q: '', results: null, picked: null, busy: false };
let go = () => {};

export const moviesTitle = (v) => TITLES[v] || 'Movie Manager';
export const moviesParent = () => 'movies';

const moodList = () => catalog.moodCounts().filter(([, n]) => n >= 10).map(([t]) => t).sort();
const poster = (p) => (p ? `<img class="af-poster" src="${POSTER}${esc(p)}" alt="" loading="lazy">` : '<span class="af-poster"></span>');

async function load(force = false) {
  if (requests && !force) return requests;
  requests = await cloud.listRequests();
  return requests;
}

export async function pendingCount() {
  try {
    return (await load(true)).filter((r) => r.status === 'pending').length;
  } catch (e) {
    return 0;
  }
}

export async function renderMovies(root, view, goFn) {
  go = goFn;
  root.onclick = null;
  if (view === 'movies:add') return renderAdd(root);
  root.innerHTML = '<p class="hint">Loading…</p>';
  await catalog.load();
  try {
    await load(view === 'movies');
  } catch (e) {
    root.innerHTML = `<p class="hint">${esc(cloud.errorText(e))}</p>`;
    return;
  }
  if (view === 'movies') return renderMenu(root);
  renderList(root, view.slice(7));
}

function renderMenu(root) {
  const n = (s) => requests.filter((r) => r.status === s).length;
  const waiting = requests.filter((r) => r.status === 'approved' && !catalog.byTmdbId(r.tmdbId)).length;
  root.innerHTML = `
    <div class="card settings-list">
      <button type="button" class="row-btn" data-go="movies:pending"><span>Pending</span><small>${n('pending')}</small></button>
      <button type="button" class="row-btn" data-go="movies:approved"><span>Approved</span><small>${n('approved')}${waiting ? ` · ${waiting} waiting for the next catalog update` : ''}</small></button>
      <button type="button" class="row-btn" data-go="movies:rejected"><span>Rejected</span><small>${n('rejected')}</small></button>
      <button type="button" class="row-btn" data-go="movies:add"><span>Add New</span></button>
    </div>`;
  $$('[data-go]', root).forEach((b) => b.addEventListener('click', () => go(b.dataset.go)));
}

// ---------- Pending / Approved / Rejected ----------

function moodChips(id, chosen) {
  return `<div class="req-moods" data-for="${esc(id)}">${moodList().map((m) => `<button type="button" data-mood="${esc(m)}" class="${chosen.has(m) ? 'on' : ''}${(suggested.get(id) || []).includes(m) ? ' sug' : ''}">${esc(m)}</button>`).join('')}</div>`;
}

function renderList(root, status) {
  let list = requests.filter((r) => r.status === status);
  if (status === 'pending') list.sort((a, b) => (b.count || 0) - (a.count || 0) || (a.firstAt || 0) - (b.firstAt || 0));
  else list.sort((a, b) => (b.reviewedAt || 0) - (a.reviewedAt || 0));
  if (status !== 'pending') list = list.slice(0, 100);
  if (!list.length) {
    root.innerHTML = `<p class="hint">${status === 'pending' ? 'No requests right now.' : 'Nothing here.'}</p>`;
    return;
  }
  root.innerHTML = `<div class="req-list">${list.map((r) => {
    const chosen = moodPick.get(r.id) || new Set(r.moods || []);
    moodPick.set(r.id, chosen);
    const inCat = !!catalog.byTmdbId(r.tmdbId);
    const sub = status === 'pending'
      ? `${r.count || 1} request${(r.count || 1) === 1 ? '' : 's'}`
      : status === 'approved'
        ? `${inCat ? 'In the catalog' : 'Joins the catalog on the next update'}${r.addedByAdmin ? ' · Added by an admin' : ''}${(r.moods || []).length ? ` · ${r.moods.join(', ')}` : ''}`
        : `${r.count || 1} request${(r.count || 1) === 1 ? '' : 's'}`;
    const actions = status === 'pending'
      ? `<button type="button" class="btn primary small" data-act="approved">Approve</button><button type="button" class="btn ghost small" data-act="rejected">Reject</button>`
      : status === 'approved'
        ? (inCat ? '' : '<button type="button" class="btn ghost small" data-act="pending">Undo Approval</button>')
        : '<button type="button" class="btn primary small" data-act="approved">Approve</button><button type="button" class="btn ghost small" data-act="pending">Back to Pending</button>';
    return `
    <div class="card req-row" data-id="${esc(r.id)}">
      ${poster(r.posterPath)}
      <div class="req-main">
        <span class="req-title">${esc(r.title)}${r.year ? ` <span class="year">(${r.year})</span>` : ''}</span>
        <span class="req-sub">${esc(sub)}</span>
        ${status !== 'approved' ? `<button type="button" class="req-mood-toggle" data-toggle="1">${chosen.size ? `Moods: ${esc([...chosen].join(', '))}` : '+ Moods'}</button>
        ${moodChips(r.id, chosen).replace('class="req-moods"', 'class="req-moods" hidden')}` : ''}
        ${actions ? `<div class="req-actions">${actions}</div>` : ''}
      </div>
    </div>`;
  }).join('')}</div>`;
  wireRows(root, status);
}

function wireRows(root, status) {
  root.onclick = async (e) => {
    const row = e.target.closest('.req-row');
    if (!row) return;
    const id = row.dataset.id;
    const mood = e.target.closest('[data-mood]');
    if (mood) return toggleMood(row, id, mood);
    if (e.target.closest('[data-toggle]')) {
      const box = row.querySelector('.req-moods');
      box.hidden = !box.hidden;
      if (!box.hidden && !suggested.has(id)) suggestFor(row, id);
      return;
    }
    const b = e.target.closest('[data-act]');
    if (!b) return;
    const r = requests.find((x) => x.id === id);
    const to = b.dataset.act;
    const moods = to === 'approved' ? [...(moodPick.get(id) || [])] : r.moods || [];
    b.disabled = true;
    try {
      await cloud.setRequest(id, { status: to, moods });
    } catch (err) {
      b.disabled = false;
      return toast(cloud.errorText(err));
    }
    Object.assign(r, { status: to, moods, reviewedAt: Date.now() });
    toast(to === 'approved' ? `${r.title} approved.` : to === 'rejected' ? `${r.title} rejected.` : `${r.title} is back in Pending.`);
    renderList(root, status);
  };
}

function toggleMood(row, id, btn) {
  const set = moodPick.get(id) || new Set();
  const m = btn.dataset.mood;
  if (set.has(m)) set.delete(m); else set.add(m);
  moodPick.set(id, set);
  btn.classList.toggle('on', set.has(m));
  const t = row.querySelector('[data-toggle]');
  if (t) t.textContent = set.size ? `Moods: ${[...set].join(', ')}` : '+ Moods';
}

// Looks the movie up on TMDB and pre-selects matching moods (only if none are chosen yet).
async function suggestFor(row, id) {
  if (!tmdb.available()) return;
  let m;
  try {
    m = await tmdb.details(id);
  } catch (e) {
    return;
  }
  const sug = suggestMoods(m, moodList());
  suggested.set(id, sug);
  const set = moodPick.get(id) || new Set();
  if (!set.size) sug.forEach((x) => set.add(x));
  moodPick.set(id, set);
  if (!row.isConnected) return;
  row.querySelectorAll('[data-mood]').forEach((b) => {
    b.classList.toggle('on', set.has(b.dataset.mood));
    b.classList.toggle('sug', sug.includes(b.dataset.mood));
  });
  const t = row.querySelector('[data-toggle]');
  if (t) t.textContent = set.size ? `Moods: ${[...set].join(', ')}` : '+ Moods';
}

// ---------- Add New ----------

function renderAdd(root) {
  if (!requests) load().catch(() => {});
  catalog.load();
  if (!tmdb.available()) {
    root.innerHTML = '<p class="hint">Needs the TMDB relay (TMDB_RELAY in js/firebase-config.js).</p>';
    return;
  }
  const p = addState.picked;
  if (p) {
    const chosen = moodPick.get(String(p.tmdbId)) || new Set();
    root.innerHTML = `
      <div class="card add-pick">
        <div class="movie-info">
          ${p.posterPath ? `<img class="mi-poster" src="https://image.tmdb.org/t/p/w185${esc(p.posterPath)}" alt="">` : ''}
          <div class="mi-text">
            <p class="req-title">${esc(p.title)}${p.releaseYear ? ` <span class="year">(${p.releaseYear})</span>` : ''}</p>
            <p class="mi-meta">${esc([p.runtimeMinutes ? `${p.runtimeMinutes} min` : '', p.contentRating, (p.genres || []).slice(0, 3).join(' · ')].filter(Boolean).join(' · '))}</p>
            ${(p.directors || []).length ? `<p class="mi-dir">Directed by ${esc(p.directors.join(', '))}</p>` : ''}
          </div>
        </div>
        ${p.overview ? `<p class="mi-overview">${esc(p.overview)}</p>` : ''}
      </div>
      <h2 class="section-title">Moods</h2>
      ${moodChips(String(p.tmdbId), chosen)}
      <div class="add-actions">
        <button type="button" class="btn ghost big" id="add-back">Back</button>
        <button type="button" class="btn primary big" id="add-go">Add to Catalog</button>
      </div>`;
    $('.req-moods', root).addEventListener('click', (e) => {
      const b = e.target.closest('[data-mood]'); if (!b) return;
      const set = moodPick.get(String(p.tmdbId)) || new Set();
      if (set.has(b.dataset.mood)) set.delete(b.dataset.mood); else set.add(b.dataset.mood);
      moodPick.set(String(p.tmdbId), set);
      b.classList.toggle('on', set.has(b.dataset.mood));
    });
    $('#add-back', root).addEventListener('click', () => { addState.picked = null; renderAdd(root); });
    $('#add-go', root).addEventListener('click', async (e) => {
      const btn = e.currentTarget;
      btn.disabled = true;
      btn.textContent = 'Adding…';
      const moods = [...(moodPick.get(String(p.tmdbId)) || [])];
      try {
        await cloud.adminAddMovie(p, moods);
      } catch (err) {
        btn.disabled = false;
        btn.textContent = 'Add to Catalog';
        return toast(cloud.errorText(err));
      }
      requests = null;
      toast(`${p.title} added. It joins the catalog on the next update.`);
      addState = { q: '', results: null, picked: null, busy: false };
      renderAdd(root);
    });
    return;
  }
  root.innerHTML = `
    <form class="add-search" id="add-form" autocomplete="off">
      <input type="search" id="add-q" placeholder="Search TMDB" value="${esc(addState.q)}">
      <button type="submit" class="btn primary small">Search</button>
    </form>
    <div id="add-results">${resultsHTML()}</div>`;
  $('#add-form', root).addEventListener('submit', async (e) => {
    e.preventDefault();
    const q = $('#add-q', root).value.trim();
    if (q.length < 2) return;
    addState.q = q;
    $('#add-results', root).innerHTML = '<p class="hint">Searching…</p>';
    try {
      addState.results = await tmdb.search(q.replace(/\s*\(?\b(18|19|20)\d{2}\)?\s*$/, ''), (q.match(/\b(18|19|20)\d{2}\b/) || [])[0]);
    } catch (err) {
      addState.results = null;
      $('#add-results', root).innerHTML = "<p class=\"hint\">Couldn't reach TMDB.</p>";
      return;
    }
    $('#add-results', root).innerHTML = resultsHTML();
  });
  $('#add-results', root).addEventListener('click', async (e) => {
    const b = e.target.closest('[data-tmdb]');
    if (!b || addState.busy) return;
    const id = +b.dataset.tmdb;
    if (catalog.byTmdbId(id)) return toast('Already in the catalog.');
    addState.busy = true;
    b.classList.add('loading');
    let m;
    try {
      m = await tmdb.details(id);
    } catch (err) {
      addState.busy = false;
      b.classList.remove('loading');
      return toast("Couldn't reach TMDB.");
    }
    addState.busy = false;
    const sug = suggestMoods(m, moodList());
    suggested.set(String(id), sug);
    if (!moodPick.has(String(id))) moodPick.set(String(id), new Set(sug));
    addState.picked = m;
    renderAdd(root);
    window.scrollTo(0, 0);
  });
}

function resultsHTML() {
  const res = addState.results;
  if (!res) return '';
  if (!res.length) return '<p class="hint">Nothing on TMDB by that name.</p>';
  const status = (id) => {
    if (catalog.byTmdbId(id)) return 'In the catalog';
    const r = (requests || []).find((x) => +x.id === id);
    return r ? { pending: 'Requested', approved: 'Approved', rejected: 'Rejected' }[r.status] || '' : '';
  };
  return `<div class="af-list add-list">${res.map((r) => `
    <button type="button" class="af-item af-hit" data-tmdb="${r.tmdbId}">
      ${poster(r.posterPath)}
      <span class="af-text">
        <span class="af-title">${esc(r.title)}${r.releaseYear ? ` <span class="year">(${r.releaseYear})</span>` : ''}</span>
        <span class="af-sub">${esc(status(r.tmdbId) || r.overview || '')}</span>
      </span>
    </button>`).join('')}</div>`;
}
