// Festival Library: every official festival, on shelves by type. My Festivals (the Roll screen's festival menu)
// only holds the ones a person has added. Empty shelves say "Coming Soon!" until an admin puts a festival there.

import * as store from '../store.js';
import * as official from '../official.js';
import { BUILT_IN_FESTIVALS, SHELVES } from '../defaults.js';
import { iconSVG } from '../icons.js';
import { $, $$, esc, toast, nav, openSheet, closeSheet } from '../ui.js';
import { resetRoll } from './roll.js';

let query = '';

const norm = (s) => String(s || '').toLowerCase();

// Bundled festivals plus published ones (the published version wins; hidden ones stay out).
export function libraryEntries() {
  const byId = new Map();
  for (const d of BUILT_IN_FESTIVALS) {
    byId.set(d.id, {
      id: d.id, name: d.name, icon: d.icon, shelf: d.shelf || '', blurb: d.blurb || '', pub: null,
      cats: d.categories.map(([name, , movies, die]) => ({ name, n: (movies || []).length || die || d.movieDie })),
    });
  }
  for (const p of official.published()) {
    const base = byId.get(p.id);
    if (p.hidden) { byId.delete(p.id); continue; }
    const cats = (p.tables && p.tables.categories ? p.tables.categories : []).map((c) => ({ name: c.name, n: (c.slots || []).filter(Boolean).length }));
    byId.set(p.id, {
      id: p.id, name: p.name, icon: p.icon, pub: p,
      shelf: p.shelf || (base && base.shelf) || '', blurb: p.blurb || (base && base.blurb) || '', cats,
    });
  }
  return [...byId.values()];
}

const movieCount = (e) => e.cats.reduce((a, c) => a + c.n, 0);
const meta = (e) => `${e.cats.length} ${e.cats.length === 1 ? 'list' : 'categories'} · ${movieCount(e)} movies`;

export function renderLibrary() {
  const box = $('#library');
  const entries = libraryEntries();
  const seen = new Set(store.librarySeen());
  const q = norm(query.trim());
  const matches = (e) => !q || norm(e.name).includes(q) || norm(e.blurb).includes(q) || e.cats.some((c) => norm(c.name).includes(q));
  const card = (e) => {
    const added = !!store.festival(e.id);
    return `
      <button type="button" class="lib-card${added ? ' added' : ''}" data-id="${esc(e.id)}">
        <span class="lib-top">
          <span class="fest-icon">${iconSVG(e.icon)}</span>
          ${added ? '<span class="lib-badge added">Added ✓</span>' : !seen.has(e.id) ? '<span class="lib-badge new">New</span>' : ''}
        </span>
        <span class="lib-name">${esc(e.name)}</span>
        <span class="lib-blurb">${esc(e.blurb)}</span>
        <span class="lib-meta">${esc(meta(e))}</span>
      </button>`;
  };
  const known = new Set(SHELVES.map((s) => s.id));
  const shelves = [...SHELVES, { id: '', name: 'More Festivals' }].map((s) => {
    const list = entries.filter((e) => (s.id ? e.shelf === s.id : !known.has(e.shelf))).filter(matches);
    if (!list.length && (q || !s.id)) return ''; // while searching, and for the catch-all shelf, skip empty ones
    return `
      <h2 class="section-title">${esc(s.name)}</h2>
      <div class="lib-grid">
        ${list.length ? list.map(card).join('') : '<div class="lib-soon"><b>Coming Soon!</b></div>'}
      </div>`;
  }).join('');
  box.innerHTML = `
    <input type="search" class="lib-search" id="lib-search" placeholder="Search festivals" value="${esc(query)}" autocomplete="off">
    ${shelves || '<p class="hint">No festivals match that.</p>'}`;
  const input = $('#lib-search', box);
  input.addEventListener('input', () => {
    query = input.value;
    const pos = input.selectionStart;
    renderLibrary();
    const again = $('#lib-search');
    again.focus();
    again.setSelectionRange(pos, pos);
  });
  $$('.lib-card', box).forEach((b) => b.addEventListener('click', () => detailSheet(b.dataset.id)));
  // Everything on screen has now been seen; badges clear next time.
  store.markLibrarySeen(entries.map((e) => e.id));
}

function detailSheet(id) {
  const e = libraryEntries().find((x) => x.id === id);
  if (!e) return;
  const added = !!store.festival(id);
  openSheet({
    title: e.name,
    body: `
      ${e.blurb ? `<p class="sheet-sub">${esc(e.blurb)}</p>` : ''}
      <ol class="lib-cats">${e.cats.map((c) => `<li><span>${esc(c.name)}</span><small>${c.n}</small></li>`).join('')}</ol>`,
    actions: added
      ? [
        { label: 'Close', kind: 'ghost', onClick: closeSheet },
        { label: 'Show It', kind: 'primary', onClick: () => { closeSheet(); show(id); } },
      ]
      : [
        { label: 'Close', kind: 'ghost', onClick: closeSheet },
        { label: 'Add to My Festivals', kind: 'primary', onClick: () => { closeSheet(); add(e); } },
      ],
  });
}

function add(e) {
  const f = store.restoreOfficialFestival(e.id, e.pub);
  if (!f) return;
  renderLibrary();
  toast(`${f.name} added.`, { action: 'Show It', onAction: () => show(f.id) });
}

function show(id) {
  if (store.activeFestival().id !== id) {
    store.setActiveFestival(id);
    resetRoll();
  }
  nav.go('home');
}

export function initLibrary() {
  $('#library-done').addEventListener('click', () => nav.go('home'));
}

// Used by the festival menu's "+ Browse Festivals" button.
export function openLibrary() {
  query = '';
  nav.go('library');
}
