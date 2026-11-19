// Small controls drawn as HTML: rating icons, dice and the coin, segmented controls, and die-size chips.

import { iconSVG, dieSVG } from '../icons.js';
import { faceLabel } from '../dice.js';
import { dieName } from '../defaults.js';
import { $$ } from './dom.js';
import { esc } from '../util.js';

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
  const edges = Array.from(
    { length: 7 },
    (_, i) => `<span class="coin-edge" style="--z:${(i - 3) * 0.9}px"></span>`,
  ).join('');
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
    .map(
      (n) =>
        `<button type="button" class="die-chip ${n === selected ? 'on' : ''}" data-die="${n}">${dieName(n)}</button>`,
    )
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
