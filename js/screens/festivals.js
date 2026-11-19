// The festival switcher (tap the festival name on the Roll screen): pick, edit, delete, create, or browse.

import * as store from '../store.js';
import * as sync from '../sync.js';
import { dieName } from '../defaults.js';
import { iconSVG } from '../icons.js';
import { $, $$, esc, nav, openSheet, closeSheet, toast, attachSwipe } from '../ui.js';
import { resetRoll } from './roll.js';
import { openCreator } from './creator.js';
import { libraryEntries, openLibrary } from './library.js';

export function festivalSheet() {
  const cur = store.activeFestival().id;
  const canDelete = store.festivals().length > 1;
  const seen = new Set(store.librarySeen());
  const fresh = libraryEntries().filter((e) => !seen.has(e.id) && !store.festival(e.id)).length;
  const sheet = openSheet({
    title: 'Film Festivals',
    body: `
      <ul class="fest-list" id="fest-list">
        ${store
          .festivals()
          .map(
            (f) => `
          <li class="${canDelete ? 'swipe-row' : ''}">
            ${canDelete ? `<button type="button" class="swipe-del" tabindex="-1">${f.builtIn ? 'Remove' : 'Delete'}</button>` : ''}
            <div class="fest-row swipe-item ${f.id === cur ? 'on' : ''}" data-id="${f.id}">
              <button type="button" class="fr-pick" data-id="${f.id}">
                <span class="fest-icon">${iconSVG(f.icon)}</span>
                <span class="fr-main"><span class="fr-name">${esc(f.name)}${f.isNew ? '<span class="new-badge">New</span>' : ''}${f.announce ? '<span class="update-dot" aria-label="Has an update"></span>' : ''}</span>
                  <span class="fr-sub">${f.id === cur ? 'Now showing · ' : ''}${f.mode === 'one' ? `One ${dieName(f.categories[0].die)} list` : `${f.categories.length} categories`}${f.builtIn ? '' : ' · Custom'}</span></span>
              </button>
              <button type="button" class="btn ghost small fr-edit" data-edit="${f.id}" aria-label="Edit ${esc(f.name)}">Edit</button>
            </div>
          </li>`,
          )
          .join('')}
      </ul>
      ${
        store.canCreateFestival(sync.isAdmin())
          ? '<button type="button" class="btn ghost big" id="btn-new-fest">+ Create a Festival</button>'
          : '<button type="button" class="btn ghost big" id="btn-new-fest" disabled>Custom Festival Limit Reached</button>'
      }
      <button type="button" class="btn ghost big" id="btn-library">+ Browse Festivals${fresh ? `<span class="new-badge">${fresh} New</span>` : ''}</button>`,
  });
  const switchTo = (id) => {
    const changed = id !== store.activeFestival().id;
    store.setActiveFestival(id);
    const f = store.activeFestival();
    if (changed) resetRoll();
    return { f, changed };
  };
  $$('.fr-pick', sheet).forEach((b) =>
    b.addEventListener('click', () => {
      const { f, changed } = switchTo(b.dataset.id);
      closeSheet();
      nav.go(nav.current() === 'creator' ? 'home' : nav.current());
      if (changed) toast(`Now showing: ${f.name}`);
    }),
  );
  $$('.fr-edit', sheet).forEach((b) =>
    b.addEventListener('click', () => {
      switchTo(b.dataset.edit);
      closeSheet();
      nav.go('edit', { part: 'tables' });
    }),
  );
  $('#btn-new-fest', sheet).addEventListener('click', () => {
    closeSheet();
    openCreator();
  });
  $('#btn-library', sheet).addEventListener('click', () => {
    closeSheet();
    openLibrary();
  });
  // Swipe a festival left to delete it (Undo in the toast).
  if (canDelete)
    attachSwipe($('#fest-list', sheet), (id) => {
      const f = store.festival(id);
      const snap = store.snapshot();
      const wasActive = store.activeFestival().id === id;
      if (!store.deleteFestival(id)) return;
      if (wasActive) resetRoll();
      nav.render();
      festivalSheet();
      toast(f.builtIn ? `${f.name} removed.` : `${f.name} deleted.`, {
        action: 'Undo',
        onAction: () => {
          store.restore(snap);
          resetRoll();
          nav.render();
        },
      });
    });
}
