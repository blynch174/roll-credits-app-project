// UI: screens, rolling, sheets, and rendering. Data changes go through store.js.

import * as store from './store.js';
import { SWATCHES, THEMES, SLOTS_PER_CATEGORY } from './defaults.js';
import { randInt, dieSVG, tumble } from './dice.js';

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

// Escape anything a user typed before putting it into HTML.
function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[c]);
}

const swatchHex = (id) => (SWATCHES.find((s) => s.id === id) || SWATCHES[SWATCHES.length - 1]).hex;
const fmtDate = (iso) =>
  new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
const movieLabel = (m) => (m.year ? `${esc(m.title)} <span class="year">(${m.year})</span>` : esc(m.title));

const THEME_COLORS = { pumpkin: '#14100c', crypt: '#0f1312', bloodmoon: '#120708', afraid: '#f7f2ea' };

// ---------- App state that isn't saved ----------

const ui = {
  screen: 'home',
  tableCat: null, // category id shown on Tables
  roll: { phase: 'idle', d6: null, d12: null, catId: null, wild: false },
};

// ---------- Toast ----------

let toastTimer;
function toast(msg) {
  if (!msg) return;
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 3200);
}

// ---------- Bottom sheet ----------

let sheetOnClose = null;
function openSheet({ title, body = '', actions = [], onClose = null }) {
  const sheet = $('#sheet');
  sheet.innerHTML = `
    <div class="sheet-grip" aria-hidden="true"></div>
    <h3 class="sheet-title">${esc(title)}</h3>
    <div class="sheet-body">${body}</div>
    <div class="sheet-actions"></div>`;
  const bar = $('.sheet-actions', sheet);
  for (const a of actions) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'btn ' + (a.kind || 'ghost');
    b.textContent = a.label;
    b.addEventListener('click', () => a.onClick && a.onClick(sheet));
    bar.appendChild(b);
  }
  sheetOnClose = onClose;
  $('#toast').classList.remove('show');
  $('#sheet-backdrop').hidden = false;
  sheet.hidden = false;
  requestAnimationFrame(() => {
    $('#sheet-backdrop').classList.add('show');
    sheet.classList.add('show');
  });
  const first = $('input, textarea, select', sheet);
  if (first && window.matchMedia('(hover: hover)').matches) first.focus();
  return sheet;
}

function closeSheet() {
  const sheet = $('#sheet');
  if (sheet.hidden) return;
  sheet.classList.remove('show');
  $('#sheet-backdrop').classList.remove('show');
  setTimeout(() => {
    sheet.hidden = true;
    $('#sheet-backdrop').hidden = true;
    sheet.innerHTML = '';
  }, 220);
  const cb = sheetOnClose;
  sheetOnClose = null;
  if (cb) cb();
}

$('#sheet-backdrop').addEventListener('click', closeSheet);
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closeSheet();
});

function confirmSheet(title, text, okLabel, onOk, danger = false) {
  openSheet({
    title,
    body: `<p class="sheet-text">${esc(text)}</p>`,
    actions: [
      { label: 'Cancel', kind: 'ghost', onClick: closeSheet },
      { label: okLabel, kind: danger ? 'danger' : 'primary', onClick: () => { closeSheet(); onOk(); } },
    ],
  });
}

// ---------- Navigation ----------

function showScreen(name) {
  ui.screen = name;
  for (const s of ['home', 'tables', 'settings']) {
    $('#screen-' + s).hidden = s !== name;
  }
  $$('.tabbar button').forEach((b) => {
    if (b.dataset.screen === name) b.setAttribute('aria-current', 'page');
    else b.removeAttribute('aria-current');
  });
  render();
  window.scrollTo(0, 0);
}

$$('.tabbar button').forEach((b) => b.addEventListener('click', () => showScreen(b.dataset.screen)));

// ---------- Theme ----------

function applyTheme() {
  const theme = store.getState().settings.theme;
  document.body.dataset.theme = theme;
  const meta = $('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', THEME_COLORS[theme] || '#14100c');
}

// ---------- Segmented controls ----------

