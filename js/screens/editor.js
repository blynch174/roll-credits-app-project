// EDIT FESTIVAL screen: everything about one festival in one place.
// Two parts: Tables (its categories and movies) and Festival settings (dice, look, start fresh, restore/delete).
// Opened from the festival menu (tap the festival name at the top → Edit).
// Admins also use it for drafts of official festivals (Admin tools → Official festivals); then the settings
// tab shows Publish / Hide / Discard instead.

import * as store from '../store.js';
import { RATING_ICONS, DIE_OPTIONS, dieName } from '../defaults.js';
import { iconSVG } from '../icons.js';
import * as official from '../official.js';
import { $, $$, esc, toast, nav, openSheet, closeSheet, confirmSheet, syncSeg, dieChips, wireChips } from '../ui.js';
import { renderTables } from './tables.js';
import { reviewSheet } from './updates.js';
import { draftSettingsHTML, wireDraftSettings, closeDraftEditor } from './admin-official.js';

let part = 'tables'; // 'tables' | 'settings'

const diceSummary = (f) =>
  f.mode === 'one'
    ? `One die · a single ${dieName(f.categories[0].die)} list`
    : `Two dice · ${dieName(f.categoryDie)} for ${f.categories.length} categories`;

export function renderEditor(opts = {}) {
  if (opts.part) part = opts.part;
  if (opts.cat) part = 'tables';
  const f = store.editFestival();
  $('#edit-title').innerHTML = f.draftInfo
    ? `<span class="fest-icon small">${iconSVG(f.icon)}</span>${esc(f.name)}<span class="draft-pill">Official draft</span>`
    : `<span class="fest-icon small">${iconSVG(f.icon)}</span>Edit ${esc(f.name)}`;
  syncSeg($('#edit-tab'), part);
  $('#edit-tables').hidden = part !== 'tables';
  $('#edit-settings').hidden = part !== 'settings';
  if (part === 'tables') renderTables(opts);
  else renderFestivalSettings();
}

function renderFestivalSettings() {
  const f = store.editFestival();
  const head = `
    <div class="fest-head">
      <span class="fest-icon">${iconSVG(f.icon)}</span>
      <div><p class="fest-name">${esc(f.name)}</p><p class="fest-sub">${diceSummary(f)}${f.builtIn ? ' · Official' : ''}</p></div>
    </div>`;
  if (f.draftInfo) {
    $('#fest-card').innerHTML = head + draftSettingsHTML(f);
    $('#btn-look').addEventListener('click', () => lookSheet(f.id));
    $('#btn-dice').addEventListener('click', () => diceSheet(f.id));
    wireDraftSettings(f);
    return;
  }
  const upd = official.updateFor(f);
  $('#fest-card').innerHTML = `${head}
    ${upd ? `<button type="button" class="row-btn accent" id="btn-update"><span>Update Available</span><small>${esc(upd.message || (upd.kind === 'fix' ? 'Small fixes to the official tables' : 'A new version of this festival'))}</small></button>` : ''}
    ${f.builtIn ? '' : '<button type="button" class="row-btn" id="btn-look"><span>Name &amp; Rating Icon</span></button>'}
    <button type="button" class="row-btn" id="btn-dice"><span>Festival Dice</span></button>
    <button type="button" class="row-btn" id="btn-fresh"><span>Start Fresh</span></button>
    ${f.builtIn ? '<button type="button" class="row-btn" id="btn-restore"><span>Restore Default Tables</span></button>' : ''}
    ${store.festivals().length > 1 ? '<button type="button" class="row-btn danger" id="btn-delete-fest"><span>Delete Festival</span></button>' : ''}`;

  const ub = $('#btn-update');
  if (ub) ub.addEventListener('click', () => reviewSheet(f.id));

  const look = $('#btn-look');
  if (look) look.addEventListener('click', () => lookSheet(f.id));
  $('#btn-dice').addEventListener('click', () => diceSheet(f.id));
  $('#btn-fresh').addEventListener('click', () => confirmSheet(
    'Start fresh?',
    `Every movie in ${f.name} goes back to unseen, and slots that moved on to a sequel go back to the original. Your watch history isn't touched.`,
    'Start fresh',
    () => { store.startFresh(f.id); nav.render(); toast(`${f.name} starts fresh.`); }
  ));
  const restore = $('#btn-restore');
  if (restore) restore.addEventListener('click', () => confirmSheet(
    'Restore default tables?',
    `${f.name}'s categories, movies, and dice go back to the latest official version. Any movies you swapped in are removed. Your watch history isn't touched.`,
    'Restore',
    () => { store.restoreBuiltIn(f.id, official.get(f.id)); nav.render(); toast('Default tables restored.'); },
    true
  ));
  const del = $('#btn-delete-fest');
  if (del) del.addEventListener('click', () => confirmSheet(
    `Delete ${f.name}?`,
    f.builtIn
      ? 'Movies you watched stay in your watch history. You can add it back from the festival menu.'
      : 'Its tables are deleted. Movies you watched stay in your watch history.',
    'Delete festival',
    () => {
      store.deleteFestival(f.id);
      nav.go('home');
      toast(`${f.name} deleted.`);
    },
    true
  ));
}

