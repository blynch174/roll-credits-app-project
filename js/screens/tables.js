// TABLES screen: category chips and the slots for the chosen category.

import * as store from '../store.js';
import { SWATCHES, DIE_OPTIONS, swatchHex, dieName } from '../defaults.js';
import { randInt, faceLabel } from '../dice.js';
import {
  $, $$, esc, toast, openSheet, closeSheet, confirmSheet, movieLabel, dieChips, wireChips,
} from '../ui.js';

let currentCat = null;

export function renderTables(opts = {}) {
  const f = store.activeFestival();
  if (opts.cat) currentCat = opts.cat;
  if (!currentCat || !store.category(f, currentCat)) currentCat = f.categories[0].id;
  const cat = store.category(f, currentCat);
  const color = swatchHex(cat.color);
  const seen = store.seenIds(f);

  const chips = $('#chips');
  if (f.mode === 'two') {
    chips.hidden = false;
    chips.innerHTML = f.categories.map((c, i) => `
      <button type="button" role="tab" class="chip ${c.id === cat.id ? 'on' : ''}" data-cat="${c.id}" style="--cat:${swatchHex(c.color)}" aria-selected="${c.id === cat.id}">
        <span class="chip-n">${esc(faceLabel(f.categoryDie, i + 1))}</span>${esc(c.name)}
      </button>`).join('');
    $$('.chip', chips).forEach((b) => b.addEventListener('click', () => {
      currentCat = b.dataset.cat;
      renderTables();
    }));
    const active = $('.chip.on', chips);
    if (active) active.scrollIntoView({ block: 'nearest', inline: 'center' });
  } else {
    chips.hidden = true;
  }

  const filled = store.filledCount(cat);
  $('#cat-header').innerHTML = `
    <div class="cat-header" style="--cat:${color}">
      <div>
        <h2 class="cat-name">${esc(cat.name)}</h2>
        <p class="cat-count">${filled} of ${cat.die} filled · rolls a ${dieName(cat.die)}</p>
      </div>
      <div class="cat-tools">
        <button type="button" class="btn ghost small" id="btn-edit-cat">Edit</button>
        <button type="button" class="btn ghost small" id="btn-shuffle" ${filled < 2 ? 'disabled' : ''}>Shuffle</button>
      </div>
    </div>
    ${store.isWild(f, cat) ? `<p class="wild-note">This category is empty, so it works as the <strong>Wild Card</strong>: rolling its number lets you pick any category. Add movies to make it your own.</p>` : ''}`;
  $('#btn-edit-cat').addEventListener('click', () => editCategorySheet(f.id, cat.id));
  $('#btn-shuffle').addEventListener('click', () => {
    store.shuffleCategory(f.id, cat.id, randInt);
    renderTables();
    toast('Shuffled.');
  });

  $('#slot-list').innerHTML = cat.slots.map((m, i) => {
    const n = esc(faceLabel(cat.die, i + 1));
    if (!m) {
      return `<li><button type="button" class="slot empty" data-i="${i}" style="--cat:${color}">
        <span class="slot-n">${n}</span><span class="slot-main"><span class="slot-title">Empty slot</span><span class="slot-sub">Tap to add a movie</span></span></button></li>`;
    }
    const isSeen = seen.has(m.id);
    return `<li><button type="button" class="slot ${isSeen ? 'seen' : ''}" data-i="${i}" style="--cat:${color}">
      <span class="slot-n">${n}</span>
      <span class="slot-main">
        <span class="slot-title">${movieLabel(m)}</span>
        ${m.note ? `<span class="slot-note">Note: ${esc(m.note)}</span>` : ''}
      </span>
      ${isSeen ? '<span class="badge">Seen</span>' : ''}
    </button></li>`;
  }).join('');
  $$('#slot-list .slot').forEach((b) =>
    b.addEventListener('click', () => editSlotSheet(f.id, cat.id, parseInt(b.dataset.i, 10), () => renderTables()))
  );
}