function syncSeg(container, value) {
  $$('button', container).forEach((b) => {
    const on = b.dataset.mode === value;
    b.classList.toggle('on', on);
    b.setAttribute('aria-checked', on ? 'true' : 'false');
  });
}

$('#dice-mode').addEventListener('click', (e) => {
  const b = e.target.closest('button');
  if (!b || ui.roll.phase === 'rolling') return;
  store.setSetting('diceMode', b.dataset.mode);
  ui.roll = { phase: 'idle', d6: null, d12: null, catId: null, wild: false };
  renderHome();
});

$('#slot-mode').addEventListener('click', (e) => {
  const b = e.target.closest('button');
  if (!b) return;
  store.setSetting('slotMode', b.dataset.mode);
  renderSettings();
});

// =====================================================================
// HOME: rolling
// =====================================================================

// Before a category is known the dice use the theme accent; after, the category color.
const dieStyle = (c) => (c ? `--die:${c};--die-ink:#fff` : '--die:var(--accent);--die-ink:var(--accent-ink)');

function diceHTML(d6, d12, catColor) {
  return `
    <div class="dice-row">
      <div class="die d6" id="die6" style="${dieStyle(catColor)}">
        ${dieSVG(6)}<span class="die-num">${d6 ?? '?'}</span><span class="die-label">d6</span>
      </div>
      <div class="die d12" id="die12" style="${dieStyle(catColor)}">
        ${dieSVG(12)}<span class="die-num">${d12 ?? '?'}</span><span class="die-label">d12</span>
      </div>
    </div>`;
}

