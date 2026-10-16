// 3D dice, powered by dice-box (vendor/dice-box, MIT license).
// Nothing here downloads until 3D dice are actually wanted, so Flat mode stays light.
// If 3D can't start (no WebGL, offline on first use), rolls quietly fall back to the flat dice.

const LIB = '../vendor/dice-box/dice-box.es.min.js';
const SUPPORTED = [4, 6, 8, 12, 20]; // coin (2) uses the CSS coin instead
const INIT_TIMEOUT = 15000;
const ROLL_TIMEOUT = 12000;

let box = null;
let ready = null; // promise resolving true/false
let failed = false;
let hideTimer = null;

export const supports = (sides) => SUPPORTED.includes(sides);
export const hasFailed = () => failed;
export const isLoaded = () => !!box;

const reducedMotion = () => window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function webglAvailable() {
  try {
    const c = document.createElement('canvas');
    return !!(window.WebGLRenderingContext && (c.getContext('webgl') || c.getContext('experimental-webgl')));
  } catch (e) {
    return false;
  }
}

const withTimeout = (p, ms) => Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), ms))]);

// Starts loading the library and physics. Safe to call many times.
export function prepare() {
  if (ready) return ready;
  if (reducedMotion() || !webglAvailable()) {
    failed = true;
    return (ready = Promise.resolve(false));
  }
  const stage = document.getElementById('dice-stage');
  // The asset path must include the GitHub Pages sub-folder (e.g. /roll-credits-app-project/).
  const assetPath = new URL('vendor/dice-box/assets/', document.baseURI).pathname;
  ready = withTimeout(
    import(LIB).then(async ({ default: DiceBox }) => {
      // The stage must be visible while the library measures it, or the dice world is 0×0.
      stage.hidden = false;
      box = new DiceBox({
        container: '#dice-stage',
        assetPath,
        origin: location.origin,
        scale: 6,
        gravity: 2,
        throwForce: 6,
        spinForce: 5,
        settleTimeout: 4000,
        enableShadows: true,
        shadowTransparency: 0.85,
      });
      await box.init();
      box.hide();
      return true;
    }),
    INIT_TIMEOUT
  ).catch(() => {
    stage.hidden = true;
    failed = true;
    box = null;
    return false;
  });
  return ready;
}

// Throws one die and resolves with the number it lands on, or null if 3D isn't available.
export async function roll(sides, color) {
  if (!supports(sides)) return null;
  const ok = await prepare();
  if (!ok || !box) return null;
  clearTimeout(hideTimer);
  const stage = document.getElementById('dice-stage');
  stage.classList.remove('fade');
  box.show();
  try {
    const results = await withTimeout(box.roll(`1d${sides}`, { themeColor: color || '#ff7a1a' }), ROLL_TIMEOUT);
    const value = results && results[0] && results[0].value;
    if (!(value >= 1 && value <= sides)) return null;
    return value;
  } catch (e) {
    return null;
  }
}

// Lets the dice sit for a moment, then fades them away.
export function settle(ms = 900) {
  if (!box) return;
  clearTimeout(hideTimer);
  const stage = document.getElementById('dice-stage');
  hideTimer = setTimeout(() => {
    stage.classList.add('fade');
    hideTimer = setTimeout(() => {
      box.clear();
      box.hide();
      stage.classList.remove('fade');
    }, 350);
  }, ms);
}

// Removes dice right away (e.g. when leaving the Roll screen).
export function clearNow() {
  if (!box) return;
  clearTimeout(hideTimer);
  box.clear();
  box.hide();
  document.getElementById('dice-stage').classList.remove('fade');
}
