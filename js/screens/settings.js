// SETTINGS screen: festival options, theme, slot mode, history, backup.

import * as store from '../store.js';
import { SWATCHES, RATING_ICONS, DIE_OPTIONS, dieName } from '../defaults.js';
import { themesFor, currentTheme, themeStyle, applyTheme } from '../themes.js';
import { iconSVG } from '../icons.js';
import {
  $, $$, esc, toast, nav, openSheet, closeSheet, confirmSheet, typedConfirm, syncSeg, dieChips, wireChips,
} from '../ui.js';

const diceSummary = (f) =>
  f.mode === 'one'
    ? `One die · a single ${dieName(f.categories[0].die)} list`
    : `Two dice · ${dieName(f.categoryDie)} for ${f.categories.length} categories`;

export function renderSettings() {
  const f = store.activeFestival();
  const s = store.getState().settings;

  $('#fest-card').innerHTML = `
    <div class="fest-head">
      <span class="fest-icon">${iconSVG(f.icon)}</span>
      <div><p class="fest-name">${esc(f.name)}</p><p class="fest-sub">${diceSummary(f)}${f.builtIn ? ' · Built-in' : ''}</p></div>
    </div>
    ${f.builtIn ? '' : `<button type="button" class="row-btn" id="btn-look"><span>Name, look &amp; icon</span><small>Rename it, change its accent color or rating icon</small></button>`}
    <button type="button" class="row-btn" id="btn-dice"><span>Festival dice</span><small>One die or two, and how many categories</small></button>
    <button type="button" class="row-btn" id="btn-fresh"><span>Start fresh</span><small>Clears the Seen marks on this festival's tables. History stays.</small></button>
    ${f.builtIn
      ? `<button type="button" class="row-btn" id="btn-restore"><span>Restore default tables</span><small>Puts the original categories and movies back</small></button>`
      : `<button type="button" class="row-btn danger" id="btn-delete-fest"><span>Delete festival</span><small>Removes it and its tables. Your watch history stays.</small></button>`}`;

  const themes = themesFor(f);
  const cur = currentTheme(f);
  $('#theme-grid').innerHTML = themes.map((t) => `
    <button type="button" class="theme-card ${t.id === cur.id ? 'on' : ''}" data-theme-id="${t.id}" style="${themeStyle(t)}">
      <span class="tc-swatch"><i></i><i></i><i></i></span>
      <span class="tc-name">${esc(t.name)}</span>
      <span class="tc-desc">${esc(t.desc)}</span>
    </button>`).join('');
  $$('.theme-card').forEach((b) => b.addEventListener('click', () => {
    store.setFestivalTheme(f.id, b.dataset.themeId);
    applyTheme(f);
    renderSettings();
  }));

  syncSeg($('#slot-mode'), s.slotMode);
  $('#slot-mode-hint').textContent = s.slotMode === 'keep'
    ? 'Watched movies stay in their slot, marked Seen. Rolling one offers a reroll.'
    : 'Watched movies leave the table. Their slot shows up under "slots to fill" on the Roll screen.';
  $('#storage-warning').hidden = store.canSave();

  const look = $('#btn-look');
  if (look) look.addEventListener('click', () => lookSheet(f.id));
  $('#btn-dice').addEventListener('click', () => diceSheet(f.id));
  $('#btn-fresh').addEventListener('click', () => confirmSheet(
    'Start fresh?',
    `Every movie in ${f.name} goes back to unseen, so rolls won't skip anything. Your watch history isn't touched.`,
    'Start fresh',
    () => { store.startFresh(f.id); nav.render(); toast(`${f.name} starts fresh.`); }
  ));
  const restore = $('#btn-restore');
  if (restore) restore.addEventListener('click', () => confirmSheet(
    'Restore default tables?',
    `${f.name}'s categories and movies go back to the originals, and its dice go back to a d6 and d12. Any movies you swapped in are removed. Your watch history isn't touched.`,
    'Restore',
    () => { store.restoreBuiltIn(f.id); nav.render(); toast('Default tables restored.'); },
    true
  ));
  const del = $('#btn-delete-fest');
  if (del) del.addEventListener('click', () => confirmSheet(
    `Delete ${f.name}?`,
    'The festival and its tables are removed. Movies you watched stay in your watch history.',
    'Delete festival',
    () => { store.deleteFestival(f.id); applyTheme(store.activeFestival()); nav.render(); toast('Festival deleted.'); },
    true
  ));
}

// ---------- Sheets ----------

