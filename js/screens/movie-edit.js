// Admins: fix a catalog movie's moods and scare factor. Saved to the database (catalogEdits), so it shows for
// everyone right away, and the nightly catalog update copies it into data/catalog/curation.json.
// Also home to the 1–10 scare factor picker used here and in Movie Manager.

import * as catalog from '../catalog.js';
import * as cloud from '../cloud.js';
import * as sync from '../sync.js';
import * as movieEdits from '../movieedits.js';
import { scareLevel, scareHTML } from '../movieinfo.js';
import { $, esc, toast, openSheet, closeSheet } from '../ui.js';

// Moods used by at least 10 catalog movies, A–Z.
export const moodList = () => catalog.moodCounts().filter(([, n]) => n >= 10).map(([t]) => t).sort();

// ---------- Scare factor picker (1–10) ----------

function scareNote(v) {
  if (!v) return '<span class="sp-note">Not set</span>';
  if (!scareLevel({ scariness: v })) return '<span class="sp-note">1 · No skulls</span>';
  return scareHTML({ scariness: v }, 'sp-preview');
}

// value: 1–10, or null for "not set". allowUnset: tapping the chosen number again clears it.
export function scarePickerHTML(id, value) {
  let nums = '';
  for (let i = 1; i <= 10; i++) nums += `<button type="button" data-scare="${i}" class="${i === value ? 'on' : ''}" aria-pressed="${i === value}">${i}</button>`;
  return `<div class="scare-pick" data-for="${esc(id)}">
    <div class="sp-nums" role="group" aria-label="Scare factor, 1 to 10">${nums}</div>
    <div class="sp-out">${scareNote(value)}</div>
  </div>`;
}

export function wireScarePicker(box, value, onChange, allowUnset = true) {
  let v = value;
  box.addEventListener('click', (e) => {
    const b = e.target.closest('[data-scare]');
    if (!b) return;
    const n = +b.dataset.scare;
    v = v === n && allowUnset ? null : n;
    box.querySelectorAll('[data-scare]').forEach((x) => {
      x.classList.toggle('on', +x.dataset.scare === v);
      x.setAttribute('aria-pressed', String(+x.dataset.scare === v));
    });
    box.querySelector('.sp-out').innerHTML = scareNote(v);
    onChange(v);
  });
}

// ---------- Edit Movie sheet ----------

export function editMovieSheet(m, after) {
  if (!m || !sync.isAdmin()) return;
  const moods = new Set(m.moodTone || []);
  let scare = Number.isInteger(m.scariness) ? m.scariness : null;
  const all = [...new Set([...moodList(), ...moods])].sort();
  const sheet = openSheet({
    title: `Edit ${m.title} (${m.releaseYear})`,
    body: `
      <div class="field"><span class="label">Scare Factor</span>${scarePickerHTML(m.id, scare)}</div>
      <div class="field"><span class="label">Moods <em>up to 8</em></span>
        <div class="req-moods" id="em-moods">${all.map((t) => `<button type="button" data-mood="${esc(t)}" class="${moods.has(t) ? 'on' : ''}">${esc(t)}</button>`).join('')}</div></div>`,
    actions: [
      { label: 'Cancel', kind: 'ghost', onClick: closeSheet },
      {
        label: 'Save',
        kind: 'primary',
        id: 'em-save',
        onClick: async (s) => {
          const btn = $('#em-save', s);
          btn.disabled = true;
          btn.textContent = 'Saving…';
          const edit = { moods: [...moods], scariness: scare };
          try {
            await cloud.init();
            await cloud.setCatalogEdit(m.id, { ...edit, title: m.title });
          } catch (err) {
            btn.disabled = false;
            btn.textContent = 'Save';
            return toast(cloud.errorText(err));
          }
          movieEdits.remember(m.id, edit);
          closeSheet();
          toast(`${m.title} updated.`);
          after && after();
        },
      },
    ],
  });
  wireScarePicker($('.scare-pick', sheet), scare, (v) => { scare = v; }, false);
  $('#em-moods', sheet).addEventListener('click', (e) => {
    const b = e.target.closest('[data-mood]');
    if (!b) return;
    const t = b.dataset.mood;
    if (moods.has(t)) moods.delete(t);
    else if (moods.size >= 8) return toast('Up to 8 moods.');
    else moods.add(t);
    b.classList.toggle('on', moods.has(t));
  });
}

// "Edit Movie" links in movie details (data-edit-movie="<catalog id>") open the editor from any sheet.
export function initMovieEdit() {
  document.addEventListener('click', (e) => {
    const b = e.target.closest('[data-edit-movie]');
    if (!b) return;
    editMovieSheet(catalog.get(b.dataset.editMovie));
  });
}
