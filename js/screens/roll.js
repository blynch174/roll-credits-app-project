// ROLL screen: dice, result card, slots-to-fill reminder, recently watched.

import * as store from '../store.js';
import { swatchHex, dieName } from '../defaults.js';
import { randInt, tumble, wait, faceLabel } from '../dice.js';
import { $, $$, esc, toast, nav, dieHTML, movieLabel, syncSeg } from '../ui.js';
import { editSlotSheet } from './tables.js';
import { entrySheet, entryRow } from './watched.js';

const idle = () => ({ phase: 'idle', catRoll: null, movieRoll: null, catId: null, wild: false });
let r = idle();

export function resetRoll() {
  r = idle();
}

const f = () => store.activeFestival();

// ---------- Rendering ----------

export function renderRoll() {
  syncSeg($('#dice-mode'), store.getState().settings.diceMode);
  renderRollArea();
  renderOpenSlots();
  renderRecent();
}

function catKey(fest) {
  if (fest.mode !== 'two') return '';
  return `
    <ol class="cat-key">
      ${fest.categories.map((c, i) => `
        <li style="--cat:${swatchHex(c.color)}">
          <span class="k">${esc(faceLabel(fest.categoryDie, i + 1))}</span>
          <span class="kn">${esc(c.name)}${store.isWild(fest, c) ? ' <em>(Wild Card: pick any)</em>' : ''}</span>
          <span class="kd">${dieName(c.die)}</span>
        </li>`).join('')}
    </ol>`;
}

function diceRow(fest, { catVal, catColor, cat, movieVal, showMovie }) {
  let html = '<div class="dice-row">';
  if (fest.mode === 'two') {
    html += dieHTML(fest.categoryDie, catVal, catColor, 'die-cat', `${dieName(fest.categoryDie)} · category`);
  }
  if (showMovie && cat) {
    html += dieHTML(cat.die, movieVal, swatchHex(cat.color), 'die-movie', `${dieName(cat.die)} · movie`);
  }
  return html + '</div>';
}

function physicalInput(sides, label, id) {
  if (sides === 2) {
    return `
      <p class="roll-hint">${esc(label)}: flip your coin.</p>
      <div class="btn-row coin-pick" id="${id}">
        <button type="button" class="btn ghost big" data-v="1">Heads</button>
        <button type="button" class="btn ghost big" data-v="2">Tails</button>
      </div>`;
  }
  return `
    <div class="phys-inputs one">
      <label><span>${esc(label)} (${dieName(sides)})</span>
        <input id="${id}" type="number" inputmode="numeric" min="1" max="${sides}" placeholder="1–${sides}"></label>
    </div>
    <button type="button" class="btn primary big" id="${id}-go">Use this roll</button>`;
}

// Reads a physical roll; calls back with a valid number.
function wirePhysical(id, sides, cb) {
  if (sides === 2) {
    $$(`#${id} button`).forEach((b) => b.addEventListener('click', () => cb(parseInt(b.dataset.v, 10))));
    return;
  }
  const go = () => {
    const v = parseInt($('#' + id).value, 10);
    if (!(v >= 1 && v <= sides)) return toast(`Enter a number from 1–${sides}.`);
    cb(v);
  };
  $('#' + id + '-go').addEventListener('click', go);
  $('#' + id).addEventListener('keydown', (e) => e.key === 'Enter' && go());
}

