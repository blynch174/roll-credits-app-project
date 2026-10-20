// Admin tools → Movie Requests: movies people picked from TMDB search. Approved ones are added to the catalog by
// the "Update movie catalog" GitHub Action (nightly, or on demand), with the moods picked here.

import * as cloud from '../cloud.js';
import * as catalog from '../catalog.js';
import { $, esc, toast } from '../ui.js';

const POSTER = 'https://image.tmdb.org/t/p/w92';
let requests = [];
let moodPick = new Map(); // request id -> Set of moods

const moodList = () => catalog.moodCounts().filter(([, n]) => n >= 10).map(([t]) => t).sort();

export async function renderRequestsSection() {
  const box = $('#requests-admin');
  if (!box) return;
  box.innerHTML = '<p class="hint">Loading…</p>';
  await catalog.load();
  try {
    requests = await cloud.listRequests();
  } catch (e) {
    box.innerHTML = `<p class="hint">${esc(cloud.errorText(e))}</p>`;
    return;
  }
  draw();
}

function draw() {
  const box = $('#requests-admin');
  if (!box) return;
  // Approved ones the catalog already has are done; hide them.
  const open = requests.filter((r) => r.status === 'pending');
  const waiting = requests.filter((r) => r.status === 'approved' && !catalog.byTmdbId(r.tmdbId));
  open.sort((a, b) => (b.count || 0) - (a.count || 0) || (a.firstAt || 0) - (b.firstAt || 0));
  const moods = moodList();
  const row = (r, pending) => {
    const picked = moodPick.get(r.id) || new Set(r.moods || []);
    moodPick.set(r.id, picked);
    return `
    <div class="card req-row" data-id="${esc(r.id)}">
      ${r.posterPath ? `<img class="af-poster" src="${POSTER}${esc(r.posterPath)}" alt="" loading="lazy">` : '<span class="af-poster"></span>'}
      <div class="req-main">
        <span class="req-title">${esc(r.title)}${r.year ? ` <span class="year">(${r.year})</span>` : ''}</span>
        <span class="req-sub">${r.count || 1} request${(r.count || 1) === 1 ? '' : 's'}${pending ? '' : ' · Approved'}</span>
        ${pending ? `<button type="button" class="req-mood-toggle" data-toggle="1">${picked.size ? `Moods: ${esc([...picked].join(', '))}` : '+ Moods'}</button>
        <div class="req-moods" hidden>${moods.map((m) => `<button type="button" data-mood="${esc(m)}" class="${picked.has(m) ? 'on' : ''}">${esc(m)}</button>`).join('')}</div>
        <div class="req-actions">
          <button type="button" class="btn primary small" data-act="approve">Approve</button>
          <button type="button" class="btn ghost small" data-act="reject">Reject</button>
        </div>` : `<div class="req-actions"><button type="button" class="btn ghost small" data-act="undo">Undo Approval</button></div>`}
      </div>
    </div>`;
  };
  box.innerHTML = `
    ${open.length ? `<div class="req-list">${open.map((r) => row(r, true)).join('')}</div>` : '<p class="hint">No requests right now.</p>'}
    ${waiting.length ? `<h3 class="sub-title">Approved</h3><div class="req-list">${waiting.map((r) => row(r, false)).join('')}</div>` : ''}`;
}

async function act(id, status) {
  const r = requests.find((x) => x.id === id);
  if (!r) return;
  const moods = [...(moodPick.get(id) || [])];
  try {
    await cloud.setRequest(id, { status, moods: status === 'approved' ? moods : r.moods || [] });
  } catch (e) {
    return toast(cloud.errorText(e));
  }
  r.status = status;
  if (status === 'approved') r.moods = moods;
  draw();
  toast(status === 'approved' ? `${r.title} approved.` : status === 'rejected' ? `${r.title} rejected.` : `${r.title} is back in requests.`);
}

export function initRequestsSection() {
  document.addEventListener('click', (e) => {
    const box = $('#requests-admin');
    if (!box || !box.contains(e.target)) return;
    const row = e.target.closest('.req-row');
    if (!row) return;
    const id = row.dataset.id;
    const mood = e.target.closest('[data-mood]');
    if (mood) {
      const set = moodPick.get(id) || new Set();
      set.has(mood.dataset.mood) ? set.delete(mood.dataset.mood) : set.add(mood.dataset.mood);
      moodPick.set(id, set);
      mood.classList.toggle('on', set.has(mood.dataset.mood));
      const t = row.querySelector('[data-toggle]');
      t.textContent = set.size ? `Moods: ${[...set].join(', ')}` : '+ Moods';
      return;
    }
    if (e.target.closest('[data-toggle]')) {
      const list = row.querySelector('.req-moods');
      list.hidden = !list.hidden;
      return;
    }
    const b = e.target.closest('[data-act]');
    if (!b) return;
    if (b.dataset.act === 'approve') act(id, 'approved');
    else if (b.dataset.act === 'reject') act(id, 'rejected');
    else act(id, 'pending');
  });
}