export function editSlotSheet(fId, catId, index, after) {
  const f = store.festival(fId);
  const cat = store.category(f, catId);
  const m = cat.slots[index];
  const actions = [{ label: 'Cancel', kind: 'ghost', onClick: closeSheet }];
  if (m) {
    actions.push({
      label: 'Clear slot',
      kind: 'danger-ghost',
      onClick: () => { store.clearSlot(fId, catId, index); closeSheet(); after && after(); },
    });
  }
  actions.push({
    label: 'Save',
    kind: 'primary',
    onClick: (sheet) => {
      const title = $('#f-title', sheet).value.trim();
      if (!title) { $('#f-title', sheet).focus(); return toast('A title is required.'); }
      store.setSlot(fId, catId, index, { title, year: $('#f-year', sheet).value });
      closeSheet();
      after && after();
    },
  });
  openSheet({
    title: `${cat.name} · ${faceLabel(cat.die, index + 1)}`,
    body: `
      <div class="field-row">
        <label class="field grow"><span class="label">Title <em>required</em></span>
          <input id="f-title" type="text" maxlength="120" autocomplete="off" value="${m ? esc(m.title) : ''}" placeholder="Movie title"></label>
        <label class="field year"><span class="label">Year</span>
          <input id="f-year" type="number" inputmode="numeric" min="1888" max="2999" value="${m && m.year ? m.year : ''}" placeholder="Optional"></label>
      </div>
      ${m && store.isSeen(f, m.id) ? '<p class="hint">Changing the title swaps in a new movie. Your watch history is not affected.</p>' : ''}`,
    actions,
  });
}

function editCategorySheet(fId, catId) {
  const f = store.festival(fId);
  const cat = store.category(f, catId);
  let color = cat.color;
  let die = cat.die;
  const sheet = openSheet({
    title: f.mode === 'one' ? 'Edit list' : 'Edit category',
    body: `
      <label class="field"><span class="label">Name</span>
        <input id="c-name" type="text" maxlength="40" value="${esc(cat.name)}"></label>
      <div class="field"><span class="label">Color</span>
        <div class="swatches" id="c-swatches">
          ${SWATCHES.map((s) => `<button type="button" class="swatch ${s.id === color ? 'on' : ''}" data-c="${s.id}" style="--sw:${s.hex}" aria-label="${s.id}"></button>`).join('')}
        </div>
      </div>
      <div class="field" id="c-die-wrap"><span class="label">Movie die (number of slots)</span>
        ${dieChips(DIE_OPTIONS, die, 'movie')}
        <p class="hint" id="c-die-hint"></p>
      </div>
      <button type="button" class="btn danger-text" id="btn-clear-cat">Clear all slots</button>`,
    actions: [
      { label: 'Cancel', kind: 'ghost', onClick: closeSheet },
      {
        label: 'Save',
        kind: 'primary',
        onClick: (s) => {
          const name = $('#c-name', s).value.trim();
          if (!name) return toast('Give it a name.');
          const apply = () => {
            store.updateCategory(fId, catId, { name, color });
            if (die !== cat.die) store.setCategoryDie(fId, catId, die);
            renderTables();
          };
          const loss = store.categoryDieLoss(cat, die);
          closeSheet();
          if (loss > 0) {
            confirmSheet(
              `Remove ${loss} movie${loss === 1 ? '' : 's'}?`,
              `Switching to a ${dieName(die)} leaves ${die} slots, so ${loss} movie${loss === 1 ? '' : 's'} in slots ${die + 1}–${cat.die} will be removed from this table. Your watch history is not affected.`,
              'Remove and switch',
              apply,
              true
            );
          } else apply();
        },
      },
    ],
  });
  const hint = $('#c-die-hint', sheet);
  const setHint = () => {
    const loss = store.categoryDieLoss(cat, die);
    hint.textContent = loss ? `${loss} movie${loss === 1 ? '' : 's'} will be removed if you save.` : `${die} slots.`;
  };
  setHint();
  wireChips($('#c-die-wrap', sheet), (n) => { die = n; setHint(); });
  $('#c-swatches', sheet).addEventListener('click', (e) => {
    const b = e.target.closest('.swatch');
    if (!b) return;
    color = b.dataset.c;
    $$('.swatch', sheet).forEach((x) => x.classList.toggle('on', x === b));
  });
  $('#btn-clear-cat', sheet).addEventListener('click', () => {
    confirmSheet(
      'Clear every slot?',
      `All movies in ${cat.name} will be removed from the table.${f.mode === 'two' ? ' An empty category acts as the Wild Card.' : ''}`,
      'Clear it',
      () => { store.clearCategory(fId, catId); renderTables(); },
      true
    );
  });
}
