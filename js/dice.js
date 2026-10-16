// Fair random numbers and the 2D dice tumble.

// Unbiased random integer from min to max (inclusive).
export function randInt(min, max) {
  const range = max - min + 1;
  if (globalThis.crypto && crypto.getRandomValues) {
    const limit = Math.floor(0x100000000 / range) * range;
    const buf = new Uint32Array(1);
    do {
      crypto.getRandomValues(buf);
    } while (buf[0] >= limit);
    return min + (buf[0] % range);
  }
  return min + Math.floor(Math.random() * range);
}

// What a die shows for a number. Coins show H/T.
export const faceLabel = (sides, n) => (n == null ? '?' : sides === 2 ? (n === 1 ? 'H' : 'T') : String(n));

const reduceMotion = () =>
  window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// Flips the CSS coin and lands on heads (1) or tails (2).
export function flipCoin(el, final, duration = 1300) {
  const inner = el.querySelector('.coin-3d');
  const end = final === 2 ? 180 : 0;
  el.classList.add('has-value');
  el.classList.toggle('tails', final === 2);
  if (!duration || reduceMotion() || !inner.animate) return Promise.resolve();
  const turns = 4 + randInt(0, 2); // full spins before landing
  const spin = turns * 360 + end;
  const anim = inner.animate(
    [
      { transform: 'translateY(0) rotateX(0deg) scale(1)' },
      { transform: `translateY(-90px) rotateX(${spin * 0.5}deg) scale(1.18)`, offset: 0.45 },
      { transform: `translateY(0) rotateX(${spin - 14}deg) scale(1)`, offset: 0.85 },
      { transform: `translateY(-6px) rotateX(${spin + 6}deg) scale(1)`, offset: 0.93 },
      { transform: `translateY(0) rotateX(${spin}deg) scale(1)` },
    ],
    { duration, easing: 'cubic-bezier(.3,.7,.4,1)' }
  );
  return anim.finished.then(() => {}).catch(() => {});
}

// Shows a result on a flat die without the tumble (used after a 3D roll).
export function showFace(el, sides, value) {
  if (sides === 2) return flipCoin(el, value, 0);
  const num = el.querySelector('.die-num');
  num.textContent = faceLabel(sides, value);
  el.classList.remove('landed');
  void el.offsetWidth;
  el.classList.add('landed');
  return Promise.resolve();
}

// Tumbles a die element (needs a child .die-num) and lands on `final`.
export function tumble(el, sides, final, duration = 900) {
  if (sides === 2) return flipCoin(el, final);
  const num = el.querySelector('.die-num');
  if (reduceMotion()) {
    num.textContent = faceLabel(sides, final);
    el.classList.add('landed');
    return Promise.resolve();
  }
  el.classList.remove('landed');
  el.classList.add('rolling');
  return new Promise((resolve) => {
    const start = performance.now();
    let last = 0;
    function frame(now) {
      const t = now - start;
      const gap = 50 + (t / duration) * 140; // flicker fast, then slow down
      if (now - last > gap) {
        num.textContent = faceLabel(sides, randInt(1, sides));
        last = now;
      }
      if (t < duration) {
        requestAnimationFrame(frame);
      } else {
        num.textContent = faceLabel(sides, final);
        el.classList.remove('rolling');
        void el.offsetWidth;
        el.classList.add('landed');
        resolve();
      }
    }
    requestAnimationFrame(frame);
  });
}

export const wait = (ms) => new Promise((r) => setTimeout(r, ms));
