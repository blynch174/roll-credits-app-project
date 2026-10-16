// POPCORN PICK tab: a random movie from the whole catalog, revealed by a popping kernel.
// The movie is chosen first (every movie has an equal chance); the popcorn just reveals it.

import * as store from '../store.js';
import * as catalog from '../catalog.js';
import { randInt, wait } from '../dice.js';
import { $, $$, esc, toast } from '../ui.js';

const MOOD_MIN = 10; // only offer moods with at least this many movies
let moods = new Set(); // empty = any mood. Several = movies with ANY of them (and/or).
let current = null; // the movie on the ticket
let currentMoods = []; // the moods selected when it was popped
let busy = false;

const reducedMotion = () => window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// A puffy popcorn kernel.
const KERNEL = `<svg viewBox="0 0 40 36" aria-hidden="true">
  <g class="k-puff"><circle cx="13" cy="15" r="9"/><circle cx="24" cy="11" r="10"/><circle cx="29" cy="21" r="8"/><circle cx="17" cy="24" r="8"/></g>
  <path class="k-hull" d="M15 27c2 4 8 5 11 1-1 3-3 5-6 5s-5-2-5-6z"/>
</svg>`;

// Striped popcorn bucket.
const BUCKET = `<svg viewBox="0 0 120 120" aria-hidden="true">
  <g class="b-top"><circle cx="34" cy="30" r="13"/><circle cx="52" cy="22" r="15"/><circle cx="72" cy="24" r="14"/><circle cx="88" cy="32" r="12"/><circle cx="60" cy="36" r="14"/></g>
  <path class="b-body" d="M18 38h84l-12 76H30z"/>
  <path class="b-stripe" d="M38 38h12l-3 76h-9zM70 38h12l-6 76h-9z"/>
  <path class="b-rim" d="M14 34h92v8H14z"/>
</svg>`;

function pickMovie() {
  const pool = moods.size ? catalog.all().filter((m) => (m.moodTone || []).some((t) => moods.has(t))) : catalog.all();
  if (!pool.length) return null;
  return pool[randInt(0, pool.length - 1)];
}

function ticketHTML(m) {
  const bits = [m.releaseYear, m.runtimeMinutes ? `${m.runtimeMinutes} min` : '', m.contentRating].filter(Boolean);
  return `
    <div class="ticket" id="pp-ticket">
      <p class="t-admit">Admit one · Popcorn Pick</p>
      <p class="t-title">${esc(m.title)}</p>
      <p class="t-meta">${esc(bits.join(' · '))}</p>
      ${m.directors && m.directors.length ? `<p class="t-dir">Directed by ${esc(m.directors.join(', '))}</p>` : ''}
      ${m.moodTone && m.moodTone.length ? `<p class="t-moods">${[...new Set([...moods, ...m.moodTone].filter((t) => m.moodTone.includes(t)))].slice(0, 3).map((t) => `<span>${esc(t)}</span>`).join('')}</p>` : ''}
    </div>`;
}

let wired = false;

// Renders the Popcorn tab. Keeps the last ticket on screen if there is one.
export async function renderPopcorn() {
  const root = $('#popcorn');
  root.innerHTML = `
    <h2 class="section-title first">Popcorn Pick</h2>
    <p class="pp-intro">One random movie from the whole catalog. Pick one or more moods, or don't.</p>
    <div class="pp-moods" id="pp-moods"><p class="hint">Loading the movie list…</p></div>
    <div class="pp-stage" id="pp-stage">
      <div class="pp-bucket" id="pp-bucket" role="button" tabindex="0" aria-label="Pop some popcorn">${BUCKET}</div>
      <p class="pp-tap" id="pp-tap">Tap the bucket</p>
    </div>
    <div class="pp-actions" id="pp-actions" hidden>
      <button type="button" class="btn primary big" id="pp-watch">Watch it</button>
      <button type="button" class="btn ghost" id="pp-again">Pop again</button>
    </div>`;
  busy = false;
  if (current) showTicket(root, current, false);

  if (!wired) {
    wired = true;
    root.addEventListener('click', (e) => {
      const chip = e.target.closest('.pp-chip');
      if (chip && !busy) {
        const t = chip.dataset.mood;
        if (!t) moods.clear(); // "Any" clears the selection
        else if (moods.has(t)) moods.delete(t);
        else moods.add(t);
        drawMoods();
        return;
      }
      if (e.target.closest('#pp-bucket') || e.target.closest('#pp-again')) return popcorn(root);
      if (e.target.closest('#pp-watch') && current) {
        const entry = store.addPopcornPick(current, currentMoods);
        current = null;
        renderPopcorn();
        toast(`${entry.title} added to your watched list. Enjoy!`);
      }
    });
    root.addEventListener('keydown', (e) => {
      if ((e.key === 'Enter' || e.key === ' ') && e.target.id === 'pp-bucket') { e.preventDefault(); popcorn(root); }
    });
  }

  await catalog.load();
  if (!catalog.isReady()) {
    $('#pp-moods', root).innerHTML = '<p class="hint">Popcorn Pick needs to download the movie list once. Connect to the internet and try again.</p>';
    $('#pp-bucket', root).classList.add('disabled');
    return;
  }
  drawMoods();
}