function renderRollArea() {
  const area = $('#roll-area');
  const fest = f();
  const mode = store.getState().settings.diceMode;
  const single = fest.mode === 'one' ? fest.categories[0] : null;

  if (r.phase === 'idle') {
    if (mode === 'physical') {
      if (single) {
        area.innerHTML = physicalInput(single.die, 'Movie', 'in-movie') + catKey(fest);
        wirePhysical('in-movie', single.die, (v) => showResult(single.id, v));
      } else {
        area.innerHTML = physicalInput(fest.categoryDie, 'Category', 'in-cat') + catKey(fest);
        wirePhysical('in-cat', fest.categoryDie, (v) => { afterCategory(v); renderRollArea(); });
      }
      return;
    }
    area.innerHTML = `
      ${diceRow(fest, { cat: single || fest.categories[0], showMovie: !!single })}
      <button type="button" class="btn primary big" id="btn-roll">Roll for tonight</button>
      ${catKey(fest)}`;
    $('#btn-roll').addEventListener('click', rollAll);
    return;
  }

  if (r.phase === 'rolling') return; // animation owns the DOM

  if (r.phase === 'pickCategory') {
    const choices = fest.categories.filter((c) => !store.isWild(fest, c));
    area.innerHTML = `
      ${mode === 'virtual' ? diceRow(fest, { catVal: r.catRoll }) : ''}
      <p class="wild-title">Wild Card!</p>
      <p class="roll-hint">Pick any category.</p>
      <div class="pick-grid">
        ${choices.map((c) => `<button type="button" class="pick" data-cat="${c.id}" style="--cat:${swatchHex(c.color)}">${esc(c.name)}</button>`).join('')}
      </div>
      ${choices.length ? '' : '<p class="roll-hint">Every category is empty. Add some movies in Tables first.</p>'}
      <button type="button" class="btn ghost" id="btn-cancel">Cancel</button>`;
    $$('.pick', area).forEach((b) => b.addEventListener('click', () => {
      r.catId = b.dataset.cat;
      r.wild = true;
      if (mode === 'virtual') rollMovie();
      else { r.phase = 'movieInput'; renderRollArea(); }
    }));
    $('#btn-cancel').addEventListener('click', () => { resetRoll(); renderRollArea(); });
    return;
  }

  if (r.phase === 'movieInput') {
    const cat = store.category(fest, r.catId);
    area.innerHTML = `
      <p class="roll-hint">Category: <strong style="color:${swatchHex(cat.color)}">${esc(cat.name)}</strong></p>
      ${physicalInput(cat.die, 'Movie', 'in-movie')}
      <button type="button" class="btn ghost" id="btn-cancel">Start over</button>`;
    wirePhysical('in-movie', cat.die, (v) => showResult(cat.id, v));
    $('#btn-cancel').addEventListener('click', () => { resetRoll(); renderRollArea(); });
    return;
  }

  // phase === 'result'
  const cat = store.category(fest, r.catId);
  if (!cat) { resetRoll(); return renderRollArea(); }
  const idx = r.movieRoll - 1;
  const movie = cat.slots[idx];
  const seen = movie && store.isSeen(fest, movie.id);
  const color = swatchHex(cat.color);
  const label = `${esc(cat.name)} · ${esc(faceLabel(cat.die, r.movieRoll))}`;

  let card, actions;
  const rerolls = `
    <div class="btn-row">
      <button type="button" class="btn ghost" data-act="reroll-movie">Reroll movie</button>
      ${fest.mode === 'two' ? '<button type="button" class="btn ghost" data-act="reroll-all">Reroll all</button>' : ''}
    </div>`;
  if (movie && !seen) {
    card = `
      <div class="pick-card" style="--cat:${color}">
        <p class="pick-cat">${label}</p>
        <p class="pick-title">${movieLabel(movie)}</p>
        ${movie.note ? `<p class="pick-note">Last time: ${esc(movie.note)}</p>` : ''}
      </div>
      <p class="roll-q">Watching it tonight?</p>`;
    actions = `<button type="button" class="btn primary big" data-act="watch">Yes, watch it</button>${rerolls}`;
  } else if (movie) {
    card = `
      <div class="pick-card seen" style="--cat:${color}">
        <p class="pick-cat">${label}</p>
        <p class="pick-title">${movieLabel(movie)}</p>
        <p class="pick-flag">Already watched at this festival</p>
      </div>`;
    actions = rerolls;
  } else {
    card = `
      <div class="pick-card empty" style="--cat:${color}">
        <p class="pick-cat">${label}</p>
        <p class="pick-title">Slot open</p>
        <p class="pick-flag">Fill it with a movie, or reroll.</p>
      </div>`;
    actions = `<button type="button" class="btn primary big" data-act="fill">Fill this slot</button>${rerolls}`;
  }

  area.innerHTML = `
    ${mode === 'virtual'
      ? diceRow(fest, { catVal: r.wild ? null : r.catRoll, catColor: color, cat, movieVal: r.movieRoll, showMovie: true })
      : `<p class="phys-echo">You rolled ${fest.mode === 'two' ? (r.wild ? 'Wild Card' : esc(faceLabel(fest.categoryDie, r.catRoll))) + ' and ' : ''}${esc(faceLabel(cat.die, r.movieRoll))}</p>`}
    ${card}
    <div class="roll-actions">${actions}</div>`;
  if (mode === 'virtual' && r.wild) $('#die-cat .die-num').textContent = 'W';

  area.querySelector('.roll-actions').addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    const act = b.dataset.act;
    if (act === 'watch') {
      const entry = store.watchMovie(fest.id, cat.id, idx);
      resetRoll();
      renderRoll();
      if (entry) toast(`${entry.title} added to your watched list. Enjoy!`);
    } else if (act === 'reroll-movie') {
      if (mode === 'virtual') rollMovie();
      else { r.phase = 'movieInput'; renderRollArea(); }
    } else if (act === 'reroll-all') {
      if (mode === 'virtual') rollAll();
      else { resetRoll(); renderRollArea(); }
    } else if (act === 'fill') {
      editSlotSheet(fest.id, cat.id, idx, () => renderRollArea());
    }
  });
}

