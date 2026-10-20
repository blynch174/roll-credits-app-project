// Boot, navigation, and the festival switcher.

import * as store from './store.js';
import { dieName, BUILT_IN_FESTIVALS } from './defaults.js';
import { applyTheme } from './themes.js';
import { iconSVG } from './icons.js';
import { $, $$, esc, nav, openSheet, swapSheet, closeSheet, initSheets, toast, attachSwipe } from './ui.js';
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
import * as official from './official.js';
import { renderBanner } from './screens/updates.js';
import { renderThemePicker, initThemePicker } from './screens/theme-picker.js';
import { leaveDraft } from './screens/admin-official.js';

const SCREENS = ['home', 'watched', 'popcorn', 'settings', 'creator', 'edit', 'admin', 'themes'];
const TABS = ['home', 'watched', 'popcorn', 'settings'];
let screen = 'home';
let lastTab = 'home'; // where "Done" / "Cancel" goes back to
let screenOpts = {};

function go(name, opts = {}) {
  if (name !== 'home') dice3d.clearNow();
  // Leaving an official festival draft (any navigation that isn't the draft editor itself) saves and closes it.
  if (store.currentDraft() && !opts.keepDraft) leaveDraft();
  if (TABS.includes(name)) lastTab = name;
  screen = name;
  screenOpts = opts;
  for (const s of SCREENS) $('#screen-' + s).hidden = s !== name;
  $('#fest-btn').hidden = name !== 'home'; // the festival only matters on the Roll screen
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
  if (screen === 'home') { renderBanner(); renderRoll(); }
  else if (screen === 'watched') renderWatched();
  else if (screen === 'popcorn') renderPopcorn();
  else if (screen === 'edit') renderEditor(screenOpts);
  else if (screen === 'settings') renderSettings();
  else if (screen === 'creator') renderCreator();
  else if (screen === 'admin') renderAdmin();
  else if (screen === 'themes') renderThemePicker();
  screenOpts = {};
}

nav.go = go;
nav.back = () => go(lastTab);
nav.render = render;

// ---------- Festival switcher ----------