function renderRollArea() {
  const area = $('#roll-area');
  const r = ui.roll;
  const mode = store.getState().settings.diceMode;
  const cats = store.categories();

  if (r.phase === 'idle' || r.phase === 'rolling') {
    if (mode === 'physical' && r.phase === 'idle') {
      area.innerHTML = `
        <p class="roll-hint">Roll your dice, then enter the numbers.</p>
        <div class="phys-inputs">
          <label><span>d6 · category</span><input id="in-d6" type="number" inputmode="numeric" min="1" max="6" placeholder="1–6"></label>
          <label><span>d12 · movie</span><input id="in-d12" type="number" inputmode="numeric" min="1" max="12" placeholder="1–12"></label>
        </div>
        <button type="button" class="btn primary big" id="btn-phys">Use these rolls</button>
        ${categoryKey(cats)}`;
      $('#btn-phys').addEventListener('click', () => {
        const d6 = parseInt($('#in-d6').value, 10);
        const d12 = parseInt($('#in-d12').value, 10);
        if (!(d6 >= 1 && d6 <= 6) || !(d12 >= 1 && d12 <= 12)) {
          toast('Enter a d6 from 1–6 and a d12 from 1–12.');
          return;
        }
        resolveRoll(d6, d12);
      });
      return;
    }
    area.innerHTML = `
      ${diceHTML(r.d6, r.d12)}
      <button type="button" class="btn primary big" id="btn-roll" ${r.phase === 'rolling' ? 'disabled' : ''}>
        ${r.phase === 'rolling' ? 'Rolling…' : 'Roll for tonight'}
      </button>
      ${categoryKey(cats)}`;
    const btn = $('#btn-roll');
    if (btn) btn.addEventListener('click', rollAll);
    return;
  }

  if (r.phase === 'pickCategory') {
    const choices = cats.filter((c) => !store.isWild(c));
    area.innerHTML = `
      ${mode === 'virtual' ? diceHTML(r.d6, r.d12) : ''}
      <p class="wild-title">Wild Card!</p>
      <p class="roll-hint">Pick any category. Your d12 is <strong>${r.d12}</strong>.</p>
      <div class="pick-grid">
        ${choices.map((c) => `<button type="button" class="pick" data-cat="${c.id}" style="--cat:${swatchHex(c.color)}">${esc(c.name)}</button>`).join('')}
      </div>
      ${choices.length === 0 ? '<p class="roll-hint">Every category is empty. Add some movies in Tables first.</p>' : ''}
      <button type="button" class="btn ghost" id="btn-cancel-roll">Cancel</button>`;
    $$('.pick', area).forEach((b) =>
      b.addEventListener('click', () => {
        ui.roll = { ...r, phase: 'result', catId: b.dataset.cat, wild: true };
        renderRollArea();
      })
    );
    $('#btn-cancel-roll').addEventListener('click', resetRoll);
    return;
  }

  if (r.phase === 'physicalD12') {
    const cat = store.categoryById(r.catId);
    area.innerHTML = `
      <p class="roll-hint">New d12 for <strong>${esc(cat.name)}</strong>:</p>
      <div class="phys-inputs one">
        <label><span>d12 · movie</span><input id="in-d12" type="number" inputmode="numeric" min="1" max="12" placeholder="1–12"></label>
      </div>
      <button type="button" class="btn primary big" id="btn-phys12">Use this roll</button>
      <button type="button" class="btn ghost" id="btn-cancel-roll">Cancel</button>`;
    $('#btn-phys12').addEventListener('click', () => {
      const d12 = parseInt($('#in-d12').value, 10);
      if (!(d12 >= 1 && d12 <= 12)) return toast('Enter a number from 1–12.');
      ui.roll = { ...r, phase: 'result', d12 };
      renderRollArea();
    });
    $('#btn-cancel-roll').addEventListener('click', resetRoll);
    return;
  }

  // phase === 'result'
  const cat = store.categoryById(r.catId);
  if (!cat) return resetRoll();
  const idx = r.d12 - 1;
  const movie = cat.slots[idx];
  const watched = movie && store.isWatched(movie.id);
  const color = swatchHex(cat.color);

  let card;
  let actions;
  if (movie && !watched) {
    card = `
      <div class="pick-card" style="--cat:${color}">
        <p class="pick-cat">${esc(cat.name)} · #${r.d12}</p>
        <p class="pick-title">${movieLabel(movie)}</p>
        ${movie.vibe ? `<p class="pick-vibe">${esc(movie.vibe)}</p>` : ''}
        ${movie.note ? `<p class="pick-note">Last time: ${esc(movie.note)}</p>` : ''}
      </div>
      <p class="roll-q">Watching it tonight?</p>`;
    actions = `
      <button type="button" class="btn primary big" data-act="watch">Yes, watch it</button>
      <div class="btn-row">
        <button type="button" class="btn ghost" data-act="reroll-movie">Reroll movie</button>
        <button type="button" class="btn ghost" data-act="reroll-all">Reroll all</button>
      </div>`;
  } else if (movie && watched) {
    card = `
      <div class="pick-card seen" style="--cat:${color}">
        <p class="pick-cat">${esc(cat.name)} · #${r.d12}</p>
        <p class="pick-title">${movieLabel(movie)}</p>
        <p class="pick-flag">Already watched this season</p>
      </div>`;
    actions = `
      <div class="btn-row">
        <button type="button" class="btn primary" data-act="reroll-movie">Reroll movie</button>
        <button type="button" class="btn ghost" data-act="reroll-all">Reroll all</button>
      </div>`;
  } else {
    card = `
      <div class="pick-card empty" style="--cat:${color}">
        <p class="pick-cat">${esc(cat.name)} · #${r.d12}</p>
        <p class="pick-title">Slot open</p>
        <p class="pick-flag">Fill it with a movie, or reroll.</p>
      </div>`;
    actions = `
      <button type="button" class="btn primary big" data-act="fill">Fill this slot</button>
      <div class="btn-row">
        <button type="button" class="btn ghost" data-act="reroll-movie">Reroll movie</button>
        <button type="button" class="btn ghost" data-act="reroll-all">Reroll all</button>
      </div>`;
  }

  area.innerHTML = `
    ${mode === 'virtual' ? diceHTML(r.wild ? 'W' : r.d6, r.d12, color) : `<p class="phys-echo">You rolled ${r.wild ? 'Wild Card' : r.d6} and ${r.d12}</p>`}
    ${card}
    <div class="roll-actions">${actions}</div>`;

  area.querySelector('.roll-actions').addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    const act = b.dataset.act;
    if (act === 'watch') {
      const entry = store.watchMovie(cat.id, idx);
      resetRoll();
      renderHome();
      if (entry) toast(`${entry.title} added to your watched list. Enjoy!`);
    } else if (act === 'reroll-movie') {
      rerollMovie();
    } else if (act === 'reroll-all') {
      if (mode === 'virtual') rollAll();
      else resetRoll();
    } else if (act === 'fill') {
      editSlotSheet(cat.id, idx, () => renderRollArea());
    }
  });
}

