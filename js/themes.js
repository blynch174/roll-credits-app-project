// Themes: one look for the whole app, picked in Settings → Themes. Festivals don't have themes.
//
// A theme is more than colors: it also sets the outlines (thickness, style, glow), corner shape, shadows, a faint
// background texture, and the title font. Layout never changes. To add one: add an entry to a group below. Ids must
// be unique and never change (people's saved choice points at the id). Fonts come from Google Fonts (all free to
// use: OFL or Apache licensed) and are listed in FONT_URL; only the ones a theme uses get downloaded.

export const DEFAULT_THEME = 'classic-dark';

export const FONT_URL = 'https://fonts.googleapis.com/css2?' + [
  'Special+Elite', 'Playfair+Display:wght@700', 'Limelight', 'Abril+Fatface', 'Monoton', 'VT323', 'Luckiest+Guy',
  'Share+Tech+Mono', 'Quicksand:wght@700', 'Creepster', 'Anton', 'Eater', 'Mountains+of+Christmas:wght@700', 'Fredoka:wght@600',
].map((f) => 'family=' + f).join('&') + '&display=swap';

const SYSTEM_DISPLAY = '"Avenir Next Condensed", "Arial Narrow", system-ui, sans-serif';
const BODY = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';

// Faint textures (kept subtle so text stays easy to read).
const GRAIN = (opacity) => `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='2' stitchTiles='stitch'/%3E%3CfeColorMatrix values='0 0 0 0 .5 0 0 0 0 .5 0 0 0 0 .5 0 0 0 ${opacity} 0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`;
const SCANLINES = (c) => `repeating-linear-gradient(0deg, ${c} 0 1px, transparent 1px 3px)`;
const DOTS = (c, size) => `radial-gradient(${c} 1px, transparent 1.6px) 0 0 / ${size}px ${size}px`;
const RAIN = 'repeating-linear-gradient(100deg, rgba(255,255,255,.028) 0 1px, transparent 1px 15px)';
const STARS = 'radial-gradient(1px 1px at 20% 30%, rgba(255,255,255,.55), transparent), radial-gradient(1px 1px at 70% 12%, rgba(255,255,255,.4), transparent), radial-gradient(1.5px 1.5px at 85% 60%, rgba(255,255,255,.35), transparent), radial-gradient(1px 1px at 40% 75%, rgba(255,255,255,.35), transparent), radial-gradient(1px 1px at 10% 90%, rgba(255,255,255,.3), transparent)';

// Builds a theme from a palette + style. Every value is spelled out (no var() references), so a theme card in the
// picker can preview itself just by setting these on the card.
function t(id, name, desc, c, s = {}) {
  const st = {
    edgeWidth: 1, edgeStyle: 'solid', cardWidth: null, cardStyle: null, cardEdgeColor: null,
    radius: 14, pill: 99, shadow: 'none', glow: null, bgLayer: 'none', texture: 'none', textureSize: 'auto',
    cardBg: null, display: SYSTEM_DISPLAY, displayScale: 1, displayCase: 'uppercase', displayTracking: '.05em',
    label: BODY, labelScale: 1, labelTracking: '.08em', ...s,
  };
  const accent2 = c.accent2 || c.accent;
  const cardEdge = `${st.cardWidth || st.edgeWidth}px ${st.cardStyle || st.edgeStyle} ${st.cardEdgeColor || c.line}`;
  const r = st.radius;
  const vars = {
    bg: c.bg, surface: c.surface, 'surface-2': c.surface2, line: c.line, text: c.text, muted: c.muted,
    accent: c.accent, 'accent-ink': c.accentInk, 'accent-2': accent2, 'accent-2-ink': c.accent2Ink || c.accentInk,
    danger: c.danger || '#ff5a4e', watch: c.watch || '#d6312b', 'watch-ink': c.watchInk || '#ffffff',
    edge: `${st.edgeWidth > 2 ? 2 : st.edgeWidth}px solid ${c.line}`,
    'card-edge': cardEdge,
    'card-bg': st.cardBg || c.surface,
    'card-shadow': [st.shadow, st.glow].filter((x) => x && x !== 'none').join(', ') || 'none',
    'r-xl': `${Math.round(r * 1.25)}px`, 'r-lg': `${r}px`, 'r-md': `${Math.round(r * 0.85)}px`, 'r-sm': `${Math.round(r * 0.7)}px`,
    'r-pill': `${st.pill}px`,
    'bg-layer': st.bgLayer, texture: st.texture,
    'font-display': st.display, 'display-scale': String(st.displayScale), 'display-case': st.displayCase,
    'display-tracking': st.displayTracking,
    'font-label': st.label, 'label-scale': String(st.labelScale), 'label-tracking': st.labelTracking,
  };
  return { id, name, desc, light: !!c.light, vars };
}

