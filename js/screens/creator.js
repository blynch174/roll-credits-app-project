// FESTIVAL CREATOR: name, look, rating icon, dice. Tables get filled in afterward.

import * as store from '../store.js';
import { SWATCHES, RATING_ICONS, DIE_OPTIONS, dieName } from '../defaults.js';
import { customThemes, themeStyle, applyTheme } from '../themes.js';
import { iconSVG } from '../icons.js';
import { $, $$, esc, toast, nav, syncSeg, dieChips, wireChips } from '../ui.js';

let form;

function blankForm() {
  return { copyFrom: '', name: '', base: 'dark', accent: 'teal', icon: 'star', mode: 'two', categoryDie: 6, movieDie: 12 };
}

export function openCreator() {
  form = blankForm();
  nav.go('creator');
}

export function renderCreator() {
  if (!form) form = blankForm();
  const fests = store.festivals();
  $('#creator').innerHTML = `
    <div class="creator-head">
      <button type="button" class="link" id="cr-cancel">‹ Cancel</button>
      <h2 class="creator-title">New festival</h2>
    </div>

    <div class="card form-card">
      <label class="field"><span class="label">Start from</span>
        <select id="cr-copy">
          <option value="">Blank: I'll add everything</option>
          ${fests.map((f) => `<option value="${f.id}" ${form.copyFrom === f.id ? 'selected' : ''}>Copy of ${esc(f.name)}</option>`).join('')}
        </select>
      </label>
      <label class="field"><span class="label">Name</span>
        <input id="cr-name" type="text" maxlength="40" placeholder="Summer Blockbusters, Bond Marathon…" value="${esc(form.name)}"></label>
    </div>

    <h3 class="section-title">Look</h3>
    <div class="card form-card">
      <div class="seg" id="cr-base">
        <button type="button" data-value="dark">Dark</button>
        <button type="button" data-value="light">Light</button>
      </div>
      <div class="swatches" id="cr-accent">
        ${SWATCHES.map((s) => `<button type="button" class="swatch ${s.id === form.accent ? 'on' : ''}" data-c="${s.id}" style="--sw:${s.hex}" aria-label="${s.id}"></button>`).join('')}
      </div>
      <div class="preview" id="cr-preview"></div>
    </div>

    <h3 class="section-title">Rating icon</h3>
    <div class="card form-card">
      <div class="icon-grid" id="cr-icon">
        ${RATING_ICONS.map((n) => `<button type="button" class="icon-pick ${n === form.icon ? 'on' : ''}" data-i="${n}" aria-label="${n}">${iconSVG(n)}</button>`).join('')}
      </div>
    </div>

    <h3 class="section-title">Dice</h3>
    <div class="card form-card" id="cr-dice">
      <div class="seg" id="cr-mode">
        <button type="button" data-value="two">Two dice</button>
        <button type="button" data-value="one">One die</button>
      </div>
      <p class="hint" id="cr-mode-hint"></p>
      <div class="field" id="cr-cat-wrap"><span class="label">Category die</span>${dieChips(DIE_OPTIONS, form.categoryDie, 'cat')}</div>
      <div class="field"><span class="label">Movie die</span>${dieChips(DIE_OPTIONS, form.movieDie, 'movie')}</div>
      <p class="summary" id="cr-summary"></p>
    </div>

    <button type="button" class="btn primary big" id="cr-create">Create festival</button>
    <p class="hint center">Next, you'll fill in the tables. Each category's die can be changed later.</p>`;

  const refresh = () => {
    syncSeg($('#cr-base'), form.base);
    syncSeg($('#cr-mode'), form.mode);
    const theme = customThemes(form.accent)[form.base === 'light' ? 1 : 0];
    $('#cr-preview').setAttribute('style', themeStyle(theme));
    $('#cr-preview').innerHTML = `
      <span class="pv-title">${esc(form.name || 'Your festival')}</span>
      <span class="pv-btn">Roll for tonight</span>
      <span class="pv-icons">${[1, 2, 3, 4, 5].map((i) => `<span class="ricon ${i <= 3 ? 'on' : ''}">${iconSVG(form.icon)}</span>`).join('')}</span>`;
    $('#cr-cat-wrap').hidden = form.mode === 'one';
    $('#cr-mode-hint').textContent = form.mode === 'two'
      ? 'The first die picks a category, the second picks a movie in it.'
      : 'No categories: one die picks straight from a single list.';
    const cats = form.mode === 'one' ? 1 : form.categoryDie;
    $('#cr-summary').textContent = form.mode === 'one'
      ? `1 list × ${form.movieDie} movies (${dieName(form.movieDie)})`
      : `${cats} categories (${dieName(form.categoryDie)}) × ${form.movieDie} movies each (${dieName(form.movieDie)}) = ${cats * form.movieDie} slots`;
    $$('#creator .die-chips').forEach((row) => {
      const val = row.dataset.name === 'cat' ? form.categoryDie : form.movieDie;
      $$('.die-chip', row).forEach((b) => b.classList.toggle('on', +b.dataset.die === val));
    });
  };

  $('#cr-cancel').addEventListener('click', () => { form = null; nav.go('settings'); });
  $('#cr-copy').addEventListener('change', (e) => {
    form.copyFrom = e.target.value;
    const src = store.festival(form.copyFrom);
    if (src) {
      form.mode = src.mode;
      form.categoryDie = src.categoryDie || 6;
      form.movieDie = src.categories[0].die;
      form.icon = src.icon;
      if (!form.name) { form.name = `My ${src.name}`; $('#cr-name').value = form.name; }
      $$('#cr-icon .icon-pick').forEach((x) => x.classList.toggle('on', x.dataset.i === form.icon));
    }
    refresh();
  });
  $('#cr-name').addEventListener('input', (e) => { form.name = e.target.value; refresh(); });
  $('#cr-base').addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    form.base = b.dataset.value; refresh();
  });
  $('#cr-mode').addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    form.mode = b.dataset.value; refresh();
  });
  $('#cr-accent').addEventListener('click', (e) => {
    const b = e.target.closest('.swatch'); if (!b) return;
    form.accent = b.dataset.c;
    $$('#cr-accent .swatch').forEach((x) => x.classList.toggle('on', x === b));
    refresh();
  });
  $('#cr-icon').addEventListener('click', (e) => {
    const b = e.target.closest('.icon-pick'); if (!b) return;
    form.icon = b.dataset.i;
    $$('#cr-icon .icon-pick').forEach((x) => x.classList.toggle('on', x === b));
    refresh();
  });
  wireChips($('#cr-dice'), (n, which) => {
    if (which === 'cat') form.categoryDie = n; else form.movieDie = n;
    refresh();
  });
  $('#cr-create').addEventListener('click', () => {
    if (!form.name.trim()) { $('#cr-name').focus(); return toast('Give your festival a name.'); }
    const f = store.createFestival({ ...form, copyFrom: form.copyFrom || null });
    form = null;
    applyTheme(f);
    nav.go('tables');
    toast(`${f.name} is ready. Fill in your tables!`);
  });
  refresh();
}