function lookSheet(fId) {
  const f = store.festival(fId);
  let accent = f.accent;
  let icon = f.icon;
  const sheet = openSheet({
    title: 'Name, look & icon',
    body: `
      <label class="field"><span class="label">Name</span><input id="l-name" type="text" maxlength="40" value="${esc(f.name)}"></label>
      <div class="field"><span class="label">Accent color</span>
        <div class="swatches" id="l-accent">${SWATCHES.map((s) => `<button type="button" class="swatch ${s.id === accent ? 'on' : ''}" data-c="${s.id}" style="--sw:${s.hex}" aria-label="${s.id}"></button>`).join('')}</div>
        <p class="hint">Dark or light is picked under Theme.</p>
      </div>
      <div class="field"><span class="label">Rating icon</span>
        <div class="icon-grid" id="l-icon">${RATING_ICONS.map((n) => `<button type="button" class="icon-pick ${n === icon ? 'on' : ''}" data-i="${n}" aria-label="${n}">${iconSVG(n)}</button>`).join('')}</div>
        <p class="hint">Movies you already rated keep the icon they were rated with.</p>
      </div>`,
    actions: [
      { label: 'Cancel', kind: 'ghost', onClick: closeSheet },
      {
        label: 'Save', kind: 'primary', onClick: (s) => {
          const name = $('#l-name', s).value.trim();
          if (!name) return toast('Give it a name.');
          store.updateFestivalLook(fId, { name, icon, accent });
          applyTheme(f);
          closeSheet();
          nav.render();
        },
      },
    ],
  });
  $('#l-accent', sheet).addEventListener('click', (e) => {
    const b = e.target.closest('.swatch'); if (!b) return;
    accent = b.dataset.c;
    $$('#l-accent .swatch', sheet).forEach((x) => x.classList.toggle('on', x === b));
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
          <button type="button" data-value="two">Two: category + movie</button>
          <button type="button" data-value="one">One: a single list</button>
        </div>
      </div>
      <div class="field" id="d-cat-wrap"><span class="label">Category die (number of categories)</span>
        ${dieChips(DIE_OPTIONS, catDie, 'cat')}
      </div>
      <p class="hint" id="d-hint"></p>
      <p class="hint">Each category's own movie die is set from its Edit button in Tables.</p>`,
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

// Step 1 of clearing history: choose what. Step 2: type DELETE.
function clearHistorySheet() {
  const hist = store.getState().history;
  if (!hist.length) return toast('Your watch history is already empty.');
  const counts = new Map();
  hist.forEach((e) => counts.set(e.festivalId, (counts.get(e.festivalId) || 0) + 1));
  const name = (id) => {
    const f = store.festival(id);
    return f ? f.name : (hist.find((e) => e.festivalId === id) || {}).festivalName + ' (deleted)';
  };
  const sheet = openSheet({
    title: 'Clear watch history',
    body: `
      <p class="sheet-text">This permanently deletes watched movies, ratings, and notes. Export a backup first if you might want them.</p>
      <label class="field"><span class="label">What to clear</span>
        <select id="ch-scope">
          ${[...counts.entries()].map(([id, n]) => `<option value="${esc(id)}">${esc(name(id))} only (${n})</option>`).join('')}
          <option value="all">Everything (${hist.length})</option>
        </select>
      </label>`,
    actions: [
      { label: 'Cancel', kind: 'ghost', onClick: closeSheet },
      {
        label: 'Continue', kind: 'danger', onClick: (s) => {
          const scope = $('#ch-scope', s).value;
          const n = scope === 'all' ? hist.length : counts.get(scope);
          const what = scope === 'all' ? 'your entire watch history' : `your ${name(scope)} history`;
          typedConfirm(`Delete ${n} movie${n === 1 ? '' : 's'}?`, `This deletes ${what}. It can't be undone.`, () => {
            const removed = store.clearHistory(scope);
            nav.render();
            toast(`Deleted ${removed} movie${removed === 1 ? '' : 's'} from your history.`);
          });
        },
      },
    ],
  });
  const cur = store.activeFestival().id;
  if (counts.has(cur)) $('#ch-scope', sheet).value = cur;
}

// ---------- Backup ----------

async function exportBackup() {
  const name = `roll-credits-backup-${new Date().toISOString().slice(0, 10)}.json`;
  const blob = new Blob([store.exportJSON()], { type: 'application/json' });
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
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  return true;
}

export function initSettings() {
  $('#slot-mode').addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    store.setSetting('slotMode', b.dataset.value);
    renderSettings();
  });
  $('#btn-clear-history').addEventListener('click', clearHistorySheet);
  $('#btn-export').addEventListener('click', async () => { if (await exportBackup()) toast('Backup saved.'); });
  $('#btn-import').addEventListener('click', () => $('#import-file').click());
  $('#import-file').addEventListener('change', async (e) => {
    const file = e.target.files && e.target.files[0];
    e.target.value = '';
    if (!file) return;
    const text = await file.text();
    confirmSheet('Import this backup?', 'Everything currently in the app will be replaced with the backup.', 'Import', () => {
      if (store.importJSON(text)) {
        applyTheme(store.activeFestival());
        nav.render();
        toast('Backup loaded.');
      } else toast("That file isn't a Roll Credits backup.");
    });
  });
  $('#btn-reset').addEventListener('click', () => {
    confirmSheet(
      'Reset everything?',
      'All festivals, tables, watch history, and settings go back to a fresh install.',
      'Continue',
      () => typedConfirm('Really reset everything?', "This can't be undone. Export a backup first if you want to keep anything.", () => {
        store.resetAll();
        applyTheme(store.activeFestival());
        nav.render();
        toast('Back to a fresh install.');
      }),
      true
    );
  });
}