function lookSheet(fId) {
  const f = store.festival(fId);
  let icon = f.icon;
  const sheet = openSheet({
    title: 'Name & rating icon',
    body: `
      <label class="field"><span class="label">Name</span><input id="l-name" type="text" maxlength="40" autocorrect="off" autocapitalize="words" spellcheck="false" enterkeyhint="done" value="${esc(f.name)}"></label>
      <div class="field"><span class="label">Rating icon</span>
        <div class="icon-grid" id="l-icon">${RATING_ICONS.map((n) => `<button type="button" class="icon-pick ${n === icon ? 'on' : ''}" data-i="${n}" aria-label="${n}">${iconSVG(n)}</button>`).join('')}</div>
      </div>`,
    actions: [
      { label: 'Cancel', kind: 'ghost', onClick: closeSheet },
      {
        label: 'Save', kind: 'primary', onClick: (s) => {
          const name = $('#l-name', s).value.trim();
          if (!name) return toast('Give it a name.');
          store.updateFestivalLook(fId, { name, icon });
          closeSheet();
          nav.render();
        },
      },
    ],
  });
  $('#l-icon', sheet).addEventListener('click', (e) => {
    const b = e.target.closest('.icon-pick'); if (!b) return;
    icon = b.dataset.i;
    $$('#l-icon .icon-pick', sheet).forEach((x) => x.classList.toggle('on', x === b));
  });
}

function diceSheet(fId) {
  const f = store.festival(fId);
  let mode = f.mode;
  let catDie = f.categoryDie || 6;
  const sheet = openSheet({
    title: 'Festival dice',
    body: `
      <div class="field"><span class="label">How many dice?</span>
        <div class="seg" id="d-mode">
          <button type="button" data-value="two">Two: Category + Movie</button>
          <button type="button" data-value="one">One: A Single List</button>
        </div>
      </div>
      <div class="field" id="d-cat-wrap"><span class="label">Category die (number of categories)</span>
        ${dieChips(DIE_OPTIONS, catDie, 'cat')}
      </div>
      <p class="hint" id="d-hint"></p>
`,
    actions: [
      { label: 'Cancel', kind: 'ghost', onClick: closeSheet },
      {
        label: 'Save', kind: 'primary', onClick: () => {
          const loss = store.festivalDiceLoss(f, mode, catDie);
          const apply = () => { store.setFestivalDice(fId, mode, catDie); nav.render(); toast('Dice updated.'); };
          closeSheet();
          if (loss.categories > 0) {
            confirmSheet(
              `Remove ${loss.categories} categor${loss.categories === 1 ? 'y' : 'ies'}?`,
              `This removes ${loss.categories} categor${loss.categories === 1 ? 'y' : 'ies'} and the ${loss.movies} movie${loss.movies === 1 ? '' : 's'} in ${loss.categories === 1 ? 'it' : 'them'} from this festival. Your watch history is not affected.`,
              'Remove and switch',
              apply,
              true
            );
          } else apply();
        },
      },
    ],
  });
  const update = () => {
    syncSeg($('#d-mode', sheet), mode);
    $('#d-cat-wrap', sheet).hidden = mode === 'one';
    const loss = store.festivalDiceLoss(f, mode, catDie);
    const count = mode === 'one' ? 1 : catDie;
    $('#d-hint', sheet).textContent = loss.categories
      ? `${loss.categories} categor${loss.categories === 1 ? 'y' : 'ies'} (${loss.movies} movie${loss.movies === 1 ? '' : 's'}) will be removed if you save.`
      : count > f.categories.length
        ? `${count - f.categories.length} empty categor${count - f.categories.length === 1 ? 'y' : 'ies'} will be added.`
        : mode === 'one' ? 'Rolls one die from a single list.' : `${count} categories.`;
  };
  $('#d-mode', sheet).addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    mode = b.dataset.value; update();
  });
  wireChips($('#d-cat-wrap', sheet), (n) => { catDie = n; update(); });
  update();
}

export function initEditor() {
  $('#edit-tab').addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    part = b.dataset.value;
    renderEditor();
    window.scrollTo(0, 0);
  });
  $('#edit-done').addEventListener('click', () => (store.currentDraft() ? closeDraftEditor() : nav.back()));
}