function categoryKey(cats) {
  return `
    <ol class="cat-key">
      ${cats.map((c, i) => `
        <li style="--cat:${swatchHex(c.color)}"><span class="k">${i + 1}</span>${store.isWild(c) ? `${esc(c.name)} <em>(pick any)</em>` : esc(c.name)}</li>`).join('')}
    </ol>`;
}

function resetRoll() {
  ui.roll = { phase: 'idle', d6: null, d12: null, catId: null, wild: false };
  renderRollArea();
}

async function rollAll() {
  const d6 = randInt(1, 6);
  const d12 = randInt(1, 12);
  ui.roll = { phase: 'rolling', d6: null, d12: null, catId: null, wild: false };
  renderRollArea();
  const cat = store.categories()[d6 - 1];
  await Promise.all([
    tumble($('#die6'), 6, d6, 850),
    tumble($('#die12'), 12, d12, 1150),
  ]);
  ui.roll.d6 = d6;
  ui.roll.d12 = d12;
  if (cat && !store.isWild(cat)) {
    for (const el of [$('#die6'), $('#die12')]) {
      el.style.setProperty('--die', swatchHex(cat.color));
      el.style.setProperty('--die-ink', '#fff');
    }
  }
  await new Promise((r) => setTimeout(r, 350));
  resolveRoll(d6, d12);
}

function resolveRoll(d6, d12) {
  const cat = store.categories()[d6 - 1];
  if (!cat || store.isWild(cat)) {
    ui.roll = { phase: 'pickCategory', d6, d12, catId: null, wild: true };
  } else {
    ui.roll = { phase: 'result', d6, d12, catId: cat.id, wild: false };
  }
  renderRollArea();
}

async function rerollMovie() {
  const r = ui.roll;
  if (store.getState().settings.diceMode === 'physical') {
    ui.roll = { ...r, phase: 'physicalD12' };
    renderRollArea();
    return;
  }
  const d12 = randInt(1, 12);
  const cat = store.categoryById(r.catId);
  // Show the dice tumbling the d12 only.
  $('#roll-area').innerHTML = diceHTML(r.wild ? 'W' : r.d6, null, swatchHex(cat.color)) +
    '<button type="button" class="btn primary big" disabled>Rolling…</button>';
  ui.roll = { ...r, phase: 'rolling' };
  await tumble($('#die12'), 12, d12, 1000);
  await new Promise((res) => setTimeout(res, 300));
  ui.roll = { ...r, phase: 'result', d12 };
  renderRollArea();
}

// =====================================================================
// HOME: slots to fill + watched list
// =====================================================================

const SKULL = `<svg viewBox="0 0 24 24" aria-hidden="true"><path class="bone" d="M12 2.2c-4.9 0-8.6 3.5-8.6 8.1 0 2.7 1.2 4.8 3.2 6.1v2.4c0 .9.7 1.6 1.6 1.6h7.6c.9 0 1.6-.7 1.6-1.6v-2.4c2-1.3 3.2-3.4 3.2-6.1 0-4.6-3.7-8.1-8.6-8.1z"/><circle class="hole" cx="8.6" cy="10.6" r="2"/><circle class="hole" cx="15.4" cy="10.6" r="2"/><path class="hole" d="M12 13.6l-1.2 2.2h2.4z"/></svg>`;