function drawMoods() {
  const box = $('#pp-moods');
  if (!box || !catalog.isReady()) return;
  const list = catalog.moodCounts().filter(([, n]) => n >= MOOD_MIN).map(([t]) => t).sort();
  box.innerHTML = [null, ...list].map((t) => {
    const on = t ? moods.has(t) : moods.size === 0;
    return `<button type="button" class="pp-chip ${on ? 'on' : ''}" data-mood="${esc(t || '')}" aria-pressed="${on}">${esc(t || 'Any')}</button>`;
  }
  ).join('');
}

function showTicket(root, movie, animate) {
  const stage = $('#pp-stage', root);
  $('#pp-bucket', root).hidden = true;
  $('#pp-tap', root).hidden = true;
  stage.insertAdjacentHTML('beforeend', ticketHTML(movie));
  const ticket = $('#pp-ticket', root);
  if (animate && !reducedMotion() && ticket.animate) {
    ticket.animate(
      [{ transform: 'scale(.4) rotate(-6deg)', opacity: 0 }, { transform: 'scale(1.04) rotate(1deg)', opacity: 1, offset: 0.7 }, { transform: 'none', opacity: 1 }],
      { duration: 420, easing: 'cubic-bezier(.2,.9,.3,1.2)' }
    );
  }
  $('#pp-actions', root).hidden = false;
}

async function popcorn(root) {
  if (busy) return;
  if (!catalog.isReady()) return;
  const movie = pickMovie();
  if (!movie) return toast('No movies match those moods.');
  busy = true;
  current = movie;
  currentMoods = [...moods].sort();
  const stage = $('#pp-stage', root);
  $('#pp-actions', root).hidden = true;
  const old = $('#pp-ticket', root);
  if (old) old.remove();
  $$('.pp-kernel, .pp-crumb', stage).forEach((k) => k.remove());
  const bucket = $('#pp-bucket', root);
  bucket.hidden = false;
  $('#pp-tap', root).hidden = true;

  if (!reducedMotion()) await popAnimation(stage, bucket);
  if (!root.isConnected || !$('#pp-stage', root)) { busy = false; return; }
  showTicket(root, movie, true);
  busy = false;
}

// Bucket shakes, plain kernels fly out, one golden kernel rises, holds, and bursts.
async function popAnimation(stage, bucket) {
  const W = stage.clientWidth;
  bucket.animate(
    [{ transform: 'rotate(0)' }, { transform: 'rotate(-6deg)' }, { transform: 'rotate(5deg)' }, { transform: 'rotate(-3deg)' }, { transform: 'rotate(0)' }],
    { duration: 450 }
  );
  await wait(250);

  const spawn = (cls) => {
    const k = document.createElement('div');
    k.className = 'pp-kernel ' + cls;
    k.innerHTML = KERNEL;
    stage.appendChild(k);
    return k;
  };

  for (let i = 0; i < 7; i++) {
    const k = spawn('plain');
    const dx = (Math.random() - 0.5) * W * 0.9;
    const up = 90 + Math.random() * 70;
    const spin = (Math.random() - 0.5) * 540;
    k.animate(
      [
        { transform: 'translate(-50%, 0) rotate(0) scale(.6)', opacity: 1 },
        { transform: `translate(calc(-50% + ${dx * 0.6}px), -${up}px) rotate(${spin / 2}deg) scale(1)`, opacity: 1, offset: 0.45 },
        { transform: `translate(calc(-50% + ${dx}px), 60px) rotate(${spin}deg) scale(.9)`, opacity: 0 },
      ],
      { duration: 900 + Math.random() * 300, delay: i * 90, easing: 'cubic-bezier(.2,.6,.4,1)', fill: 'forwards' }
    );
  }

  await wait(350);
  const gold = spawn('gold');
  const rise = gold.animate(
    [
      { transform: 'translate(-50%, 0) scale(.6) rotate(0)' },
      { transform: 'translate(-50%, -150px) scale(1.7) rotate(200deg)', offset: 0.6 },
      { transform: 'translate(-50%, -140px) scale(1.8) rotate(360deg)' },
    ],
    { duration: 800, easing: 'cubic-bezier(.2,.7,.3,1)', fill: 'forwards' }
  );
  await rise.finished;
  // a little wobble while it "heats up"
  await gold.animate(
    [{ filter: 'brightness(1)' }, { filter: 'brightness(1.4)' }, { filter: 'brightness(1)' }],
    { duration: 300 }
  ).finished;

  // burst: crumbs fly out and the kernel blows up and fades
  for (let i = 0; i < 10; i++) {
    const c = document.createElement('span');
    c.className = 'pp-crumb';
    stage.appendChild(c);
    const a = (i / 10) * Math.PI * 2;
    c.animate(
      [
        { transform: 'translate(-50%, -140px) scale(1)', opacity: 1 },
        { transform: `translate(calc(-50% + ${Math.cos(a) * 90}px), ${-140 + Math.sin(a) * 90}px) scale(.3)`, opacity: 0 },
      ],
      { duration: 450, easing: 'ease-out', fill: 'forwards' }
    );
  }
  await gold.animate(
    [{ transform: 'translate(-50%, -140px) scale(1.8) rotate(360deg)', opacity: 1 }, { transform: 'translate(-50%, -140px) scale(3.2) rotate(380deg)', opacity: 0 }],
    { duration: 300, easing: 'ease-out', fill: 'forwards' }
  ).finished;
  $$('.pp-kernel, .pp-crumb', stage).forEach((k) => k.remove());
}
