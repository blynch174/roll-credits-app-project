// WATCHED screen: every movie ever watched, with filters. Plus the rate/notes/remove sheets.

import * as store from '../store.js';
import { swatchHex } from '../defaults.js';
import { $, $$, esc, nav, openSheet, closeSheet, swapSheet, toast, ratingIcons, movieLabel, fmtDate, attachSwipe } from '../ui.js';
import { infoBlock, catalogMovie } from '../movieinfo.js';
import { autofindBox, attachAutofind } from '../autofind.js';

const blank = () => ({ q: '', festival: 'all', category: 'all', rating: 'any', year: 'all' });
let filters = blank();

// Row markup shared with the Roll screen.
export function entryRow(e, showFestival) {
  const fest = store.festival(e.festivalId);
  const cat = fest && store.category(fest, e.categoryId);
  const color = swatchHex(cat ? cat.color : e.festivalId === store.POPCORN ? 'gold' : 'slate');
  const where = showFestival ? `${esc(fest ? fest.name : e.festivalName)} · ` : '';
  return `
    <li class="swipe-row">
      <button type="button" class="swipe-del" tabindex="-1">Delete</button>
      <button type="button" class="watched-item swipe-item" data-id="${esc(e.id)}" style="--cat:${color}">
        <span class="wi-main">
          <span class="wi-title">${movieLabel(e)}</span>
          <span class="wi-meta">${e.festivalId === store.NO_FEST ? `${esc(store.NO_FEST_NAME)} · ` : `${where}${esc(cat ? cat.name : e.categoryName)} · `}${fmtDate(e.date)}</span>
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
  history.forEach((e) => { if (!festChoices.has(e.festivalId)) festChoices.set(e.festivalId, store.historyGroupName(e.festivalId)); });

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
    ${active ? '<button type="button" class="link" id="wf-clear">Clear Filters</button>' : ''}`;
  const clear = $('#wf-clear');
  if (clear) clear.addEventListener('click', () => { filters = blank(); renderWatched(); });

  const ul = $('#history-list');
  if (!all.length) {
    ul.innerHTML = '<li class="empty-state">Nothing watched yet.</li>';
    return;
  }
  ul.innerHTML = list.length
    ? list.map((e) => entryRow(e, filters.festival === 'all')).join('')
    : '<li class="empty-state">Nothing matches those filters.</li>';
  $$('.watched-item', ul).forEach((b) => b.addEventListener('click', () => entrySheet(b.dataset.id, renderList)));
  attachSwipe(ul, (id) => swipeDelete(id, () => nav.render()));
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
      ${infoBlock(catalogMovie(e.catalogId))}
      <div class="field">
        <span class="label">Rating</span>
        <div class="rating-row" id="rating-row">${ratingIcons(e.icon, e.rating, true)}</div>
      </div>
      <label class="field">
        <span class="label">Notes</span>
        <textarea id="e-notes" rows="3" maxlength="500" placeholder="What did you think?">${esc(e.notes)}</textarea>
      </label>
      <button type="button" class="btn danger-text" id="btn-remove">Remove from Watched List</button>`,
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
  if (e.categoryId === store.OFF_MENU || e.festivalId === store.POPCORN) {
    swapSheet({
      title: `Remove ${e.title}?`,
      body: '<p class="sheet-text">It comes off your watch history. It was never on a table, so nothing else changes.</p>',
      actions: [
        { label: 'Cancel', kind: 'ghost', onClick: () => entrySheet(entryId, after) },
        { label: 'Remove', kind: 'danger', onClick: () => { const msg = store.removeEntry(entryId, 'mistake'); closeSheet(); toast(msg); } },
      ],
      onClose: () => after && after(),
    });
    return;
  }
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

// ---------- Log a movie watched outside the app ----------

const todayStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export function logSheet(after) {
  let festId = store.NO_FEST;
  let rating = 0;
  let getCatalogId = () => null;
  const sheet = openSheet({
    title: 'Log a Movie',
    body: `
      <p class="sheet-sub">For anything you watched without rolling for it.</p>
      <div class="field-row">
        <label class="field grow"><span class="label">Title <em>required</em></span>
          <input id="f-title" type="text" maxlength="120" autocomplete="off" placeholder="Start typing to search"></label>
        <label class="field year"><span class="label">Year</span>
          <input id="f-year" type="number" inputmode="numeric" min="1888" max="2999" placeholder="Optional"></label>
      </div>
      ${autofindBox()}
      <div class="field-row">
        <label class="field grow"><span class="label">Festival</span>
          <select id="lg-fest"><option value="${store.NO_FEST}" selected>${store.NO_FEST_NAME}</option>${store.festivals().map((x) => `<option value="${x.id}">${esc(x.name)}</option>`).join('')}</select></label>
        <label class="field date"><span class="label">Watched on</span>
          <input id="lg-date" type="date" value="${todayStr()}" max="${todayStr()}"></label>
      </div>
      <p class="hint" id="lg-match"></p>
      <div class="field"><span class="label">Rating</span><div class="rating-row" id="rating-row"></div></div>
      <label class="field"><span class="label">Notes</span>
        <textarea id="lg-notes" rows="2" maxlength="500" placeholder="Optional"></textarea></label>`,
    actions: [
      { label: 'Cancel', kind: 'ghost', onClick: closeSheet },
      {
        label: 'Add to Watched List',
        kind: 'primary',
        onClick: (s) => {
          const title = $('#f-title', s).value.trim();
          if (!title) { $('#f-title', s).focus(); return toast('A title is required.'); }
          const day = $('#lg-date', s).value || todayStr();
          if (day > todayStr()) return toast("That date hasn't happened yet.");
          const date = day === todayStr() ? new Date().toISOString() : new Date(day + 'T12:00:00').toISOString();
          const res = store.logMovie({
            festivalId: festId, title, year: $('#f-year', s).value, catalogId: getCatalogId(true),
            date, rating, notes: $('#lg-notes', s).value,
          });
          closeSheet();
          after && after();
          if (res) toast(res.found ? `${res.entry.title} logged and marked on your ${res.found.cat.name} table.` : `${res.entry.title} logged.`);
        },
      },
    ],
  });

  const fest = () => store.festival(festId);
  const drawRating = () => { $('#rating-row', sheet).innerHTML = ratingIcons(fest() ? fest().icon : store.NO_FEST_ICON, rating, true); };
  const updateMatch = () => {
    const title = $('#f-title', sheet).value.trim();
    const el = $('#lg-match', sheet);
    if (!title || !fest()) { el.textContent = ''; return; }
    const y = parseInt($('#f-year', sheet).value, 10) || null;
    const hit = store.findSlot(fest(), { title, year: y, catalogId: getCatalogId() });
    const mode = store.getState().settings.slotMode;
    el.textContent = hit
      ? `On your ${hit.cat.name} table. It'll be ${mode === 'replace' ? 'taken off the table' : 'marked Seen'}.`
      : `Not on ${fest().name}'s tables. It'll be listed as "Off the menu".`;
  };

  getCatalogId = attachAutofind(sheet, { festivalId: festId, onPick: updateMatch });
  $('#f-title', sheet).addEventListener('input', updateMatch);
  $('#f-year', sheet).addEventListener('input', updateMatch);
  $('#lg-fest', sheet).addEventListener('change', (e) => { festId = e.target.value; drawRating(); updateMatch(); });
  $('#rating-row', sheet).addEventListener('click', (e) => {
    const b = e.target.closest('.ricon');
    if (!b) return;
    const n = parseInt(b.dataset.r, 10);
    rating = n === rating ? 0 : n;
    drawRating();
  });
  drawRating();
}

export function initWatched() {
  $('#btn-log').addEventListener('click', () => logSheet(() => nav.render()));
}

// Swipe-to-delete: removes the movie as if it was never watched (same as "Rolled by mistake"),
// with an Undo in the toast.
export function swipeDelete(id, after) {
  const e = store.entry(id);
  if (!e) return;
  const snap = store.snapshot();
  store.removeEntry(id, 'mistake');
  after && after();
  toast(`${e.title} deleted.`, {
    action: 'Undo',
    onAction: () => { store.restore(snap); nav.render(); },
  });
}