function skulls(rating, interactive = false) {
  let out = '';
  for (let i = 1; i <= 5; i++) {
    const on = i <= rating ? 'on' : '';
    out += interactive
      ? `<button type="button" class="skull ${on}" data-r="${i}" aria-label="${i} of 5">${SKULL}</button>`
      : `<span class="skull ${on}">${SKULL}</span>`;
  }
  return out;
}

function renderOpenSlots() {
  const box = $('#open-slots');
  const open = store.openSlots();
  if (!open.length) {
    box.innerHTML = '';
    return;
  }
  const total = open.reduce((n, o) => n + o.count, 0);
  box.innerHTML = `
    <div class="card reminder">
      <p class="reminder-title">${total} slot${total === 1 ? '' : 's'} to fill</p>
      <ul>
        ${open.map((o) => `
          <li><button type="button" data-cat="${o.cat.id}" style="--cat:${swatchHex(o.cat.color)}">
            <span>${esc(o.cat.name)}</span><span class="n">${o.count} open ›</span>
          </button></li>`).join('')}
      </ul>
    </div>`;
  $$('button', box).forEach((b) =>
    b.addEventListener('click', () => {
      ui.tableCat = b.dataset.cat;
      showScreen('tables');
    })
  );
}

function renderWatched() {
  const list = store.getState().season.watched;
  $('#watched-count').textContent = list.length ? list.length : '';
  const ul = $('#watched-list');
  if (!list.length) {
    ul.innerHTML = `<li class="empty-state">Nothing yet. Roll something and hit "Yes, watch it."</li>`;
    return;
  }
  ul.innerHTML = list
    .map((w) => {
      const cat = store.categoryById(w.categoryId);
      const color = swatchHex(cat ? cat.color : 'slate');
      return `
      <li>
        <button type="button" class="watched-item" data-id="${esc(w.id)}" style="--cat:${color}">
          <span class="wi-main">
            <span class="wi-title">${movieLabel(w)}</span>
            <span class="wi-meta">${esc(cat ? cat.name : w.categoryName)} · ${fmtDate(w.date)}</span>
            ${w.notes ? `<span class="wi-notes">${esc(w.notes)}</span>` : ''}
          </span>
          <span class="wi-rating">${w.rating ? skulls(w.rating) : '<span class="rate-me">Rate</span>'}</span>
        </button>
      </li>`;
    })
    .join('');
  $$('.watched-item', ul).forEach((b) => b.addEventListener('click', () => watchedSheet(b.dataset.id)));
}

function watchedSheet(entryId) {
  const w = store.getState().season.watched.find((x) => x.id === entryId);
  if (!w) return;
  const sheet = openSheet({
    title: w.title + (w.year ? ` (${w.year})` : ''),
    body: `
      <p class="sheet-sub">Watched ${fmtDate(w.date)}</p>
      <div class="field">
        <span class="label">Rating</span>
        <div class="skull-row" id="skull-row">${skulls(w.rating, true)}</div>
      </div>
      <label class="field">
        <span class="label">Notes</span>
        <textarea id="w-notes" rows="3" maxlength="500" placeholder="What did you think?">${esc(w.notes)}</textarea>
      </label>
      <button type="button" class="btn danger-text" id="btn-remove">Remove from watched list</button>`,
    actions: [{ label: 'Done', kind: 'primary', onClick: closeSheet }],
    onClose: () => renderHome(),
  });
  let rating = w.rating;
  $('#skull-row', sheet).addEventListener('click', (e) => {
    const b = e.target.closest('.skull');
    if (!b) return;
    const r = parseInt(b.dataset.r, 10);
    rating = r === rating ? 0 : r; // tap the same skull again to clear
    store.updateWatched(entryId, { rating });
    $('#skull-row', sheet).innerHTML = skulls(rating, true);
  });
  $('#w-notes', sheet).addEventListener('input', (e) =>
    store.updateWatched(entryId, { notes: e.target.value })
  );
  $('#btn-remove', sheet).addEventListener('click', () => removeSheet(entryId));
}

