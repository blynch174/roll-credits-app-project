// Boot, navigation, and the festival switcher.

import * as store from './store.js';
import { dieName } from './defaults.js';
import { applyTheme } from './themes.js';
import { iconSVG } from './icons.js';
import { $, $$, esc, nav, openSheet, closeSheet, initSheets, toast } from './ui.js';
import { renderRoll, initRoll, resetRoll } from './screens/roll.js';
import { renderWatched } from './screens/watched.js';
import { renderTables } from './screens/tables.js';
import { renderSettings, initSettings } from './screens/settings.js';
import { renderCreator, openCreator } from './screens/creator.js';

const SCREENS = ['home', 'watched', 'tables', 'settings', 'creator'];
let screen = 'home';
let screenOpts = {};

function go(name, opts = {}) {
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
  else if (screen === 'tables') renderTables(screenOpts);
  else if (screen === 'settings') renderSettings();
  else if (screen === 'creator') renderCreator();
  screenOpts = {};
}

nav.go = go;
nav.render = render;

// ---------- Festival switcher ----------

function festivalSheet() {
  const cur = store.activeFestival().id;
  const sheet = openSheet({
    title: 'Film festivals',
    body: `
      <ul class="fest-list">
        ${store.festivals().map((f) => `
          <li><button type="button" class="fest-row ${f.id === cur ? 'on' : ''}" data-id="${f.id}">
            <span class="fest-icon">${iconSVG(f.icon)}</span>
            <span class="fr-main"><span class="fr-name">${esc(f.name)}</span>
              <span class="fr-sub">${f.mode === 'one' ? `One ${dieName(f.categories[0].die)} list` : `${f.categories.length} categories`}${f.builtIn ? '' : ' · Custom'}</span></span>
            ${f.id === cur ? '<span class="badge">Now showing</span>' : ''}
          </button></li>`).join('')}
      </ul>
      <button type="button" class="btn ghost big" id="btn-new-fest">+ Create a festival</button>`,
    actions: [{ label: 'Close', kind: 'ghost', onClick: closeSheet }],
  });
  $$('.fest-row', sheet).forEach((b) => b.addEventListener('click', () => {
    store.setActiveFestival(b.dataset.id);
    const f = store.activeFestival();
    applyTheme(f);
    resetRoll();
    closeSheet();
    go(screen === 'creator' ? 'home' : screen);
    toast(`Now showing: ${f.name}`);
  }));
  $('#btn-new-fest', sheet).addEventListener('click', () => { closeSheet(); openCreator(); });
}

// ---------- Boot ----------

initSheets();
store.load();
applyTheme(store.activeFestival());
$$('.tabbar button').forEach((b) => b.addEventListener('click', () => go(b.dataset.screen)));
$('#fest-btn').addEventListener('click', festivalSheet);
$('#btn-new-festival').addEventListener('click', openCreator);
initRoll();
initSettings();
go('home');

if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
}