// ---------- Rolling ----------

function afterCategory(catRoll) {
  const fest = f();
  const cat = fest.categories[catRoll - 1];
  r.catRoll = catRoll;
  if (!cat || store.isWild(fest, cat)) {
    r.phase = 'pickCategory';
    r.catId = null;
  } else {
    r.catId = cat.id;
    r.wild = false;
    r.phase = store.getState().settings.diceMode === 'virtual' ? 'rolling' : 'movieInput';
  }
}

function showResult(catId, movieRoll) {
  r.catId = catId;
  r.movieRoll = movieRoll;
  r.phase = 'result';
  renderRollArea();
}

async function rollAll() {
  const fest = f();
  r = idle();
  if (fest.mode === 'one') return rollMovie(fest.categories[0].id);

  r.phase = 'rolling';
  const area = $('#roll-area');
  area.innerHTML = diceRow(fest, {}) + '<button type="button" class="btn primary big" disabled>Rolling…</button>';
  const catRoll = randInt(1, fest.categoryDie);
  await tumble($('#die-cat'), fest.categoryDie, catRoll, 850);
  afterCategory(catRoll);
  if (r.phase === 'pickCategory') {
    await wait(350);
    return renderRollArea();
  }
  await wait(250);
  rollMovie();
}

async function rollMovie(catId) {
  const fest = f();
  if (catId) r.catId = catId;
  const cat = store.category(fest, r.catId);
  r.phase = 'rolling';
  const area = $('#roll-area');
  area.innerHTML = diceRow(fest, {
    catVal: r.wild ? null : r.catRoll, catColor: swatchHex(cat.color), cat, showMovie: true,
  }) + '<button type="button" class="btn primary big" disabled>Rolling…</button>';
  if (r.wild && fest.mode === 'two') $('#die-cat .die-num').textContent = 'W';
  const movieRoll = randInt(1, cat.die);
  await tumble($('#die-movie'), cat.die, movieRoll, 1000);
  await wait(300);
  showResult(cat.id, movieRoll);
}

// ---------- Reminder + recent ----------

function renderOpenSlots() {
  const box = $('#open-slots');
  const fest = f();
  const open = store.openSlots(fest);
  if (!open.length) { box.innerHTML = ''; return; }
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
  $$('button', box).forEach((b) => b.addEventListener('click', () => nav.go('tables', { cat: b.dataset.cat })));
}

function renderRecent() {
  const fest = f();
  const list = store.getState().history.filter((e) => e.festivalId === fest.id);
  const box = $('#recent');
  const items = list.slice(0, 3);
  box.innerHTML = `
    <div class="section-head">
      <h2 class="section-title">Recently watched</h2>
      ${list.length ? `<button type="button" class="link" id="see-all">See all ${list.length} ›</button>` : ''}
    </div>
    <ul class="watched-list">
      ${items.length ? items.map((e) => entryRow(e, false)).join('') : '<li class="empty-state">Nothing yet. Roll something and hit "Yes, watch it."</li>'}
    </ul>`;
  const all = $('#see-all', box);
  if (all) all.addEventListener('click', () => {
    nav.filters = { festival: fest.id };
    nav.go('watched');
  });
  $$('.watched-item', box).forEach((b) => b.addEventListener('click', () => entrySheet(b.dataset.id, renderRoll)));
}

// ---------- Wiring that only happens once ----------

export function initRoll() {
  $('#dice-mode').addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b || r.phase === 'rolling') return;
    store.setSetting('diceMode', b.dataset.value);
    resetRoll();
    renderRoll();
  });
}