function removeSheet(entryId) {
  const w = store.getState().season.watched.find((x) => x.id === entryId);
  if (!w) return;
  sheetOnClose = null; // swapping sheets, don't re-render yet
  openSheet({
    title: `Remove ${w.title}?`,
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
      { label: 'Cancel', kind: 'ghost', onClick: () => watchedSheet(entryId) },
      {
        label: 'Remove',
        kind: 'danger',
        onClick: (sheet) => {
          const reason = $('#rm-reason', sheet).value;
          const msg = store.removeWatched(entryId, reason);
          closeSheet();
          renderHome();
          toast(msg);
        },
      },
    ],
    onClose: () => renderHome(),
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

function renderHome() {
  syncSeg($('#dice-mode'), store.getState().settings.diceMode);
  renderRollArea();
  renderOpenSlots();
  renderWatched();
}

// =====================================================================
// TABLES
// =====================================================================

function renderTables() {
  const cats = store.categories();
  if (!ui.tableCat || !store.categoryById(ui.tableCat)) ui.tableCat = cats[0].id;
  const cat = store.categoryById(ui.tableCat);
  const color = swatchHex(cat.color);
  const seen = store.watchedIds();

  $('#chips').innerHTML = cats
    .map((c, i) => `
      <button type="button" role="tab" class="chip ${c.id === cat.id ? 'on' : ''}" data-cat="${c.id}" style="--cat:${swatchHex(c.color)}" aria-selected="${c.id === cat.id}">
        <span class="chip-n">${i + 1}</span>${esc(c.name)}
      </button>`)
    .join('');
  $$('.chip').forEach((b) =>
    b.addEventListener('click', () => {
      ui.tableCat = b.dataset.cat;
      renderTables();
    })
  );
  const active = $('.chip.on');
  if (active) active.scrollIntoView({ block: 'nearest', inline: 'center' });

  const filled = store.filledCount(cat);
  $('#cat-header').innerHTML = `
    <div class="cat-header" style="--cat:${color}">
      <div>
        <h2 class="cat-name">${esc(cat.name)}</h2>
        ${cat.vibe ? `<p class="cat-vibe">${esc(cat.vibe)}</p>` : ''}
        <p class="cat-count">${filled} of ${SLOTS_PER_CATEGORY} filled</p>
      </div>
      <div class="cat-tools">
        <button type="button" class="btn ghost small" id="btn-edit-cat">Edit</button>
        <button type="button" class="btn ghost small" id="btn-shuffle" ${filled < 2 ? 'disabled' : ''}>Shuffle</button>
      </div>
    </div>
    ${filled === 0 ? `<p class="wild-note">This category is empty, so it works as the <strong>Wild Card</strong>: rolling its number lets you pick any category. Add movies to turn it into your own.</p>` : ''}`;
  $('#btn-edit-cat').addEventListener('click', () => editCategorySheet(cat.id));
  $('#btn-shuffle').addEventListener('click', () => {
    store.shuffleCategory(cat.id, randInt);
    renderTables();
    toast('Shuffled.');
  });

  $('#slot-list').innerHTML = cat.slots
    .map((m, i) => {
      if (!m) {
        return `<li><button type="button" class="slot empty" data-i="${i}" style="--cat:${color}">
          <span class="slot-n">${i + 1}</span><span class="slot-main"><span class="slot-title">Empty slot</span><span class="slot-vibe">Tap to add a movie</span></span></button></li>`;
      }
      const isSeen = seen.has(m.id);
      return `<li><button type="button" class="slot ${isSeen ? 'seen' : ''}" data-i="${i}" style="--cat:${color}">
        <span class="slot-n">${i + 1}</span>
        <span class="slot-main">
          <span class="slot-title">${movieLabel(m)}</span>
          ${m.vibe ? `<span class="slot-vibe">${esc(m.vibe)}</span>` : ''}
          ${m.note ? `<span class="slot-note">Note: ${esc(m.note)}</span>` : ''}
        </span>
        ${isSeen ? '<span class="badge">Seen</span>' : ''}
      </button></li>`;
    })
    .join('');
  $$('#slot-list .slot').forEach((b) =>
    b.addEventListener('click', () => editSlotSheet(cat.id, parseInt(b.dataset.i, 10), renderTables))
  );
}

function editSlotSheet(catId, index, after) {
  const cat = store.categoryById(catId);
  const m = cat.slots[index];
  const actions = [{ label: 'Cancel', kind: 'ghost', onClick: closeSheet }];
  if (m) {
    actions.push({
      label: 'Clear slot',
      kind: 'danger-ghost',
      onClick: () => {
        store.clearSlot(catId, index);
        closeSheet();
        after && after();
      },
    });
  }
  actions.push({
    label: 'Save',
    kind: 'primary',
    onClick: (sheet) => {
      const title = $('#f-title', sheet).value.trim();
      if (!title) {
        $('#f-title', sheet).focus();
        toast('A title is required.');
        return;
      }
      store.setSlot(catId, index, {
        title,
        year: $('#f-year', sheet).value,
        vibe: $('#f-vibe', sheet).value,
      });
      closeSheet();
      after && after();
    },
  });
  openSheet({
    title: `${cat.name} · #${index + 1}`,
    body: `
      <label class="field"><span class="label">Title <em>required</em></span>
        <input id="f-title" type="text" maxlength="120" autocomplete="off" value="${m ? esc(m.title) : ''}" placeholder="Movie title"></label>
      <div class="field-row">
        <label class="field year"><span class="label">Year</span>
          <input id="f-year" type="number" inputmode="numeric" min="1888" max="2999" value="${m && m.year ? m.year : ''}" placeholder="Optional"></label>
        <label class="field grow"><span class="label">Vibe</span>
          <input id="f-vibe" type="text" maxlength="80" autocomplete="off" value="${m ? esc(m.vibe) : ''}" placeholder="Optional"></label>
      </div>
      ${m && store.isWatched(m.id) ? '<p class="hint">Changing the title swaps in a new movie. Your watched list is not affected.</p>' : ''}`,
    actions,
  });
}

function editCategorySheet(catId) {
  const cat = store.categoryById(catId);
  let color = cat.color;
  const sheet = openSheet({
    title: 'Edit category',
    body: `
      <label class="field"><span class="label">Name</span>
        <input id="c-name" type="text" maxlength="40" value="${esc(cat.name)}"></label>
      <label class="field"><span class="label">Vibe</span>
        <textarea id="c-vibe" rows="2" maxlength="140" placeholder="What kind of night is this?">${esc(cat.vibe)}</textarea></label>
      <div class="field"><span class="label">Color</span>
        <div class="swatches" id="c-swatches">
          ${SWATCHES.map((s) => `<button type="button" class="swatch ${s.id === color ? 'on' : ''}" data-c="${s.id}" style="--sw:${s.hex}" aria-label="${s.id}"></button>`).join('')}
        </div>
      </div>
      <button type="button" class="btn danger-text" id="btn-clear-cat">Clear all ${SLOTS_PER_CATEGORY} slots</button>`,
    actions: [
      { label: 'Cancel', kind: 'ghost', onClick: closeSheet },
      {
        label: 'Save',
        kind: 'primary',
        onClick: (s) => {
          const name = $('#c-name', s).value.trim();
          if (!name) return toast('Give the category a name.');
          store.updateCategory(catId, { name, vibe: $('#c-vibe', s).value, color });
          closeSheet();
          renderTables();
        },
      },
    ],
  });
  $('#c-swatches', sheet).addEventListener('click', (e) => {
    const b = e.target.closest('.swatch');
    if (!b) return;
    color = b.dataset.c;
    $$('.swatch', sheet).forEach((x) => x.classList.toggle('on', x === b));
  });
  $('#btn-clear-cat', sheet).addEventListener('click', () => {
    confirmSheet(
      'Clear this category?',
      `All ${SLOTS_PER_CATEGORY} movies in ${cat.name} will be removed. An empty category acts as the Wild Card.`,
      'Clear it',
      () => {
        store.clearCategory(catId);
        renderTables();
      },
      true
    );
  });
}

// =====================================================================
// SETTINGS
// =====================================================================

function renderSettings() {
  const s = store.getState().settings;
  $('#theme-grid').innerHTML = THEMES.map(
    (t) => `
    <button type="button" class="theme-card ${t.id === s.theme ? 'on' : ''}" data-theme-id="${t.id}" data-preview="${t.id}">
      <span class="tc-swatch"><i></i><i></i><i></i></span>
      <span class="tc-name">${t.name}</span>
      <span class="tc-desc">${t.desc}</span>
    </button>`
  ).join('');
  $$('.theme-card').forEach((b) =>
    b.addEventListener('click', () => {
      store.setSetting('theme', b.dataset.themeId);
      applyTheme();
      renderSettings();
    })
  );
  syncSeg($('#slot-mode'), s.slotMode);
  $('#slot-mode-hint').textContent =
    s.slotMode === 'keep'
      ? 'Watched movies stay in their slot, marked as seen. Rolling one offers a reroll.'
      : 'Watched movies leave the table. Their slot shows up under "slots to fill" on the Roll screen.';
  $('#storage-warning').hidden = store.canSave();
}

async function exportBackup() {
  const text = store.exportJSON();
  const name = `roll-credits-backup-${new Date().toISOString().slice(0, 10)}.json`;
  const blob = new Blob([text], { type: 'application/json' });
  // On phones, the share sheet is the reliable way to save a file.
  try {
    const file = new File([blob], name, { type: 'application/json' });
    if (navigator.canShare && navigator.canShare({ files: [file] }) && matchMedia('(pointer: coarse)').matches) {
      await navigator.share({ files: [file], title: 'Roll Credits backup' });
      return true;
    }
  } catch (e) {
    if (e && e.name === 'AbortError') return false;
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    URL.revokeObjectURL(a.href);
    a.remove();
  }, 1000);
  return true;
}

$('#btn-export').addEventListener('click', async () => {
  if (await exportBackup()) toast('Backup saved.');
});

$('#btn-import').addEventListener('click', () => $('#import-file').click());
$('#import-file').addEventListener('change', async (e) => {
  const file = e.target.files && e.target.files[0];
  e.target.value = '';
  if (!file) return;
  const text = await file.text();
  confirmSheet(
    'Import this backup?',
    'Everything currently in the app will be replaced with the backup.',
    'Import',
    () => {
      if (store.importJSON(text)) {
        applyTheme();
        resetRoll();
        render();
        toast('Backup loaded.');
      } else {
        toast("That file isn't a Roll Credits backup.");
      }
    }
  );
});

$('#btn-season').addEventListener('click', () => {
  const n = store.getState().season.watched.length;
  openSheet({
    title: 'Start a new season?',
    body: `<p class="sheet-text">This clears your watched list (${n} movie${n === 1 ? '' : 's'}). Your tables stay as they are. Export this season first so you have a record of it.</p>`,
    actions: [
      { label: 'Cancel', kind: 'ghost', onClick: closeSheet },
      {
        label: 'Clear without exporting',
        kind: 'danger-ghost',
        onClick: () => {
          store.newSeason();
          closeSheet();
          render();
          toast('New season started.');
        },
      },
      {
        label: 'Export, then clear',
        kind: 'primary',
        onClick: async () => {
          const ok = await exportBackup();
          if (!ok) return;
          store.newSeason();
          closeSheet();
          render();
          toast('Exported. New season started.');
        },
      },
    ],
  });
});

$('#btn-reset').addEventListener('click', () => {
  confirmSheet(
    'Reset everything?',
    'Your tables, watched list, and settings go back to the starter set. This cannot be undone. Export a backup first if you want to keep anything.',
    'Reset',
    () => {
      store.resetToDefaults();
      ui.tableCat = null;
      applyTheme();
      resetRoll();
      render();
      toast('Back to defaults.');
    },
    true
  );
});

// =====================================================================
// Boot
// =====================================================================

function render() {
  $('#menu-name').textContent = store.activeMenu().name;
  if (ui.screen === 'home') renderHome();
  else if (ui.screen === 'tables') renderTables();
  else renderSettings();
}

store.load();
applyTheme();
render();

if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  });
}
