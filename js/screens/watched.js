// WATCHED screen: every movie ever watched, with filters. Plus the rate/notes/remove sheets.

import * as store from '../store.js';
import { swatchHex } from '../defaults.js';
import { $, $$, esc, nav, openSheet, closeSheet, swapSheet, toast, ratingIcons, movieLabel, fmtDate } from '../ui.js';

const blank = () => ({ q: '', festival: 'all', category: 'all', rating: 'any', year: 'all' });
let filters = blank();

// Row markup shared with the Roll screen.
export function entryRow(e, showFestival) {
  const fest = store.festival(e.festivalId);
  const cat = fest && store.category(fest, e.categoryId);
  const color = swatchHex(cat ? cat.color : 'slate');
  const where = showFestival ? `${esc(fest ? fest.name : e.festivalName)} · ` : '';
  return `
    <li>
      <button type="button" class="watched-item" data-id="${esc(e.id)}" style="--cat:${color}">
        <span class="wi-main">
          <span class="wi-title">${movieLabel(e)}</span>
          <span class="wi-meta">${where}${esc(cat ? cat.name : e.categoryName)} · ${fmtDate(e.date)}</span>
          ${e.notes ? `<span class="wi-notes">${esc(e.notes)}</span>` : ''}
        </span>
        <span class="wi-rating">${e.rating ? ratingIcons(e.icon, e.rating) : '<span class="rate-me">Rate</span>'}</span>
      </button>
    </li>`;
}

function matches(e) {
  const f = filters;
  if (f.festival !== 'all' && e.festivalId !== f.festival) return false;
  if (f.category !== 'all' && e.categoryId !== f.category) return false;
  if (f.rating === 'unrated' && e.rating) return false;
  if (/^\d$/.test(f.rating) && (e.rating || 0) < +f.rating) return false;
  if (f.year !== 'all' && new Date(e.date).getFullYear() !== +f.year) return false;
  if (f.q) {
    const q = f.q.toLowerCase();
    const hay = `${e.title} ${e.year || ''} ${e.notes || ''} ${e.categoryName} ${e.festivalName}`.toLowerCase();
    if (!hay.includes(q)) return false;
  }
  return true;
}

const opt = (value, label, selected) =>
  `<option value="${esc(value)}" ${String(selected) === String(value) ? 'selected' : ''}>${esc(label)}</option>`;

export function renderWatched() {
  if (nav.filters) {
    filters = { ...blank(), ...nav.filters };
    nav.filters = null;
  }
  const history = store.getState().history;
  const fests = store.festivals();

  // Category choices come from the chosen festival (current + any from history).
  let catOptions = [];
  if (filters.festival !== 'all') {
    const fest = store.festival(filters.festival);
    const seen = new Map();
    if (fest) fest.categories.forEach((c) => seen.set(c.id, c.name));
    history.filter((e) => e.festivalId === filters.festival).forEach((e) => {
      if (!seen.has(e.categoryId)) seen.set(e.categoryId, e.categoryName);
    });
    catOptions = [...seen.entries()];
  } else {
    filters.category = 'all';
  }
  const years = [...new Set(history.map((e) => new Date(e.date).getFullYear()))].sort((a, b) => b - a);
  // History can include festivals that were deleted.
  const festChoices = new Map(fests.map((x) => [x.id, x.name]));
  history.forEach((e) => { if (!festChoices.has(e.festivalId)) festChoices.set(e.festivalId, e.festivalName + ' (deleted)'); });

  $('#watched-filters').innerHTML = `
    <input id="wf-q" type="search" placeholder="Search titles and notes" value="${esc(filters.q)}" autocomplete="off">
    <div class="filter-grid">
      <label><span>Festival</span><select id="wf-festival">
        ${opt('all', 'All festivals', filters.festival)}
        ${[...festChoices.entries()].map(([id, name]) => opt(id, name, filters.festival)).join('')}
      </select></label>
      <label><span>Category</span><select id="wf-category" ${filters.festival === 'all' ? 'disabled' : ''}>
        ${opt('all', filters.festival === 'all' ? 'Pick a festival' : 'All categories', filters.category)}
        ${catOptions.map(([id, name]) => opt(id, name, filters.category)).join('')}
      </select></label>
      <label><span>Rating</span><select id="wf-rating">
        ${opt('any', 'Any rating', filters.rating)}
        ${opt('unrated', 'Unrated', filters.rating)}
        ${[1, 2, 3, 4].map((n) => opt(n, `${n}+`, filters.rating)).join('')}
        ${opt(5, '5 only', filters.rating)}
      </select></label>
      <label><span>Year watched</span><select id="wf-year">
        ${opt('all', 'All years', filters.year)}
        ${years.map((y) => opt(y, y, filters.year)).join('')}
      </select></label>
    </div>`;

  $('#wf-q').addEventListener('input', (e) => { filters.q = e.target.value; renderList(); });
  for (const key of ['festival', 'category', 'rating', 'year']) {
    $('#wf-' + key).addEventListener('change', (e) => {
      filters[key] = e.target.value;
      if (key === 'festival') { filters.category = 'all'; renderWatched(); } else renderList();
    });
  }
  renderList();
}

