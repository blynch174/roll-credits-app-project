// Bottom sheets: opening and closing, confirmations, swiping down to close, and keeping the sheet above the
// iPhone keyboard.

import { $ } from './dom.js';
import { esc } from '../util.js';

let onSheetClose = null;

export function openSheet({ title, body = '', actions = [], onClose = null }) {
  const sheet = $('#sheet');
  // The sheet is a still frame; .sheet-scroll inside it does the scrolling. (A sheet that slides in and scrolls
  // itself gets a misplaced scroll bar on iPhone.)
  sheet.innerHTML = `
    <div class="sheet-grip" aria-hidden="true"></div>
    <div class="sheet-scroll">
      <h3 class="sheet-title">${esc(title)}</h3>
      <div class="sheet-body">${body}</div>
      <div class="sheet-actions"></div>
    </div>`;
  const scroller = $('.sheet-scroll', sheet);
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
  document.documentElement.classList.add('sheet-open');
  $('#sheet-backdrop').hidden = false;
  sheet.hidden = false;
  scroller.scrollTop = 0;
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
    document.documentElement.classList.remove('sheet-open');
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
      {
        label: okLabel,
        kind: danger ? 'danger' : 'primary',
        onClick: () => {
          closeSheet();
          onOk();
        },
      },
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
        <input id="typed-confirm" type="text" autocomplete="off" autocorrect="off" enterkeyhint="done" autocapitalize="characters" spellcheck="false"></label>`,
    actions: [
      { label: 'Cancel', kind: 'ghost', onClick: closeSheet },
      {
        label: 'Delete',
        kind: 'danger',
        id: 'typed-ok',
        onClick: () => {
          closeSheet();
          onOk();
        },
      },
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
  let startY = 0,
    startX = 0,
    dy = 0,
    startT = 0,
    tracking = false,
    dragging = false;

  sheet.addEventListener(
    'touchstart',
    (e) => {
      if (wide.matches || e.touches.length !== 1) return;
      const t = e.target;
      const fromHandle = !!t.closest('.sheet-grip, .sheet-title');
      if (
        !fromHandle &&
        (scrollerOf(sheet).scrollTop > 0 ||
          t.closest('input, textarea, select, .pp-moods, .chips, .die-chips, .swatches'))
      )
        return;
      const list = t.closest('.af-list');
      if (list && list.scrollTop > 0) return; // scrolling suggestions back up
      tracking = true;
      dragging = false;
      startY = e.touches[0].clientY;
      startX = e.touches[0].clientX;
      startT = Date.now();
      dy = 0;
    },
    { passive: true },
  );

  sheet.addEventListener(
    'touchmove',
    (e) => {
      if (!tracking) return;
      const y = e.touches[0].clientY - startY;
      const x = e.touches[0].clientX - startX;
      if (!dragging) {
        if (Math.abs(y) < 8 && Math.abs(x) < 8) return;
        if (y <= 0 || Math.abs(x) > Math.abs(y)) {
          tracking = false;
          return;
        } // scrolling up or sideways
        dragging = true;
        sheet.style.transition = 'none';
      }
      dy = Math.max(0, y);
      sheet.style.transform = `translateY(${dy}px)`;
      backdrop.style.opacity = String(Math.max(0, 1 - dy / (sheet.offsetHeight || 400)));
      e.preventDefault();
    },
    { passive: false },
  );

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
      setTimeout(() => {
        sheet.style.transform = '';
      }, 260);
    } else {
      sheet.style.transform = ''; // snaps back via the CSS transition
    }
  };
  sheet.addEventListener('touchend', end);
  sheet.addEventListener('touchcancel', end);
}

// ---------- Keyboard ----------
// The iPhone keyboard covers the page instead of shrinking it. visualViewport tells us how much is still visible,
// so the open sheet sits right on top of the keyboard and never grows taller than the space that's left.

function initKeyboard() {
  const vv = window.visualViewport;
  const root = document.documentElement;
  // Fills the space under an open sheet (around and behind the iPhone keyboard) so the app behind never shows
  // through, and swallows drags there so the page behind can't scroll.
  const floor = document.createElement('div');
  floor.className = 'sheet-floor';
  floor.setAttribute('aria-hidden', 'true');
  document.body.appendChild(floor);
  const stop = (e) => {
    if (e.cancelable) e.preventDefault();
  };
  floor.addEventListener('touchmove', stop, { passive: false });
  $('#sheet-backdrop').addEventListener('touchmove', stop, { passive: false });
  if (vv) {
    let queued = false;
    const update = () => {
      queued = false;
      const kb = Math.max(0, Math.round(window.innerHeight - vv.height - vv.offsetTop));
      root.style.setProperty('--kb', kb + 'px');
      root.style.setProperty('--vvh', Math.round(vv.height) + 'px');
      root.classList.toggle('kb-open', kb > 80);
      if (kb > 80) keepFocusedInView();
    };
    const queue = () => {
      if (!queued) {
        queued = true;
        requestAnimationFrame(update);
      }
    };
    vv.addEventListener('resize', queue);
    vv.addEventListener('scroll', queue);
    window.addEventListener('resize', queue);
    update();
  }
  // Return on a one-line box closes the keyboard (forms with a submit button still submit first).
  document.addEventListener('keydown', (e) => {
    const t = e.target;
    if (e.key !== 'Enter' || !(t instanceof HTMLInputElement)) return;
    if (['done', 'search'].includes(t.getAttribute('enterkeyhint')) && !t.form) setTimeout(() => t.blur(), 0);
  });
  document.addEventListener('focusin', () => setTimeout(keepFocusedInView, 300));
}

const scrollerOf = (sheet) => $('.sheet-scroll', sheet) || sheet;

// Scrolls the open sheet (not the page) so the box being typed in is visible.
function keepFocusedInView() {
  const sheet = $('#sheet');
  const el = document.activeElement;
  if (!sheet || sheet.hidden || !el || !sheet.contains(el) || !el.matches('input, textarea, select')) return;
  const scroller = scrollerOf(sheet);
  const box = scroller.getBoundingClientRect();
  const r = el.getBoundingClientRect();
  const pad = 12;
  if (r.top < box.top + pad) scroller.scrollTop -= box.top + pad - r.top;
  else if (r.bottom > box.bottom - pad) scroller.scrollTop += r.bottom - (box.bottom - pad);
}

export function initSheets() {
  initSheetSwipe();
  initKeyboard();
  $('#sheet-backdrop').addEventListener('click', closeSheet);
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeSheet();
  });
}
