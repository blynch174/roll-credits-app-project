// What people see when an official festival gets a new version: the banner on the Roll screen and the
// Review update sheet (Update / Keep mine).

import * as store from '../store.js';
import * as official from '../official.js';
import { iconSVG } from '../icons.js';
import { $, esc, toast, nav, openSheet, closeSheet } from '../ui.js';

export function renderBanner() {
  const box = $('#fest-banner');
  const f = store.activeFestival();
  const a = f.announce;
  const pending = official.updateFor(f);
  if (!a || (!a.applied && !pending)) {
    box.innerHTML = '';
    box.hidden = true;
    return;
  }
  box.hidden = false;
  box.innerHTML = `
    <div class="update-banner">
      <span class="ub-icon">${iconSVG(f.icon)}</span>
      <div class="ub-text">
        <b>${a.applied ? `${esc(f.name)} just got an update` : `${esc(f.name)} has an update`}</b>
        ${a.message ? `<p>${esc(a.message)}</p>` : ''}
      </div>
      <button type="button" class="btn ${a.applied ? 'ghost' : 'primary'} small" id="ub-go">${a.applied ? 'Got it' : 'Review'}</button>
    </div>`;
  $('#ub-go').addEventListener('click', () => {
    if (a.applied) {
      store.clearAnnounce(f.id);
      renderBanner();
    } else reviewSheet(f.id);
  });
}

export function reviewSheet(fId) {
  const f = store.festival(fId);
  const pub = official.updateFor(f);
  if (!pub) return toast('Already up to date.');
  const lines = official.diffSummary(f, pub);
  const edited = !store.isUntouched(f);
  openSheet({
    title: `Update ${f.name}?`,
    body: `
      ${pub.message ? `<p class="sheet-text ub-msg">${esc(pub.message)}</p>` : ''}
      <ul class="diff-list">${lines.map((l) => `<li>${esc(l)}</li>`).join('')}</ul>
      <p class="sheet-text">Replaces its tables and dice${edited ? ', including your changes' : ''}. History and Seen marks stay.</p>`,
    actions: [
      {
        label: 'Keep mine', kind: 'ghost', onClick: () => {
          store.keepMine(f.id, pub.rev);
          closeSheet();
          nav.render();
          toast(`Kept your ${f.name}.`);
        },
      },
      {
        label: 'Update', kind: 'primary', onClick: () => {
          store.applyOfficial(f.id, pub, false);
          closeSheet();
          nav.render();
          toast(`${f.name} is up to date.`);
        },
      },
    ],
  });
}
