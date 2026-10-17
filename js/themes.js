// Color themes. One theme for the whole app, picked in Settings → Themes. Festivals don't have themes.
// To add a theme: add a t(...) line to one of the groups below. Ids must be unique and never change
// (people's saved choice points at the id).

export const DEFAULT_THEME = 'classic-dark';

const t = (id, name, desc, bg, surface, surface2, line, text, muted, accent, accentInk, danger) => ({
  id, name, desc,
  vars: { bg, surface, 'surface-2': surface2, line, text, muted, accent, 'accent-ink': accentInk, danger },
});

export const THEME_GROUPS = [
  {
    id: 'classic', name: 'Classic', desc: "Roll Credits' own colors",
    themes: [
      t('classic-dark', 'Classic Dark', 'Orange on warm black', '#14100c', '#211a13', '#2c231a', '#3a2e22', '#f3e9dc', '#a8977f', '#ff7a1a', '#1a0f05', '#ff5a4e'),
      t('classic-light', 'Classic Light', 'Orange on cream', '#f6f1e9', '#ffffff', '#efe8dd', '#ded4c5', '#231c16', '#6e6257', '#c2560c', '#ffffff', '#b3261e'),
      t('classic-black', 'Classic Black', 'Orange on pure black', '#000000', '#0e0e0e', '#171717', '#262626', '#f2f2f2', '#9a9a9a', '#ff7a1a', '#1a0f05', '#ff5a4e'),
    ],
  },
  {
    id: 'seasonal', name: 'Seasonal', desc: 'Spooky season and the holidays',
    themes: [
      t('crypt', 'Crypt', 'Stone gray and moss', '#0f1312', '#191f1d', '#222a27', '#2f3935', '#e3e8e4', '#8e9a94', '#8fd49a', '#0c1a10', '#ff6b5e'),
      t('bloodmoon', 'Blood Moon', 'Deep red', '#120708', '#1f0d0f', '#2b1316', '#3d1c20', '#f4e6e6', '#b0908f', '#e8403a', '#fff4f2', '#ff8a7a'),
      t('evergreen', 'Evergreen', 'Pine and gold', '#0c1410', '#15211b', '#1d2c24', '#2a3c32', '#eef2ea', '#94a69a', '#e8b84a', '#1c1405', '#ff6b5e'),
      t('candycane', 'Candy Cane', 'Peppermint red', '#150a0b', '#221213', '#2e181a', '#402426', '#f8eeee', '#b39a9a', '#ff5a5f', '#ffffff', '#ffb0a8'),
      t('silentnight', 'Silent Night', 'Midnight and frost', '#0b1020', '#141b30', '#1c2540', '#2a3554', '#e8eefb', '#93a0bf', '#a9c8ff', '#0b1430', '#ff8a7a'),
      t('snowday', 'Snow Day', 'Light, with holly red', '#f3f6f7', '#ffffff', '#e8eef0', '#d5dfe2', '#17222a', '#5c6b75', '#b3202a', '#ffffff', '#b3261e'),
    ],
  },
  {
    id: 'common', name: 'Common', desc: 'Everyday looks',
    themes: [
      t('goldstatue', 'Gold Statue', 'Black and gold', '#11100b', '#1d1a12', '#272318', '#383223', '#f4efe2', '#a89f88', '#d4af37', '#1a1405', '#ff6b5e'),
      t('redcarpet', 'Red Carpet', 'Velvet red', '#130a0b', '#21100f', '#2c1615', '#3e2120', '#f6ecea', '#b39a95', '#d62f3a', '#ffffff', '#ff8a7a'),
      t('blacktie', 'Black Tie', 'Ivory on black', '#0e0e10', '#19191c', '#222226', '#313136', '#ecebe7', '#9a9993', '#ebe6d9', '#111111', '#ff6b5e'),
      t('silverscreen', 'Silver Screen', 'Black and white', '#0d0d0d', '#181818', '#212121', '#303030', '#ededed', '#9a9a9a', '#f2f2f2', '#111111', '#ff6b5e'),
      t('sands', 'Sands of Time', 'Black and amber', '#100e0a', '#1b1812', '#252118', '#363022', '#f3eee2', '#a69d88', '#e0a94a', '#1b1205', '#ff6b5e'),
      t('arthouse', 'Art House', 'Deep teal', '#0a1214', '#121e21', '#1a292d', '#26393e', '#e6f0f0', '#8fa4a6', '#5fd0c4', '#04201c', '#ff8a7a'),
      t('saturday', 'Saturday Morning', 'Cartoon blue and sunshine', '#0d1424', '#16203a', '#1e2a4a', '#2b3a60', '#eef3ff', '#97a3c4', '#ffc83d', '#1f1500', '#ff6b5e'),
      t('bubblegum', 'Bubblegum', 'Pink and purple', '#160d1a', '#24142b', '#2f1b38', '#43284f', '#fbeefc', '#b89cbf', '#ff7ac8', '#2a0820', '#ffb0a8'),
      t('junglegym', 'Jungle Gym', 'Leafy green', '#0c140e', '#152218', '#1d2d21', '#2a3e2e', '#ecf5ea', '#95a898', '#7ddc6a', '#0a1a06', '#ff6b5e'),
      t('matinee', 'Matinee', 'Light, with old gold', '#f7f3ea', '#ffffff', '#efe9dc', '#dfd6c4', '#1f1b14', '#6d6455', '#8a6d1c', '#ffffff', '#b3261e'),
      t('crayonbox', 'Crayon Box', 'Light, with bright blue', '#fbf7ef', '#ffffff', '#f2ecdf', '#e2d9c6', '#1e1a14', '#6b6254', '#2f6fe4', '#ffffff', '#b3261e'),
      t('linernotes', 'Liner Notes', 'Light, with rust', '#f5f2ec', '#ffffff', '#ece7dd', '#dbd3c4', '#1c1a17', '#66605a', '#8a4b14', '#ffffff', '#b3261e'),
    ],
  },
  {
    id: 'developer', name: 'Developer picks', desc: 'Looks we like',
    themes: [
      t('drivein', 'Drive-In', 'Night sky and neon pink', '#0b0a1a', '#151331', '#1d1a40', '#2b2757', '#efeefe', '#9b98c4', '#ff4fa3', '#2a0016', '#ff8a7a'),
      t('vhs', 'VHS', 'Plum and tape-label teal', '#120c18', '#1e1428', '#281b35', '#3a2a4a', '#f3ecf8', '#a898b6', '#3ee0c8', '#04201c', '#ff6b5e'),
      t('lateshow', 'Late Show', 'Charcoal and marquee red', '#0f0f12', '#1a1a1f', '#232329', '#33333b', '#ececf0', '#9a9aa6', '#e2483d', '#ffffff', '#ff9a8a'),
    ],
  },
];

