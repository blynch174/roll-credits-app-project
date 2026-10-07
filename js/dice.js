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

// Tumbles a die element (needs a child .die-num) and lands on `final`.
export function tumble(el, sides, final, duration = 900) {
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
