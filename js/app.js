// Boot, navigation, and the festival switcher.

import * as store from './store.js';
import { dieName } from './defaults.js';
import { applyTheme } from './themes.js';
import { iconSVG } from './icons.js';
import { $, $$, esc, nav, openSheet, closeSheet, initSheets, toast } from './ui.js';
import { renderRoll, initRoll, resetRoll } from './screens/roll.js';
import { renderWatched, initWatched } from './screens/watched.js';
import * as catalog from './catalog.js';
import * as dice3d from './dice3d.js';
import { startTutorial, initTutorial } from './tutorial.js';
import { renderEditor, initEditor } from './screens/editor.js';
import { renderPopcorn } from './screens/popcorn.js';
import { renderSettings, initSettings } from './screens/settings.js';
import { renderCreator, openCreator } from './screens/creator.js';
import { renderAccountSection, renderAdmin, initAccount, chooseSideSheet } from './screens/account.js';
import * as sync from './sync.js';

const SCREENS = ['home', 'watched', 'popcorn', 'settings', 'creator', 'edit', 'admin'];
const TABS = ['home', 'watched', 'popcorn', 'settings'];
let screen = 'home';
let lastTab = 'home'; // where "Done" / "Cancel" goes back to
let screenOpts = {};

function go(name, opts = {}) {
  if (name !== 'home') dice3d.clearNow();
  if (TABS.includes(name)) lastTab = name;
  screen = name;
  screenOpts = opts;
  for (const s of SCREENS) $('#screen-' + s).hidden = s !== name;
  $$('.tabbar button').forEach((b) => {
    if (b.dataset.screen === name) b.setAttribute('aria-current', 'page');
    else b.removeAttribute('aria-current');
  });
  render();
  window.scrollTo(0, 0);
}

function render() {
  const f = store.activeFestival();
  $('#fest-name').textContent = f.name;
  $('#fest-btn-icon').innerHTML = iconSVG(f.icon);
  if (screen === 'home') renderRoll();
  else if (screen === 'watched') renderWatched();
  else if (screen === 'popcorn') renderPopcorn();
  else if (screen === 'edit') renderEditor(screenOpts);
  else if (screen === 'settings') renderSettings();
  else if (screen === 'creator') renderCreator();
  else if (screen === 'admin') renderAdmin();
  screenOpts = {};
}

nav.go = go;
nav.back = () => go(lastTab);
nav.render = render;

// ---------- Festival switcher ----------

function festivalSheet() {
  const cur = store.activeFestival().id;
  const sheet = openSheet({
    title: 'Film festivals',
    body: `
      <ul class="fest-list">
        ${store.festivals().map((f) => `
          <li class="fest-row ${f.id === cur ? 'on' : ''}">
            <button type="button" class="fr-pick" data-id="${f.id}">
              <span class="fest-icon">${iconSVG(f.icon)}</span>
              <span class="fr-main"><span class="fr-name">${esc(f.name)}</span>
                <span class="fr-sub">${f.id === cur ? 'Now showing · ' : ''}${f.mode === 'one' ? `One ${dieName(f.categories[0].die)} list` : `${f.categories.length} categories`}${f.builtIn ? '' : ' · Custom'}</span></span>
            </button>
            <button type="button" class="btn ghost small fr-edit" data-edit="${f.id}" aria-label="Edit ${esc(f.name)}">Edit</button>
          </li>`).join('')}
      </ul>
      <button type="button" class="btn ghost big" id="btn-new-fest">+ Create a festival</button>`,
    actions: [{ label: 'Close', kind: 'ghost', onClick: closeSheet }],
  });
  const switchTo = (id) => {
    const changed = id !== store.activeFestival().id;
    store.setActiveFestival(id);
    const f = store.activeFestival();
    applyTheme(f);
    if (changed) resetRoll();
    return { f, changed };
  };
  $$('.fr-pick', sheet).forEach((b) => b.addEventListener('click', () => {
    const { f, changed } = switchTo(b.dataset.id);
    closeSheet();
    go(screen === 'creator' ? 'home' : screen);
    if (changed) toast(`Now showing: ${f.name}`);
  }));
  $$('.fr-edit', sheet).forEach((b) => b.addEventListener('click', () => {
    switchTo(b.dataset.edit);
    closeSheet();
    go('edit', { part: 'tables' });
  }));
  $('#btn-new-fest', sheet).addEventListener('click', () => { closeSheet(); openCreator(); });
}

// ---------- Boot ----------

initSheets();
store.load();
applyTheme(store.activeFestival());
$$('.tabbar button').forEach((b) => b.addEventListener('click', () => go(b.dataset.screen)));
$('#fest-btn').addEventListener('click', festivalSheet);
initRoll();
initWatched();
initSettings();
initEditor();
initAccount();
initTutorial();
$('#btn-tutorial').addEventListener('click', () => startTutorial(() => go('home')));
go('home');

// First time the app is opened on this device: show the quick tour.
if (!store.getState().settings.tutorialSeen) startTutorial();

// Load the movie catalog in the background, then link any movies typed before it existed.
// Accounts (only if js/firebase-config.js is filled in). Data from the account replaces this device's copy.
sync.start({
  onRemoteApplied: () => {
    applyTheme(store.activeFestival());
    if (screen === 'home') resetRoll();
    render();
  },
  chooseSide: chooseSideSheet,
});

catalog.load().then(() => {
  if (!catalog.isReady()) return;
  store.linkCatalog(catalog.match);
  catalog.loadAllCollections();
});

// 3D dice: start downloading in the background only if they're turned on.
if (store.getState().settings.diceStyle !== 'flat') {
  const later = window.requestIdleCallback || ((cb) => setTimeout(cb, 1500));
  later(() => dice3d.prepare());
}

if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
}
