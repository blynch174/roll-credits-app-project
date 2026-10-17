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
  back: () => {},
  render: () => {},
  filters: null, // Watched-screen filters other screens can preset
};

// ---------- Toast ----------

let toastTimer;
// toast('Saved.') or toast('Deleted.', { action: 'Undo', onAction: fn })
export function toast(msg, opts = {}) {
  if (!msg) return;
  const t = $('#toast');
  t.innerHTML = '';
  t.appendChild(document.createTextNode(msg));
  t.classList.toggle('has-action', !!opts.action);
  if (opts.action) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'toast-action';
    b.textContent = opts.action;
    b.addEventListener('click', () => {
      t.classList.remove('show');
      opts.onAction && opts.onAction();
    });
    t.appendChild(b);
  }
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), opts.action ? 5000 : 3200);
}

// ---------- Swipe to delete (list rows) ----------
// Rows look like: <li class="swipe-row"><button class="swipe-del">Delete</button><button class="watched-item">...</button></li>
// Swipe a row left to reveal Delete; swipe far enough and it deletes on its own, like Mail.
const REVEAL = 92; // px the row stays open
let openRow = null;

function setX(item, x, animate) {
  item.style.transition = animate ? 'transform .2s ease-out' : 'none';
  item.style.transform = x ? `translateX(${x}px)` : '';
}

function closeOpenRow(except) {
  if (openRow && openRow !== except) {
    setX(openRow, 0, true);
    openRow.closest('.swipe-row').classList.remove('open');
    openRow = null;
  }
}

