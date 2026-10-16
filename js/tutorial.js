// First-run walkthrough. Shows automatically on a brand-new install, and from Settings → Show the tutorial.
// Kept short on purpose: just enough to get rolling.

import * as store from './store.js';
import { iconSVG } from './icons.js';
import { $, esc } from './ui.js';

const DIE = '<svg viewBox="0 0 24 24" aria-hidden="true"><rect class="s" x="3.5" y="3.5" width="17" height="17" rx="4"/><circle class="b" cx="8.5" cy="8.5" r="1.5"/><circle class="b" cx="12" cy="12" r="1.5"/><circle class="b" cx="15.5" cy="15.5" r="1.5"/></svg>';
const LIST = '<svg viewBox="0 0 24 24" aria-hidden="true"><path class="s" d="M4 6h16M4 12h16M4 18h16"/></svg>';
const TICKET = '<svg viewBox="0 0 24 24" aria-hidden="true"><path class="s" d="M3 7a2 2 0 0 0 2-2h14a2 2 0 0 0 2 2v3a2 2 0 0 0 0 4v3a2 2 0 0 0-2 2H5a2 2 0 0 0-2-2v-3a2 2 0 0 0 0-4z"/><path class="s" d="M9 9h6M9 12h6M9 15h4"/></svg>';
const GEAR = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle class="s" cx="12" cy="12" r="3.2"/><path class="s" d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1"/></svg>';

const STEPS = [
  {
    icon: DIE,
    title: 'Welcome to Roll Credits',
    text: "Can't decide what to watch? Let the dice pick. This quick tour covers the basics.",
  },
  {
    icon: DIE,
    title: 'Roll for tonight',
    text: 'On the Roll tab, tap <b>Roll for tonight</b>. The first die picks a category, the second picks a movie in it. Like it? Tap <b>Yes, watch it</b>. Not feeling it? Reroll as many times as you want.',
    tip: 'Have real dice? Switch to <b>Physical dice</b> and type in what you rolled.',
  },
  {
    icon: () => iconSVG(store.activeFestival().icon),
    title: 'Pick a festival',
    text: 'Tap the festival name at the top of the screen to switch between <b>Halloween</b>, <b>Christmas</b>, and <b>Awards Season</b>, or create one of your own.',
  },
  {
    icon: LIST,
    title: 'Make it yours',
    text: "In that same menu, tap <b>Edit</b> next to a festival. You can swap any movie for one you'd rather watch (start typing and it'll suggest titles), and change its dice and theme.",
  },
  {
    icon: TICKET,
    title: 'Keep track of what you watched',
    text: 'Everything you watch lands on the <b>Watched</b> tab. Tap a movie to rate it and add notes. Watched something without rolling? Use <b>+ Log a movie</b>.',
  },
  {
    icon: () => iconSVG('popcorn'),
    title: 'Popcorn Pick',
    text: "Want something totally random? The <b>Popcorn</b> tab picks one movie from the whole catalog. Pick one or more moods if you want, or don't.",
  },
  {
    icon: GEAR,
    title: "You're ready",
    text: 'Dice style, backups, and more live in <b>Settings</b>. You can replay this tour from there anytime.',
  },
];

let step = 0;
let onDone = null;

function render() {
  const s = STEPS[step];
  const el = $('#tutorial');
  const icon = typeof s.icon === 'function' ? s.icon() : s.icon;
  const last = step === STEPS.length - 1;
  $('.tut-card', el).innerHTML = `
    <button type="button" class="tut-skip" data-act="skip" ${last ? 'hidden' : ''}>Skip</button>
    <div class="tut-icon">${icon}</div>
    <h2 class="tut-title" id="tut-title">${esc(s.title)}</h2>
    <p class="tut-text">${s.text}</p>
    ${s.tip ? `<p class="tut-tip">${s.tip}</p>` : ''}
    <div class="tut-dots" aria-hidden="true">${STEPS.map((_, i) => `<span class="${i === step ? 'on' : ''}"></span>`).join('')}</div>
    <div class="tut-nav">
      ${step > 0 ? '<button type="button" class="btn ghost" data-act="back">Back</button>' : ''}
      <button type="button" class="btn primary" data-act="next">${last ? "Let's roll" : step === 0 ? 'Show me' : 'Next'}</button>
    </div>`;
  $('.tut-card', el).setAttribute('aria-label', `Step ${step + 1} of ${STEPS.length}`);
}

function close() {
  const el = $('#tutorial');
  el.classList.remove('show');
  setTimeout(() => { el.hidden = true; }, 200);
  store.setSetting('tutorialSeen', true);
  document.removeEventListener('keydown', onKey);
  const cb = onDone;
  onDone = null;
  if (cb) cb();
}

function onKey(e) {
  if (e.key === 'Escape') close();
  else if (e.key === 'ArrowRight' && step < STEPS.length - 1) { step++; render(); }
  else if (e.key === 'ArrowLeft' && step > 0) { step--; render(); }
}

export function startTutorial(done) {
  step = 0;
  onDone = done || null;
  const el = $('#tutorial');
  el.hidden = false;
  render();
  requestAnimationFrame(() => el.classList.add('show'));
  document.addEventListener('keydown', onKey);
}

export function initTutorial() {
  $('#tutorial').addEventListener('click', (e) => {
    const b = e.target.closest('[data-act]');
    if (!b) return;
    const act = b.dataset.act;
    if (act === 'skip') close();
    else if (act === 'back') { step--; render(); }
    else if (act === 'next') {
      if (step === STEPS.length - 1) close();
      else { step++; render(); }
    }
  });
}