function renderList() {
  const all = store.getState().history;
  const list = all.filter(matches);
  const active = JSON.stringify(filters) !== JSON.stringify(blank());
  $('#watched-summary').innerHTML = `
    <span>${list.length} movie${list.length === 1 ? '' : 's'}${active ? ` of ${all.length}` : ''}</span>
    ${active ? '<button type="button" class="link" id="wf-clear">Clear filters</button>' : ''}`;
  const clear = $('#wf-clear');
  if (clear) clear.addEventListener('click', () => { filters = blank(); renderWatched(); });

  const ul = $('#history-list');
  if (!all.length) {
    ul.innerHTML = '<li class="empty-state">Your watch history starts with your first "Yes, watch it."</li>';
    return;
  }
  ul.innerHTML = list.length
    ? list.map((e) => entryRow(e, filters.festival === 'all')).join('')
    : '<li class="empty-state">Nothing matches those filters.</li>';
  $$('.watched-item', ul).forEach((b) => b.addEventListener('click', () => entrySheet(b.dataset.id, renderList)));
}

// ---------- Rate / notes / remove ----------

export function entrySheet(entryId, after) {
  const e = store.entry(entryId);
  if (!e) return;
  const fest = store.festival(e.festivalId);
  const sheet = openSheet({
    title: e.title + (e.year ? ` (${e.year})` : ''),
    body: `
      <p class="sheet-sub">${esc(fest ? fest.name : e.festivalName)} · ${esc(e.categoryName)} · ${fmtDate(e.date)}</p>
      <div class="field">
        <span class="label">Rating</span>
        <div class="rating-row" id="rating-row">${ratingIcons(e.icon, e.rating, true)}</div>
      </div>
      <label class="field">
        <span class="label">Notes</span>
        <textarea id="e-notes" rows="3" maxlength="500" placeholder="What did you think?">${esc(e.notes)}</textarea>
      </label>
      <button type="button" class="btn danger-text" id="btn-remove">Remove from watched list</button>`,
    actions: [{ label: 'Done', kind: 'primary', onClick: closeSheet }],
    onClose: () => after && after(),
  });
  let rating = e.rating;
  $('#rating-row', sheet).addEventListener('click', (ev) => {
    const b = ev.target.closest('.ricon');
    if (!b) return;
    const n = parseInt(b.dataset.r, 10);
    rating = n === rating ? 0 : n; // tap the same one again to clear
    store.updateEntry(entryId, { rating });
    $('#rating-row', sheet).innerHTML = ratingIcons(e.icon, rating, true);
  });
  $('#e-notes', sheet).addEventListener('input', (ev) => store.updateEntry(entryId, { notes: ev.target.value }));
  $('#btn-remove', sheet).addEventListener('click', () => removeSheet(entryId, after));
}

function removeSheet(entryId, after) {
  const e = store.entry(entryId);
  if (!e) return;
  swapSheet({
    title: `Remove ${e.title}?`,
    body: `
      <label class="field">
        <span class="label">Why?</span>
        <select id="rm-reason">
          <option value="unfinished">Didn't finish (add back to table)</option>
          <option value="hated">Hated it (remove entirely)</option>
          <option value="mistake">Rolled by mistake (undo)</option>
        </select>
      </label>
      <p class="hint" id="rm-hint"></p>`,
    actions: [
      { label: 'Cancel', kind: 'ghost', onClick: () => entrySheet(entryId, after) },
      {
        label: 'Remove',
        kind: 'danger',
        onClick: (sheet) => {
          const msg = store.removeEntry(entryId, $('#rm-reason', sheet).value);
          closeSheet(); // runs `after` via onClose
          toast(msg);
        },
      },
    ],
    onClose: () => after && after(),
  });
  const hints = {
    unfinished: 'It goes back into its table. Your notes stay with it for next time.',
    hated: "It's taken out of the table for good, and its slot opens up.",
    mistake: 'Undoes it as if it never happened. Notes and rating are dropped.',
  };
  const sel = $('#rm-reason');
  const setHint = () => ($('#rm-hint').textContent = hints[sel.value]);
  sel.addEventListener('change', setHint);
  setHint();
}
