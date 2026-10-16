// Autofind: catalog suggestions under a title box. Used by the slot editor and "Log a movie".

import * as catalog from './catalog.js';
import { $, esc } from './ui.js';

// Markup to drop right after the title/year row.
export const autofindBox = () => '<div class="af-list" id="af-list" hidden></div>';

// Wires up suggestions. Returns a function that gives the chosen catalog id (or an exact match, or null).
export function attachAutofind(sheet, { festivalId, onPick } = {}) {
  const titleEl = $('#f-title', sheet);
  const yearEl = $('#f-year', sheet);
  const box = $('#af-list', sheet);
  let picked = null;

  catalog.loadCollection(festivalId);

  function show() {
    const q = titleEl.value.trim();
    if (picked && q !== picked.title) picked = null;
    const results = picked ? [] : catalog.search(q, festivalId);
    if (!results.length) { box.hidden = true; box.innerHTML = ''; return; }
    box.innerHTML = results.map((m) => `
      <button type="button" class="af-item" data-id="${esc(m.id)}">
        <span class="af-title">${esc(m.title)} <span class="year">(${m.releaseYear})</span></span>
        <span class="af-sub">${esc([m.originalTitle && m.originalTitle !== m.title ? m.originalTitle : '', (m.directors || []).join(', ')].filter(Boolean).join(' · '))}</span>
      </button>`).join('');
    box.hidden = false;
  }

  // Keep focus in the title box while tapping a suggestion.
  box.addEventListener('pointerdown', (e) => e.preventDefault());
  box.addEventListener('click', (e) => {
    const b = e.target.closest('.af-item');
    if (!b) return;
    picked = catalog.get(b.dataset.id);
    titleEl.value = picked.title;
    yearEl.value = picked.releaseYear;
    box.hidden = true;
    onPick && onPick(picked);
  });
  titleEl.addEventListener('input', show);
  if (!catalog.isReady()) catalog.onReady(() => { if (document.activeElement === titleEl) show(); });

  return () => {
    if (picked && titleEl.value.trim() === picked.title && +yearEl.value === picked.releaseYear) return picked.id;
    const hit = catalog.match(titleEl.value.trim(), parseInt(yearEl.value, 10));
    return hit ? hit.id : null;
  };
}
