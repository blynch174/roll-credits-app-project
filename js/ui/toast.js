// The toast: a short message at the bottom of the screen, optionally with one action (like Undo).

import { $ } from './dom.js';

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
  toastTimer = setTimeout(() => t.classList.remove('show'), opts.duration || (opts.action ? 5000 : 3200));
}
