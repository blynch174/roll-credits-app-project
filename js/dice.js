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

const reduceMotion = () =>
  window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// SVG outline for a die face. d6 = square, d12 = pentagon.
export function dieSVG(sides) {
  const shape =
    sides === 6
      ? '<rect x="8" y="8" width="84" height="84" rx="16" />'
      : '<polygon points="50,6 93,37 77,90 23,90 7,37" />';
  return `<svg viewBox="0 0 100 100" aria-hidden="true">${shape}</svg>`;
}

// Tumbles a die element and lands on `final`.
// The element needs a child with class "die-num".
export function tumble(el, sides, final, duration = 900) {
  const num = el.querySelector('.die-num');
  if (reduceMotion()) {
    num.textContent = final;
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
      // Numbers flicker fast at first, then slow down before landing.
      const gap = 50 + (t / duration) * 140;
      if (now - last > gap) {
        num.textContent = randInt(1, sides);
        last = now;
      }
      if (t < duration) {
        requestAnimationFrame(frame);
      } else {
        num.textContent = final;
        el.classList.remove('rolling');
        void el.offsetWidth; // restart the landing animation
        el.classList.add('landed');
        resolve();
      }
    }
    requestAnimationFrame(frame);
  });
}