export const THEME_GROUPS = [
  {
    id: 'classic', name: 'Classic', desc: "Roll Credits' own look",
    themes: [
      t('classic-dark', 'Classic Dark', 'Orange on warm black', {
        bg: '#14100c', surface: '#211a13', surface2: '#2c231a', line: '#3a2e22', text: '#f3e9dc', muted: '#a8977f',
        accent: '#ff7a1a', accentInk: '#1a0f05', accent2: '#ffb36b',
      }),
      t('classic-light', 'Classic Light', 'Orange on cream', {
        light: true, bg: '#f6f1e9', surface: '#ffffff', surface2: '#efe8dd', line: '#ded4c5', text: '#231c16', muted: '#6e6257',
        accent: '#c2560c', accentInk: '#ffffff', accent2: '#8a4b14', danger: '#b3261e',
      }, { shadow: '0 2px 8px rgba(60,40,20,.08)' }),
    ],
  },
  {
    id: 'silver', name: 'Silver Screen', desc: 'Old Hollywood',
    themes: [
      t('noir', 'Noir', 'Smoke, steel, and shadow', {
        bg: '#0d0e10', surface: '#17191c', surface2: '#22252a', line: '#5d636b', text: '#ebe8e1', muted: '#9a9a94',
        accent: '#d8d2c4', accentInk: '#111214', accent2: '#8ea4ba', watch: '#a32a24',
      }, {
        radius: 4, pill: 4, cardWidth: 4, cardStyle: 'double', texture: GRAIN(0.09),
        display: '"Special Elite", ' + SYSTEM_DISPLAY, displayScale: 1.02, displayTracking: '.04em',
        bgLayer: 'radial-gradient(ellipse at 50% -10%, rgba(220,215,200,.10), transparent 60%)',
      }),
      t('sepia', 'Sepia', 'Aged film stock', {
        light: true, bg: '#eadcc0', surface: '#f6ecd8', surface2: '#e6d4b2', line: '#b39669', text: '#3b2814', muted: '#77603f',
        accent: '#8a5424', accentInk: '#fff7e6', accent2: '#a3642f', danger: '#9c2b1c', watch: '#9c2b1c',
      }, {
        radius: 8, pill: 8, cardWidth: 1.5, shadow: '0 2px 0 rgba(90,60,25,.18)', texture: GRAIN(0.12),
        display: '"Playfair Display", Georgia, serif', displayScale: 1.28, displayCase: 'none', displayTracking: '.01em',
      }),
      t('golden-age', 'Golden Age', 'Black tie and art deco gold', {
        bg: '#0b0b0c', surface: '#141312', surface2: '#1e1c19', line: '#9c7f2c', text: '#f4ecd6', muted: '#ab9f82',
        accent: '#d4af37', accentInk: '#1a1405', accent2: '#ead9a6',
      }, {
        radius: 3, pill: 3, cardWidth: 4, cardStyle: 'double',
        bgLayer: 'radial-gradient(ellipse at 50% -20%, rgba(212,175,55,.16), transparent 55%)',
        display: 'Limelight, ' + SYSTEM_DISPLAY, displayScale: 1.04, displayTracking: '.06em',
      }),
      t('matinee', 'Matinee', 'Red velvet and ticket stubs', {
        light: true, bg: '#f6eee2', surface: '#fffaf2', surface2: '#f0e4d2', line: '#c9a487', text: '#2a1813', muted: '#7a5e52',
        accent: '#9e1b32', accentInk: '#ffffff', accent2: '#b8862b', danger: '#b3261e', watch: '#9e1b32',
      }, {
        radius: 10, cardWidth: 2, cardStyle: 'dashed', shadow: '0 2px 8px rgba(90,30,20,.08)',
        display: '"Abril Fatface", Georgia, serif', displayScale: 1.26, displayCase: 'none', displayTracking: '.02em',
      }),
    ],
  },
  {
    id: 'genre', name: 'Genre', desc: 'A different kind of night',
    themes: [
      t('drive-in', 'Drive-In', 'Neon under the stars', {
        bg: '#0a0918', surface: '#15132e', surface2: '#1e1b42', line: '#ff4fa3', text: '#f2f0ff', muted: '#a8a4d2',
        accent: '#ff4fa3', accentInk: '#2a0016', accent2: '#3ee6d6', accent2Ink: '#002622',
      }, {
        radius: 14, cardWidth: 1.5, glow: '0 0 0 1px rgba(255,79,163,.18), 0 0 16px rgba(255,79,163,.28)',
        bgLayer: `${STARS}, linear-gradient(180deg, #17154a 0%, #0a0918 55%)`,
        display: 'Monoton, ' + SYSTEM_DISPLAY, displayScale: 0.92, displayTracking: '.04em',
      }),
      t('vhs', 'VHS', 'Be kind, rewind', {
        bg: '#120c18', surface: '#1c1426', surface2: '#281c35', line: '#e9e1f2', text: '#f4eefa', muted: '#ab9dbb',
        accent: '#3ee0c8', accentInk: '#04201c', accent2: '#ffb347', accent2Ink: '#2a1600',
      }, {
        radius: 4, pill: 4, edgeWidth: 1, cardWidth: 2, shadow: '4px 4px 0 #3ee0c8', texture: SCANLINES('rgba(255,255,255,.035)'),
        display: 'VT323, ui-monospace, monospace', displayScale: 1.45, displayTracking: '.06em',
        label: 'VT323, ui-monospace, monospace', labelScale: 1.45, labelTracking: '.1em',
      }),
      t('saturday-morning', 'Saturday Morning', 'Cartoon colors and outlines', {
        light: true, bg: '#fff3c9', surface: '#ffffff', surface2: '#ffeaa0', line: '#16110c', text: '#16110c', muted: '#5a5048',
        accent: '#2f6fe4', accentInk: '#ffffff', accent2: '#ff4d4d', accent2Ink: '#ffffff', danger: '#d62020',
      }, {
        radius: 18, edgeWidth: 2, cardWidth: 3, shadow: '4px 4px 0 #16110c', texture: DOTS('rgba(0,0,0,.07)', 12),
        display: '"Luckiest Guy", ' + SYSTEM_DISPLAY, displayScale: 1.14, displayTracking: '.04em',
      }),
      t('terminal', 'Sci-Fi Terminal', 'Green phosphor on black', {
        bg: '#040a06', surface: '#07120a', surface2: '#0c1c10', line: '#1d7a38', text: '#b8ffca', muted: '#5fae76',
        accent: '#39ff6a', accentInk: '#021006', accent2: '#ffd23f', accent2Ink: '#1f1600', danger: '#ff5555',
      }, {
        radius: 2, pill: 2, glow: '0 0 12px rgba(57,255,106,.14)', texture: SCANLINES('rgba(57,255,106,.045)'),
        display: '"Share Tech Mono", ui-monospace, monospace', displayScale: 1.02, displayTracking: '.08em',
        label: '"Share Tech Mono", ui-monospace, monospace', labelScale: 1.05,
      }),
      t('rainy-day', 'Rainy Day', 'Slate skies and soft blue', {
        bg: '#0e1216', surface: '#171d23', surface2: '#1f272f', line: '#2f3c48', text: '#e9eef3', muted: '#93a0ad',
        accent: '#7fb2e5', accentInk: '#06182b', accent2: '#a8cbbb', accent2Ink: '#0c2018', danger: '#ff8a7a',
      }, {
        radius: 20, shadow: '0 8px 20px rgba(0,0,0,.28)', texture: RAIN,
        bgLayer: 'linear-gradient(180deg, #16202a 0%, #0e1216 60%)',
        display: 'Quicksand, ' + SYSTEM_DISPLAY, displayScale: 1.02, displayTracking: '.06em',
      }),
    ],
  },
  {
    id: 'spooky', name: 'Spooky', desc: 'For Halloween season',
    themes: [
      t('classic-halloween', 'Classic Halloween', 'Black and pumpkin orange', {
        bg: '#0b0806', surface: '#17100a', surface2: '#22170e', line: '#6b3510', text: '#fbeee0', muted: '#b39a83',
        accent: '#ff7518', accentInk: '#1a0b00', accent2: '#9b5de5', accent2Ink: '#ffffff',
      }, {
        radius: 14, cardWidth: 1.5, glow: '0 0 18px rgba(255,117,24,.14)',
        bgLayer: 'radial-gradient(ellipse at 50% 110%, rgba(255,117,24,.16), transparent 55%)',
        display: 'Creepster, ' + SYSTEM_DISPLAY, displayScale: 1.32, displayTracking: '.06em',
      }),
      t('grindhouse', 'Grindhouse', 'Worn reels and drive-in gore', {
        bg: '#150c0a', surface: '#20120e', surface2: '#2b1813', line: '#7a2a20', text: '#f1e2d2', muted: '#b0907e',
        accent: '#d7261e', accentInk: '#ffffff', accent2: '#e8b04a', accent2Ink: '#2a1a00', watch: '#d7261e',
      }, {
        radius: 3, pill: 3, cardWidth: 2, cardStyle: 'dashed', texture: GRAIN(0.16),
        display: 'Anton, ' + SYSTEM_DISPLAY, displayScale: 1.3, displayTracking: '.05em',
        label: 'Anton, ' + SYSTEM_DISPLAY, labelScale: 1.15, labelTracking: '.12em',
      }),
      t('ghoulish', 'Ghoulish', 'Ecto green and ghost blue', {
        bg: '#051214', surface: '#0a1d20', surface2: '#0f292d', line: '#1fbfa8', text: '#e3fff8', muted: '#84b8ad',
        accent: '#3dfc9a', accentInk: '#022014', accent2: '#4fb3ff', accent2Ink: '#02182b',
      }, {
        radius: 16, cardWidth: 1.5, glow: '0 0 14px rgba(61,252,154,.22)',
        bgLayer: 'radial-gradient(ellipse at 20% 0%, rgba(79,179,255,.16), transparent 50%), radial-gradient(ellipse at 90% 100%, rgba(61,252,154,.12), transparent 50%)',
        display: 'Eater, ' + SYSTEM_DISPLAY, displayScale: 0.98, displayTracking: '.04em',
      }),
    ],
  },
  {
    id: 'seasonal', name: 'Holidays', desc: 'For the holiday season',
    themes: [
      t('evergreen', 'Evergreen', 'Pine, gold, and falling snow', {
        bg: '#0b1410', surface: '#14211a', surface2: '#1c2c23', line: '#8c7a3a', text: '#eef2ea', muted: '#94a69a',
        accent: '#e8b84a', accentInk: '#1c1405', accent2: '#d94a4a', accent2Ink: '#ffffff',
      }, {
        radius: 14, cardWidth: 1.5, texture: DOTS('rgba(255,255,255,.08)', 22),
        display: '"Mountains of Christmas", ' + SYSTEM_DISPLAY, displayScale: 1.45, displayCase: 'none', displayTracking: '.02em',
      }),
      t('candy-cane', 'Candy Cane', 'Peppermint stripes', {
        bg: '#160a0c', surface: '#221214', surface2: '#2e181b', line: '#e8323a', text: '#fbeff0', muted: '#b89c9e',
        accent: '#ff4d57', accentInk: '#ffffff', accent2: '#7fd6a4', accent2Ink: '#05230f', danger: '#ffb0a8',
      }, {
        radius: 14, cardWidth: 3, cardEdgeColor: 'transparent',
        cardBg: 'linear-gradient(#221214, #221214) padding-box, repeating-linear-gradient(45deg, #e8323a 0 7px, #fbeff0 7px 14px) border-box',
        display: 'Fredoka, ' + SYSTEM_DISPLAY, displayScale: 1.04, displayTracking: '.04em',
      }),
    ],
  },
];