export function attachSwipe(list, onDelete) {
  if (list.dataset.swipe) return;
  list.dataset.swipe = '1';
  let item = null, startX = 0, startY = 0, baseX = 0, dx = 0, mode = null; // mode: null | 'swipe' | 'scroll'

  list.addEventListener('pointerdown', (e) => {
    const it = e.target.closest('.swipe-item');
    if (!it || (e.pointerType === 'mouse' && e.button !== 0)) return;
    closeOpenRow(it);
    item = it;
    startX = e.clientX;
    startY = e.clientY;
    baseX = it === openRow ? -REVEAL : 0;
    dx = 0;
    mode = null;
  });

  list.addEventListener('pointermove', (e) => {
    if (!item) return;
    const mx = e.clientX - startX;
    const my = e.clientY - startY;
    if (!mode) {
      if (Math.abs(mx) < 8 && Math.abs(my) < 8) return;
      mode = Math.abs(mx) > Math.abs(my) ? 'swipe' : 'scroll';
      if (mode === 'swipe') {
        item.setPointerCapture && item.setPointerCapture(e.pointerId);
        item.closest('.swipe-row').classList.add('swiping');
      }
    }
    if (mode !== 'swipe') return;
    dx = Math.min(0, baseX + mx);
    setX(item, dx, false);
  });

  const end = () => {
    if (!item) return;
    const it = item;
    item = null;
    const row = it.closest('.swipe-row');
    row.classList.remove('swiping');
    if (mode !== 'swipe') return;
    it.dataset.justSwiped = '1'; // stop the tap that ends a swipe from opening the movie
    setTimeout(() => delete it.dataset.justSwiped, 50);
    const w = it.offsetWidth;
    if (dx < -w * 0.55) {
      setX(it, -w - 20, true);
      row.classList.add('removing');
      setTimeout(() => onDelete(it.dataset.id), 180);
      openRow = null;
    } else if (dx < -REVEAL / 2) {
      setX(it, -REVEAL, true);
      row.classList.add('open');
      openRow = it;
    } else {
      setX(it, 0, true);
      row.classList.remove('open');
      if (openRow === it) openRow = null;
    }
  };
  list.addEventListener('pointerup', end);
  list.addEventListener('pointercancel', end);

  // Tapping the revealed Delete button.
  list.addEventListener('click', (e) => {
    const del = e.target.closest('.swipe-del');
    if (del) {
      const it = del.closest('.swipe-row').querySelector('.swipe-item');
      openRow = null;
      onDelete(it.dataset.id);
      return;
    }
    const it = e.target.closest('.swipe-item');
    if (!it) return;
    if (it.dataset.justSwiped) {
      e.stopImmediatePropagation(); // the click that ends a swipe isn't a tap
    } else if (it === openRow) {
      e.stopImmediatePropagation(); // a tap on an open row just closes it
      closeOpenRow();
    }
  }, true);
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

// Swipe down to close a bottom sheet (phones). Starts from the grip/title anytime, or from the
// content when it's scrolled to the top. Sideways swipes and form fields are left alone.
function initSheetSwipe() {
  const sheet = $('#sheet');
  const backdrop = $('#sheet-backdrop');
  const wide = window.matchMedia('(min-width: 700px)'); // centered dialog on big screens: no swipe
  let startY = 0, startX = 0, dy = 0, startT = 0, tracking = false, dragging = false;

  sheet.addEventListener('touchstart', (e) => {
    if (wide.matches || e.touches.length !== 1) return;
    const t = e.target;
    const fromHandle = !!t.closest('.sheet-grip, .sheet-title');
    if (!fromHandle && (sheet.scrollTop > 0 || t.closest('input, textarea, select, .pp-moods, .chips, .die-chips, .swatches'))) return;
    tracking = true;
    dragging = false;
    startY = e.touches[0].clientY;
    startX = e.touches[0].clientX;
    startT = Date.now();
    dy = 0;
  }, { passive: true });

  sheet.addEventListener('touchmove', (e) => {
    if (!tracking) return;
    const y = e.touches[0].clientY - startY;
    const x = e.touches[0].clientX - startX;
    if (!dragging) {
      if (Math.abs(y) < 8 && Math.abs(x) < 8) return;
      if (y <= 0 || Math.abs(x) > Math.abs(y)) { tracking = false; return; } // scrolling up or sideways
      dragging = true;
      sheet.style.transition = 'none';
    }
    dy = Math.max(0, y);
    sheet.style.transform = `translateY(${dy}px)`;
    backdrop.style.opacity = String(Math.max(0, 1 - dy / (sheet.offsetHeight || 400)));
    e.preventDefault();
  }, { passive: false });

  const end = () => {
    if (!tracking) return;
    tracking = false;
    if (!dragging) return;
    dragging = false;
    const fast = dy / Math.max(1, Date.now() - startT) > 0.6; // flick
    sheet.style.transition = '';
    backdrop.style.opacity = '';
    if (dy > Math.min(140, sheet.offsetHeight * 0.3) || (fast && dy > 30)) {
      sheet.style.transform = 'translateY(100%)'; // slide the rest of the way down from where the finger left it
      closeSheet();
      setTimeout(() => { sheet.style.transform = ''; }, 260);
    } else {
      sheet.style.transform = ''; // snaps back via the CSS transition
    }
  };
  sheet.addEventListener('touchend', end);
  sheet.addEventListener('touchcancel', end);
}

export function initSheets() {
  initSheetSwipe();
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
  if (sides === 2) return coinHTML(value, style, id, label);
  return `
    <div class="die d${sides}" ${id ? `id="${id}"` : ''} style="${style}">
      ${dieSVG(sides)}<span class="die-num">${esc(faceLabel(sides, value))}</span>
      <span class="die-label">${esc(label || dieName(sides))}</span>
    </div>`;
}

// A two-sided 3D coin built with CSS. Heads = 1, Tails = 2.
function coinHTML(value, style, id, label) {
  const edges = Array.from({ length: 7 }, (_, i) => `<span class="coin-edge" style="--z:${(i - 3) * 0.9}px"></span>`).join('');
  return `
    <div class="die d2 coin ${value === 2 ? 'tails' : ''} ${value ? 'has-value' : ''}" ${id ? `id="${id}"` : ''} style="${style}">
      <div class="coin-3d">
        ${edges}
        <span class="coin-face heads">H</span>
        <span class="coin-face tails">T</span>
      </div>
      <span class="die-label">${esc(label || dieName(2))}</span>
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
