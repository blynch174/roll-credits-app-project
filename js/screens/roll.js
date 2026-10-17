// ROLL screen: dice, result card, slots-to-fill reminder, recently watched.

import * as store from '../store.js';
import * as catalog from '../catalog.js';
import { swatchHex, dieName } from '../defaults.js';
import { randInt, tumble, showFace, wait, faceLabel } from '../dice.js';
import * as dice3d from '../dice3d.js';
import { $, $$, esc, toast, nav, dieHTML, movieLabel, syncSeg, attachSwipe, openSheet, closeSheet } from '../ui.js';
import { editSlotSheet } from './tables.js';
import { entrySheet, entryRow, swipeDelete } from './watched.js';
import { posterImg, metaLine, catalogMovie, movieInfoSheet } from '../movieinfo.js';

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
  const seen = movie && store.isSeen(fest, movie);
  // Sequel switching: if this one's been seen, offer the next unseen entry in its series.
  let sequel = null;
  if (seen && store.getState().settings.sequels && movie.catalogId && catalog.isReady()) {
    sequel = catalog.nextInFranchise(movie.catalogId,
      (x) => !store.isCatalogSeen(fest, x.id) && !store.onTables(fest, x.id), fest.id);
  }
  const color = swatchHex(cat.color);
  const label = `${esc(cat.name)} · ${esc(faceLabel(cat.die, r.movieRoll))}`;

  let card, actions;
  // Two buttons side by side: the main action, and Reroll (which asks: this movie, or everything).
  const pair = (main) => `<div class="pair-actions">${main}<button type="button" class="btn ghost big" data-act="reroll">Reroll It</button></div>`;
  const cm = movie ? catalogMovie(movie.catalogId) : null;
  if (movie && !seen) {
    card = `
      <div class="pick-card${cm && cm.posterPath ? ' has-poster' : ''}" style="--cat:${color}">
        ${posterImg(cm, 'pick-poster')}
        <div class="pick-body">
          <p class="pick-cat">${label}</p>
          <p class="pick-title">${movieLabel(movie)}</p>
          ${cm ? `<p class="pick-meta">${esc(metaLine(cm))}</p>` : ''}
          ${movie.note ? `<p class="pick-note">Last time: ${esc(movie.note)}</p>` : ''}
          ${cm ? '<button type="button" class="link pick-info" data-act="info">Details, IMDb &amp; TMDB</button>' : ''}
        </div>
      </div>
      <p class="roll-q">Watching it tonight?</p>`;
    actions = pair('<button type="button" class="btn big btn-watch" data-act="watch">Watch it</button>');
  } else if (movie && sequel) {
    card = `
      <div class="pick-card" style="--cat:${color}">
        <p class="pick-cat">${label}</p>
        <p class="pick-was">Already seen <s>${movieLabel(movie)}</s></p>
        <p class="pick-title">${esc(sequel.title)} <span class="year">(${sequel.releaseYear})</span></p>
        <p class="pick-flag">Next in the ${esc(sequel.franchise)} series</p>
      </div>
      <p class="roll-q">Watch the sequel instead?</p>`;
    actions = `${pair('<button type="button" class="btn big btn-watch" data-act="sequel">Watch it</button>')}
      <button type="button" class="link rewatch-link" data-act="watch">Rewatch ${esc(movie.title)} instead</button>`;
  } else if (movie) {
    card = `
      <div class="pick-card seen" style="--cat:${color}">
        <p class="pick-cat">${label}</p>
        <p class="pick-title">${movieLabel(movie)}</p>
        <p class="pick-flag">Already watched at this festival</p>
      </div>`;
    actions = pair('<button type="button" class="btn big btn-watch" data-act="watch">Rewatch</button>');
  } else {
    card = `
      <div class="pick-card empty" style="--cat:${color}">
        <p class="pick-cat">${label}</p>
        <p class="pick-title">Slot open</p>
        <p class="pick-flag">Fill it with a movie, or reroll.</p>
      </div>`;
    actions = pair('<button type="button" class="btn primary big" data-act="fill">Fill slot</button>');
  }

  area.innerHTML = `
    ${mode === 'virtual'
      ? diceRow(fest, { catVal: r.wild ? null : r.catRoll, catColor: color, cat, movieVal: r.movieRoll, showMovie: true })
      : `<p class="phys-echo">You rolled ${fest.mode === 'two' ? (r.wild ? 'Wild Card' : esc(faceLabel(fest.categoryDie, r.catRoll))) + ' and ' : ''}${esc(faceLabel(cat.die, r.movieRoll))}</p>`}
    ${card}
    <div class="roll-actions">${actions}</div>`;
  if (mode === 'virtual' && r.wild) setWild();
  const info = area.querySelector('.pick-info');
  if (info) info.addEventListener('click', () => movieInfoSheet(cm));

  area.querySelector('.roll-actions').addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    const act = b.dataset.act;
    if (act === 'watch' || act === 'sequel') {
      if (act === 'sequel') store.stepToSequel(fest.id, cat.id, idx, sequel);
      const entry = store.watchMovie(fest.id, cat.id, idx);
      resetRoll();
      renderRoll();
      if (entry) toast(`${entry.title} added to your watched list. Enjoy!`);
    } else if (act === 'reroll') {
      const rerollMovie = () => { if (mode === 'virtual') rollMovie(); else { r.phase = 'movieInput'; renderRollArea(); } };
      const rerollAll = () => { if (mode === 'virtual') rollAll(); else { resetRoll(); renderRollArea(); } };
      if (fest.mode !== 'two') return rerollMovie(); // one die: nothing to choose between
      openSheet({
        title: 'Reroll',
        actions: [
          { label: 'Reroll movie', kind: 'primary', onClick: () => { closeSheet(); rerollMovie(); } },
          { label: 'Reroll all', kind: 'primary', onClick: () => { closeSheet(); rerollAll(); } },
          { label: 'Cancel', kind: 'ghost', onClick: closeSheet },
        ],
      });
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

// The Wild Card shows a W on the category die (coins have no number to replace).
function setWild() {
  const n = $('#die-cat .die-num');
  if (n) n.textContent = 'W';
}

const use3D = () => store.getState().settings.diceStyle !== 'flat' && !dice3d.hasFailed();
const accentColor = () => getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#ff7a1a';

// Rolls one die: 3D when it's on and supported, otherwise the flat tumble (and always the coin for d2).
async function throwDie(el, sides, color, flatDuration) {
  if (use3D() && dice3d.supports(sides)) {
    const btn = $('#roll-area .btn.primary');
    if (btn && !dice3d.isLoaded()) btn.textContent = 'Loading 3D dice…';
    const v = await dice3d.roll(sides, color);
    if (btn) btn.textContent = 'Rolling…';
    if (v) {
      await showFace(el, sides, v);
      return v;
    }
    if (dice3d.hasFailed()) toast("3D dice couldn't start here, so these are flat dice.");
  }
  const v = randInt(1, sides);
  await tumble(el, sides, v, flatDuration);
  return v;
}

async function rollAll() {
  const fest = f();
  r = idle();
  if (fest.mode === 'one') return rollMovie(fest.categories[0].id);

  r.phase = 'rolling';
  const area = $('#roll-area');
  area.innerHTML = diceRow(fest, {}) + '<button type="button" class="btn primary big" disabled>Rolling…</button>';
  const catRoll = await throwDie($('#die-cat'), fest.categoryDie, accentColor(), 850);
  afterCategory(catRoll);
  if (r.phase === 'pickCategory') {
    dice3d.settle();
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
  if (r.wild && fest.mode === 'two') setWild();
  const movieRoll = await throwDie($('#die-movie'), cat.die, swatchHex(cat.color), 1000);
  dice3d.settle();
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
  $$('button', box).forEach((b) => b.addEventListener('click', () => nav.go('edit', { cat: b.dataset.cat })));
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
      ${items.length ? items.map((e) => entryRow(e, false)).join('') : '<li class="empty-state">Nothing yet. Roll something and hit Watch it.</li>'}
    </ul>`;
  const all = $('#see-all', box);
  if (all) all.addEventListener('click', () => {
    nav.filters = { festival: fest.id };
    nav.go('watched');
  });
  $$('.watched-item', box).forEach((b) => b.addEventListener('click', () => entrySheet(b.dataset.id, renderRoll)));
  attachSwipe($('.watched-list', box), (id) => swipeDelete(id, renderRoll));
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