const ALL = THEME_GROUPS.flatMap((g) => g.themes);
export const isThemeId = (id) => ALL.some((x) => x.id === id);
export const themeById = (id) => ALL.find((x) => x.id === id) || ALL.find((x) => x.id === DEFAULT_THEME);

// Themes from before the v3.18 redesign, mapped to the closest new one.
const RETIRED = {
  'classic-black': 'classic-dark', crypt: 'ghoulish', bloodmoon: 'grindhouse', silentnight: 'evergreen',
  candycane: 'candy-cane', snowday: 'classic-light', goldstatue: 'golden-age', redcarpet: 'golden-age', blacktie: 'noir',
  silverscreen: 'noir', sands: 'sepia', rainyday: 'rainy-day', arthouse: 'rainy-day', saturday: 'saturday-morning',
  bubblegum: 'saturday-morning', junglegym: 'saturday-morning', crayonbox: 'saturday-morning', linernotes: 'sepia',
  drivein: 'drive-in', lateshow: 'grindhouse',
};
export const retiredTheme = (id) => RETIRED[id] || null;

// Before v3.6 each festival had its own theme. Maps an old festival theme to the library.
const OLD_DEFAULTS = { halloween: 'classic-halloween', christmas: 'evergreen', awards: 'golden-age', kids: 'saturday-morning', bucketlist: 'sepia' };
const OLD_RENAMED = { pumpkin: 'classic-dark', afraid: 'classic-light', 'custom-dark': 'classic-dark', 'custom-light': 'classic-light' };
export function themeFromOldFestival(f) {
  if (!f) return DEFAULT_THEME;
  let id = f.theme ? (OLD_RENAMED[f.theme] || f.theme) : (OLD_DEFAULTS[f.themeSet || f.id] || DEFAULT_THEME);
  id = RETIRED[id] || id;
  return ALL.some((x) => x.id === id) ? id : DEFAULT_THEME;
}

// Inline style string for previewing a theme on a card.
export function themeStyle(theme) {
  return Object.entries(theme.vars).map(([k, v]) => `--${k}:${v}`).join(';').replace(/&/g, '&amp;').replace(/"/g, '&quot;');
}

let fontsLoaded = false;
function loadFonts() {
  if (fontsLoaded) return;
  fontsLoaded = true;
  const l = document.createElement('link');
  l.rel = 'stylesheet';
  l.href = FONT_URL;
  document.head.appendChild(l);
}

export function applyTheme(themeId) {
  const theme = themeById(themeId);
  const root = document.documentElement;
  for (const [k, v] of Object.entries(theme.vars)) root.style.setProperty('--' + k, v);
  root.dataset.theme = theme.id;
  root.style.colorScheme = theme.light ? 'light' : 'dark';
  if (theme.vars['font-display'] !== SYSTEM_DISPLAY || theme.vars['font-label'] !== BODY) loadFonts();
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', theme.vars.bg);
}

// The picker previews every theme's font, so it loads them all.
export const loadThemeFonts = loadFonts;
