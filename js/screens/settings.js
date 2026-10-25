// SETTINGS screen: app-wide options (dice style, slot mode, sequels), history, help, backup.
// Anything about a single festival lives in the Edit festival screen (editor.js).

import * as store from '../store.js';
import { applyTheme, themeById } from '../themes.js';
import * as dice3d from '../dice3d.js';
import * as sync from '../sync.js';
import { renderAccountSection } from './account.js';
import { servicesSheet } from './services.js';
import {
  $, esc, toast, nav, openSheet, closeSheet, confirmSheet, typedConfirm, syncSeg,
} from '../ui.js';

export function renderSettings() {
  const s = store.getState().settings;

  syncSeg($('#slot-mode'), s.slotMode);
  $('#slot-mode-hint').textContent = s.slotMode === 'keep'
    ? 'Watched movies stay on the table, marked Seen.'
    : 'Watched movies leave the table.';
  syncSeg($('#dice-style'), s.diceStyle === 'flat' ? 'flat' : '3d');
  $('#dice-style-hint').textContent = s.diceStyle !== 'flat' && dice3d.hasFailed()
    ? "3D dice couldn't start on this device, so rolls use flat dice."
    : '';
  syncSeg($('#sequel-mode'), s.sequels === false ? 'off' : 'on');
  $('#sequel-hint').textContent = s.sequels === false ? '' : 'Seen Scream? Rolling it offers Scream 2.';
  $('#storage-warning').hidden = store.canSave();
  $('#theme-current').textContent = themeById(store.themeId()).name;
  const nServices = Array.isArray(s.myServices) ? s.myServices.length : 0;
  $('#services-count').textContent = nServices ? `${nServices} picked` : 'Off';
  renderAccountSection();
  const b = store.syncBackup();
  $('#btn-restore-sync').hidden = !b;
  if (b) $('#restore-sync-when').textContent = `From before the sync on ${new Date(b.at).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}`;

}

// ---------- Sheets ----------

// Step 1 of clearing history: choose what. Step 2: type DELETE.
function clearHistorySheet() {
  const hist = store.getState().history;
  if (!hist.length) return toast('Your watch history is already empty.');
  const counts = new Map();
  hist.forEach((e) => counts.set(e.festivalId, (counts.get(e.festivalId) || 0) + 1));
  const name = (id) => store.historyGroupName(id);
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
  $('#dice-style').addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    store.setSetting('diceStyle', b.dataset.value);
    store.setSetting('diceStyleChosen', true);
    if (b.dataset.value === '3d') dice3d.prepare().then(() => renderSettings());
    renderSettings();
  });
  $('#sequel-mode').addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    store.setSetting('sequels', b.dataset.value === 'on');
    renderSettings();
  });
  $('#btn-clear-history').addEventListener('click', clearHistorySheet);
  $('#btn-services').addEventListener('click', () => servicesSheet(renderSettings));
  $('#btn-themes').addEventListener('click', () => nav.go('themes'));
  $('#btn-export').addEventListener('click', async () => { if (await exportBackup()) toast('Backup saved.'); });
  $('#btn-import').addEventListener('click', () => $('#import-file').click());
  $('#import-file').addEventListener('change', async (e) => {
    const file = e.target.files && e.target.files[0];
    e.target.value = '';
    if (!file) return;
    const text = await file.text();
    confirmSheet('Import this backup?', 'Everything currently in the app will be replaced with the backup.', 'Import', () => {
      if (store.importJSON(text)) {
        applyTheme(store.themeId());
        nav.render();
        toast('Backup loaded.');
      } else toast("That file isn't a Roll Credits backup.");
    });
  });
  $('#btn-restore-sync').addEventListener('click', () => {
    confirmSheet('Restore previous data?', "Brings back this device's festivals and history from before that sync. Nothing here now gets deleted.", 'Restore', () => {
      if (store.restoreSyncBackup()) {
        applyTheme(store.themeId());
        nav.render();
        toast('Previous data restored.');
      }
    });
  });
  $('#btn-reset').addEventListener('click', () => {
    confirmSheet(
      'Reset everything?',
      sync.isSignedIn()
        ? "All festivals, tables, watch history, and settings go back to a fresh install, here and in your account's backup."
        : 'All festivals, tables, watch history, and settings go back to a fresh install.',
      'Continue',
      () => typedConfirm('Really reset everything?', "This can't be undone. Export a backup first if you want to keep anything.", () => {
        store.resetAll();
        applyTheme(store.themeId());
        nav.render();
        toast('Back to a fresh install.');
      }),
      true
    );
  });
}