function festivalSheet() {
  const cur = store.activeFestival().id;
  const canDelete = store.festivals().length > 1;
  const removed = store.removedOfficial()
    .map((id) => official.get(id) || BUILT_IN_FESTIVALS.find((d) => d.id === id))
    .filter(Boolean);
  const sheet = openSheet({
    title: 'Film festivals',
    body: `
      <ul class="fest-list" id="fest-list">
        ${store.festivals().map((f) => `
          <li class="${canDelete ? 'swipe-row' : ''}">
            ${canDelete ? '<button type="button" class="swipe-del" tabindex="-1">Delete</button>' : ''}
            <div class="fest-row swipe-item ${f.id === cur ? 'on' : ''}" data-id="${f.id}">
              <button type="button" class="fr-pick" data-id="${f.id}">
                <span class="fest-icon">${iconSVG(f.icon)}</span>
                <span class="fr-main"><span class="fr-name">${esc(f.name)}${f.isNew ? '<span class="new-badge">New</span>' : ''}${f.announce ? '<span class="update-dot" aria-label="Has an update"></span>' : ''}</span>
                  <span class="fr-sub">${f.id === cur ? 'Now showing · ' : ''}${f.mode === 'one' ? `One ${dieName(f.categories[0].die)} list` : `${f.categories.length} categories`}${f.builtIn ? '' : ' · Custom'}</span></span>
              </button>
              <button type="button" class="btn ghost small fr-edit" data-edit="${f.id}" aria-label="Edit ${esc(f.name)}">Edit</button>
            </div>
          </li>`).join('')}
      </ul>
      ${store.canCreateFestival(sync.isAdmin())
    ? '<button type="button" class="btn ghost big" id="btn-new-fest">+ Create a Festival</button>'
    : '<button type="button" class="btn ghost big" id="btn-new-fest" disabled>Custom Festival Limit Reached</button>'}
      ${removed.length ? '<button type="button" class="btn ghost big" id="btn-add-official">+ Add an Official Festival</button>' : ''}`,
    actions: [{ label: 'Close', kind: 'ghost', onClick: closeSheet }],
  });
  const switchTo = (id) => {
    const changed = id !== store.activeFestival().id;
    store.setActiveFestival(id);
    const f = store.activeFestival();
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
  const addOff = $('#btn-add-official', sheet);
  if (addOff) addOff.addEventListener('click', () => addOfficialSheet(removed));
  // Swipe a festival left to delete it (Undo in the toast).
  if (canDelete) attachSwipe($('#fest-list', sheet), (id) => {
    const f = store.festival(id);
    const snap = store.snapshot();
    const wasActive = store.activeFestival().id === id;
    if (!store.deleteFestival(id)) return;
    if (wasActive) resetRoll();
    render();
    festivalSheet();
    toast(`${f.name} deleted.`, {
      action: 'Undo',
      onAction: () => { store.restore(snap); resetRoll(); render(); },
    });
  });
}

function addOfficialSheet(list) {
  const sheet = swapSheet({
    title: 'Add an official festival',
    body: `<ul class="fest-list">${list.map((p) => `
      <li><button type="button" class="fest-row add-off" data-id="${p.id}">
        <span class="fest-icon">${iconSVG(p.icon)}</span>
        <span class="fr-main"><span class="fr-name">${esc(p.name)}</span></span>
        <span class="or-go">Add</span>
      </button></li>`).join('')}</ul>`,
    actions: [{ label: 'Back', kind: 'ghost', onClick: festivalSheet }],
  });
  $$('.add-off', sheet).forEach((b) => b.addEventListener('click', () => {
    const f = store.restoreOfficialFestival(b.dataset.id, official.get(b.dataset.id));
    if (!f) return;
    render();
    festivalSheet();
    toast(`${f.name} added.`);
  }));
}

// ---------- Boot ----------

initSheets();
store.load();
applyTheme(store.themeId());
$$('.tabbar button').forEach((b) => b.addEventListener('click', () => go(b.dataset.screen)));
$('#fest-btn').addEventListener('click', festivalSheet);
initRoll();
initWatched();
initSettings();
initEditor();
initAccount();
initThemePicker();
initTutorial();
$('#btn-tutorial').addEventListener('click', () => startTutorial(() => go('home')));
go('home');

// First time the app is opened on this device: show the quick tour.
if (!store.getState().settings.tutorialSeen) startTutorial();

// Load the movie catalog in the background, then link any movies typed before it existed.
// Accounts (only if js/firebase-config.js is filled in). Data from the account replaces this device's copy.
sync.start({
  onRemoteApplied: () => {
    applyTheme(store.themeId());
    official.reconcileNow();
    if (screen === 'home') resetRoll();
    render();
  },
  chooseSide: chooseSideSheet,
  // Chose "Use My Account's Data" on a device that had its own: offer a way back.
  onReplaced: () => {
    if (!store.syncBackup()) return;
    toast("Now using your account's data.", {
      action: 'Undo',
      onAction: () => {
        store.restoreSyncBackup();
        applyTheme(store.themeId());
        render();
      },
    });
  },
});

// Official festivals: newer published versions (cached copy first, then the database).
official.start({ changed: () => render() });

catalog.load().then(() => {
  if (!catalog.isReady()) return;
  store.linkCatalog(catalog.match, catalog.byTmdbId);
  catalog.loadAllCollections();
});

// 3D dice: start downloading in the background only if they're turned on.
if (store.getState().settings.diceStyle !== 'flat') {
  const later = window.requestIdleCallback || ((cb) => setTimeout(cb, 1500));
  later(() => dice3d.prepare());
}

// Offline support. When a new version takes over while the app is open, the code already running is the old
// one, so offer a reload instead of mixing old and new files.
if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  const hadController = !!navigator.serviceWorker.controller;
  let prompted = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hadController || prompted) return; // first install: nothing old is running
    prompted = true;
    toast('Roll Credits has been updated.', { action: 'Reload', onAction: () => location.reload(), duration: 600000 });
  });
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').then((reg) => {
      // Check for a new version whenever the app comes back to the front.
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') reg.update().catch(() => {});
      });
    }).catch(() => {});
  });
}

// iOS home-screen apps sometimes lay out the fixed tab bar above the real bottom edge on launch, until the
// first scroll. A tiny scroll and a forced relayout after load puts it where it belongs.
function settleLayout() {
  requestAnimationFrame(() => {
    const y = window.scrollY;
    window.scrollTo(0, y + 1);
    window.scrollTo(0, y);
    const bar = document.querySelector('.tabbar');
    if (bar) { bar.style.display = 'none'; void bar.offsetHeight; bar.style.display = ''; }
  });
}
window.addEventListener('load', () => { settleLayout(); setTimeout(settleLayout, 300); });
window.addEventListener('pageshow', settleLayout);
window.addEventListener('orientationchange', () => setTimeout(settleLayout, 300));
