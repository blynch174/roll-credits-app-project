// Shared UI helpers: DOM shortcuts, toast, bottom sheets, rating icons, dice markup.

import { iconSVG, dieSVG } from './icons.js';
import { faceLabel } from './dice.js';
import { dieName } from './defaults.js';

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

// Escape anything a user typed before it goes into HTML.
export function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[c]);
}

export const fmtDate = (iso) =>
  new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });

export const movieLabel = (m) =>
  m.year ? `${esc(m.title)} <span class="year">(${m.year})</span>` : esc(m.title);

// Screens register here so they can switch to each other without circular imports.
export const nav = {
  go: () => {},
  render: () => {},
  filters: null, // Watched-screen filters other screens can preset
};

// ---------- Toast ----------

let toastTimer;
export function toast(msg) {
  if (!msg) return;
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 3200);
}

// ---------- Bottom sheet ----------

let onSheetClose = null;

export function openSheet({ title, body = '', actions = [], onClose = null }) {
  const sheet = $('#sheet');
  sheet.innerHTML = `
    <div class="sheet-grip" aria-hidden="true"></div>
    <h3 class="sheet-title">${esc(title)}</h3>
    <div class="sheet-body">${body}</div>
    <div class="sheet-actions"></div>`;
  const bar = $('.sheet-actions', sheet);
  for (const a of actions) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'btn ' + (a.kind || 'ghost');
    b.textContent = a.label;
    if (a.id) b.id = a.id;
    b.addEventListener('click', () => a.onClick && a.onClick(sheet));
    bar.appendChild(b);
  }
  onSheetClose = onClose;
  $('#toast').classList.remove('show');
  $('#sheet-backdrop').hidden = false;
  sheet.hidden = false;
  sheet.scrollTop = 0;
  requestAnimationFrame(() => {
    $('#sheet-backdrop').classList.add('show');
    sheet.classList.add('show');
  });
  const first = $('input:not([type=hidden]), textarea, select', sheet);
  if (first && window.matchMedia('(hover: hover)').matches) first.focus();
  return sheet;
}

export function closeSheet() {
  const sheet = $('#sheet');
  if (sheet.hidden) return;
  sheet.classList.remove('show');
  $('#sheet-backdrop').classList.remove('show');
  setTimeout(() => {
    if (sheet.classList.contains('show')) return; // another sheet opened meanwhile
    sheet.hidden = true;
    $('#sheet-backdrop').hidden = true;
    sheet.innerHTML = '';
  }, 220);
  const cb = onSheetClose;
  onSheetClose = null;
  if (cb) cb();
}

// Replace the open sheet without firing its onClose.
export function swapSheet(opts) {
  onSheetClose = null;
  return openSheet(opts);
}

export function confirmSheet(title, text, okLabel, onOk, danger = false) {
  openSheet({
    title,
    body: `<p class="sheet-text">${esc(text)}</p>`,
    actions: [
      { label: 'Cancel', kind: 'ghost', onClick: closeSheet },
      { label: okLabel, kind: danger ? 'danger' : 'primary', onClick: () => { closeSheet(); onOk(); } },
    ],
  });
}

// Second step for destructive actions: the user must type DELETE.
export function typedConfirm(title, text, onOk) {
  const sheet = openSheet({
    title,
    body: `
      <p class="sheet-text">${esc(text)}</p>
      <label class="field"><span class="label">Type DELETE to confirm</span>
        <input id="typed-confirm" type="text" autocomplete="off" autocapitalize="characters" spellcheck="false"></label>`,
    actions: [
      { label: 'Cancel', kind: 'ghost', onClick: closeSheet },
      { label: 'Delete', kind: 'danger', id: 'typed-ok', onClick: () => { closeSheet(); onOk(); } },
    ],
  });
  const ok = $('#typed-ok', sheet);
  const input = $('#typed-confirm', sheet);
  ok.disabled = true;
  input.addEventListener('input', () => (ok.disabled = input.value.trim() !== 'DELETE'));
}

export function initSheets() {
  $('#sheet-backdrop').addEventListener('click', closeSheet);
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeSheet();
  });
}

// ---------- Ratings ----------

export function ratingIcons(icon, rating, interactive = false) {
  let out = '';
  for (let i = 1; i <= 5; i++) {
    const on = i <= rating ? ' on' : '';
    out += interactive
      ? `<button type="button" class="ricon${on}" data-r="${i}" aria-label="${i} of 5">${iconSVG(icon)}</button>`
      : `<span class="ricon${on}">${iconSVG(icon)}</span>`;
  }
  return out;
}

// ---------- Dice ----------

// Before a category is known, dice use the theme accent; after, the category color.
export function dieHTML(sides, value, color, id, label) {
  const style = color ? `--die:${color};--die-ink:#fff` : '--die:var(--accent);--die-ink:var(--accent-ink)';
  return `
    <div class="die d${sides}" ${id ? `id="${id}"` : ''} style="${style}">
      ${dieSVG(sides)}<span class="die-num">${esc(faceLabel(sides, value))}</span>
      <span class="die-label">${esc(label || dieName(sides))}</span>
    </div>`;
}

// Segmented control helper.
export function syncSeg(container, value) {
  $$('button', container).forEach((b) => {
    const on = b.dataset.value === String(value);
    b.classList.toggle('on', on);
    b.setAttribute('aria-checked', on ? 'true' : 'false');
  });
}

// Row of die-size chips. Returns markup; read the chosen value from data-die.
export function dieChips(options, selected, name) {
  return `<div class="die-chips" data-name="${name}">${options
    .map((n) => `<button type="button" class="die-chip ${n === selected ? 'on' : ''}" data-die="${n}">${dieName(n)}</button>`)
    .join('')}</div>`;
}

export function wireChips(root, onPick) {
  root.addEventListener('click', (e) => {
    const b = e.target.closest('.die-chip');
    if (!b) return;
    $$('.die-chip', b.parentElement).forEach((x) => x.classList.toggle('on', x === b));
    onPick(parseInt(b.dataset.die, 10), b.parentElement.dataset.name);
  });
}
