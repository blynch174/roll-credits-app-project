// Starter data for a brand-new install (or "Reset to defaults").
// Each table is locked at 12 slots. A slot is either a movie object or null (empty).

export const SLOTS_PER_CATEGORY = 12;

// Preset category colors. Each one is tested to stay readable on all four themes.
export const SWATCHES = [
  { id: 'pumpkin', hex: '#E0782F' },
  { id: 'crimson', hex: '#C0392B' },
  { id: 'violet', hex: '#8E5BD6' },
  { id: 'indigo', hex: '#4F6BD8' },
  { id: 'teal', hex: '#1F9E8F' },
  { id: 'moss', hex: '#5E9E3A' },
  { id: 'gold', hex: '#B8860B' },
  { id: 'slate', hex: '#6B7A8F' },
];

export const THEMES = [
  { id: 'pumpkin', name: 'Pumpkin', desc: 'Orange and black' },
  { id: 'crypt', name: 'Crypt', desc: 'Stone gray and moss' },
  { id: 'bloodmoon', name: 'Blood Moon', desc: 'Deep red' },
  { id: 'afraid', name: 'Afraid of the Dark', desc: 'Light mode' },
];

// [title, year, vibe]
const DEFAULT_CATEGORIES = [
  {
    name: 'Light Halloween Fun',
    vibe: "It's October. Atmosphere and fun matter more than maximum fear.",
    color: 'pumpkin',
    movies: [
      ['Beetlejuice', 1988, 'Kickoff perfection'],
      ['The Addams Family', 1991, 'Cozy macabre'],
      ['Hocus Pocus', 1993, 'Mandatory'],
      ['Sleepy Hollow', 1999, 'Gothic perfection'],
      ['The Witches', 1990, 'Childhood nightmare fuel'],
      ['The Lost Boys', 1987, 'Vampires + pure 80s'],
      ['Fright Night', 1985, 'Extremely Halloween-y'],
      ['The Fog', 1980, 'Pure atmospheric Halloween'],
      ['The Monster Squad', 1987, 'Classic-monster Halloween fun'],
      ['Gremlins', 1984, 'Cozy creature chaos'],
      ['The Frighteners', 1996, 'Ghosts + comedy + murder mystery'],
      ['Something Wicked This Way Comes', 1983, 'Autumn dark-fantasy creepiness'],
    ],
  },
  {
    name: 'Slasher / Monsters',
    vibe: 'Monsters, blood, practical effects, or a premise that gets increasingly unhinged.',
    color: 'crimson',
    movies: [
      ['The Evil Dead', 1981, 'Cabin-from-hell night'],
      ['Evil Dead II', 1987, 'Horror turned completely insane'],
      ['The Texas Chain Saw Massacre', 1974, 'Filthy, upsetting classic'],
      ['The Autopsy of Jane Doe', 2016, 'Claustrophobic and nasty'],
      ['The Mist', 2007, 'Monsters + existential misery'],
      ['Scream', 1996, 'Essential'],
      ['Barbarian', 2022, 'What the actual fuck'],
      ['Ready or Not', 2019, 'Rich people + murder + dark comedy'],
      ['The Cabin in the Woods', 2011, 'Horror movie chaos'],
      ['Saw', 2004, 'Puzzle-box brutality'],
      ['Slither', 2006, 'Slimy creature mayhem'],
      ['The Blob', 1988, 'Old-school practical-effects carnage'],
    ],
  },
  {
    name: 'Sleep with the Lights On',
    vibe: 'Actual fear: dread, jump scares, disturbing imagery, nightmare fuel.',
    color: 'indigo',
    movies: [
      ['The Conjuring', 2013, 'Haunted-house night'],
      ['The Ring', 2002, 'Cold, rainy dread'],
      ['Sinister', 2012, 'Creepy mystery that keeps getting worse'],
      ['Hereditary', 2018, 'Emotional damage'],
      ['The Strangers', 2008, 'Horrible in the best way'],
      ['The Exorcist', 1973, 'The heavyweight'],
      ['A Nightmare on Elm Street', 1984, 'Freddy enters the chat'],
      ['Poltergeist', 1982, 'Suburban nightmare'],
      ['It Follows', 2014, 'Constant, creeping dread'],
      ['The Witch', 2015, 'Folk-horror dread'],
      ['Insidious', 2010, 'Classic modern haunted-house scares'],
      ['Host', 2020, 'Seance goes catastrophically wrong'],
    ],
  },
  {
    name: 'Weird / Campy',
    vibe: 'Strange, funny, excessive, surreal, or gloriously ridiculous.',
    color: 'violet',
    movies: [
      ['The Faculty', 1998, '90s alien paranoia'],
      ['What We Do in the Shadows', 2014, 'Idiotic vampire roommates'],
      ['Killer Klowns from Outer Space', 1988, 'Clowns, cotton candy, chaos'],
      ['Elvira: Mistress of the Dark', 1988, 'Campy Halloween royalty'],
      ['Death Becomes Her', 1992, 'Glamorous supernatural insanity'],
      ['House', 1977, 'Surreal haunted-house fever dream'],
      ['Little Shop of Horrors', 1986, 'Musical man-eating-plant madness'],
      ['The Return of the Living Dead', 1985, 'Punk zombies + absurdity'],
      ['Army of Darkness', 1992, 'Evil Dead goes full cartoon'],
      ['Tremors', 1990, 'Underground monster fun'],
      ['Dead Alive / Braindead', 1992, 'Comically outrageous gore'],
      ['Creepshow', 1982, 'Comic-book horror anthology'],
    ],
  },
  {
    name: 'Suspense / Thriller',
    vibe: 'Slow is welcome when the mystery or tension keeps pulling you forward.',
    color: 'teal',
    movies: [
      ['The Sixth Sense', 1999, 'Ghost-story classic'],
      ['The Others', 2001, 'Elegant ghost story'],
      ['The Village', 2004, 'Autumn dread'],
      ['The Shining', 1980, 'Prestige nightmare'],
      ['House of the Devil', 2009, 'Occult slow-burn tension'],
      ['The Invitation', 2015, 'Dinner-party paranoia'],
      ['10 Cloverfield Lane', 2016, 'Claustrophobic uncertainty'],
      ['The Changeling', 1980, 'Old-school haunted mystery'],
      ['The Night House', 2020, 'Grief + supernatural mystery'],
      ["The Blackcoat's Daughter", 2015, 'Cold, bleak occult dread'],
      ['The Omen', 1976, 'Doom creeping into ordinary life'],
      ['The Skeleton Key', 2005, 'Southern-gothic mystery'],
    ],
  },
  {
    // Slot 6 starts empty. An empty category acts as the Wild Card.
    name: 'Wild Card',
    vibe: 'Empty = pick any category. Fill it with your own 12 to make it a custom category.',
    color: 'slate',
    movies: [],
  },
];

export function uid() {
  if (globalThis.crypto && crypto.randomUUID) return crypto.randomUUID();
  return 'id-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
}

export function makeMovie(title, year, vibe) {
  return { id: uid(), title, year: year || null, vibe: vibe || '' };
}

export function buildDefaultState() {
  const categories = DEFAULT_CATEGORIES.map((c) => {
    const slots = Array.from({ length: SLOTS_PER_CATEGORY }, (_, i) => {
      const m = c.movies[i];
      return m ? makeMovie(m[0], m[1], m[2]) : null;
    });
    return { id: uid(), name: c.name, vibe: c.vibe, color: c.color, slots };
  });

  return {
    version: 1,
    settings: { theme: 'pumpkin', diceMode: 'virtual', slotMode: 'keep' },
    activeMenu: 'halloween',
    menus: [{ id: 'halloween', name: 'Halloween', categories }],
    season: { started: new Date().toISOString(), watched: [] },
  };
}