const ALL = THEME_GROUPS.flatMap((g) => g.themes);
export const isThemeId = (id) => ALL.some((x) => x.id === id);
export const themeById = (id) => ALL.find((x) => x.id === id) || ALL.find((x) => x.id === DEFAULT_THEME);

// Before v3.6 each festival had its own theme. Maps an old festival theme to the library.
const OLD_DEFAULTS = { halloween: 'classic-dark', christmas: 'evergreen', awards: 'goldstatue', kids: 'saturday', bucketlist: 'sands' };
const OLD_RENAMED = { pumpkin: 'classic-dark', afraid: 'classic-light', 'custom-dark': 'classic-dark', 'custom-light': 'classic-light' };
export function themeFromOldFestival(f) {
  if (!f) return DEFAULT_THEME;
  const id = f.theme ? (OLD_RENAMED[f.theme] || f.theme) : (OLD_DEFAULTS[f.themeSet || f.id] || DEFAULT_THEME);
  return ALL.some((x) => x.id === id) ? id : DEFAULT_THEME;
}

// Inline style string for previewing a theme on a card.
export function themeStyle(theme) {
  return Object.entries(theme.vars).map(([k, v]) => `--${k}:${v}`).join(';');
}

export function applyTheme(themeId) {
  const theme = themeById(themeId);
  const root = document.documentElement;
  for (const [k, v] of Object.entries(theme.vars)) root.style.setProperty('--' + k, v);
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', theme.vars.bg);
}
