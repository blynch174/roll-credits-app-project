// Built-in festivals, dice options, and category colors.
// To add a new built-in festival in a future update: add an entry to BUILT_IN_FESTIVALS.
// Existing users get it automatically on next launch (see ensureBuiltIns in store.js).

// Dice a category or festival can use. 2 = coin flip.
export const DIE_OPTIONS = [2, 4, 6, 8, 12, 20];
export const dieName = (n) => (n === 2 ? 'Coin' : 'd' + n);

// Preset category colors, readable on every theme.
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
export const swatchHex = (id) => (SWATCHES.find((s) => s.id === id) || SWATCHES[7]).hex;

// Rating icons a festival can use (drawn in icons.js).
export const RATING_ICONS = ['skull', 'tree', 'trophy', 'star', 'popcorn', 'heart', 'ghost', 'snowflake'];

export function uid() {
  if (globalThis.crypto && crypto.randomUUID) return crypto.randomUUID();
  return 'id-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
}

// A movie in a table slot. catalogId will link to data/catalog.json later (sequels).
export function makeMovie(title, year, catalogId = null) {
  return { id: uid(), title, year: year || null, catalogId };
}

// [name, color, [[title, year], ...]]  — an empty movie list makes a Wild Card slot.
const WILD = ['Wild Card', 'slate', []];

const HALLOWEEN = [
  ['Light Halloween Fun', 'pumpkin', [
    ['Beetlejuice', 1988], ['The Addams Family', 1991], ['Hocus Pocus', 1993], ['Sleepy Hollow', 1999],
    ['The Witches', 1990], ['The Lost Boys', 1987], ['Fright Night', 1985], ['The Fog', 1980],
    ['The Monster Squad', 1987], ['Gremlins', 1984], ['The Frighteners', 1996], ['Something Wicked This Way Comes', 1983],
  ]],
  ['Slasher / Monsters', 'crimson', [
    ['The Evil Dead', 1981], ['Evil Dead II', 1987], ['The Texas Chain Saw Massacre', 1974], ['The Autopsy of Jane Doe', 2016],
    ['The Mist', 2007], ['Scream', 1996], ['Barbarian', 2022], ['Ready or Not', 2019],
    ['The Cabin in the Woods', 2011], ['Saw', 2004], ['Slither', 2006], ['The Blob', 1988],
  ]],
  ['Sleep with the Lights On', 'indigo', [
    ['The Conjuring', 2013], ['The Ring', 2002], ['Sinister', 2012], ['Hereditary', 2018],
    ['The Strangers', 2008], ['The Exorcist', 1973], ['A Nightmare on Elm Street', 1984], ['Poltergeist', 1982],
    ['It Follows', 2014], ['The Witch', 2015], ['Insidious', 2010], ['Host', 2020],
  ]],
  ['Weird / Campy', 'violet', [
    ['The Faculty', 1998], ['What We Do in the Shadows', 2014], ['Killer Klowns from Outer Space', 1988], ['Elvira: Mistress of the Dark', 1988],
    ['Death Becomes Her', 1992], ['House', 1977], ['Little Shop of Horrors', 1986], ['The Return of the Living Dead', 1985],
    ['Army of Darkness', 1992], ['Tremors', 1990], ['Dead Alive', 1992], ['Creepshow', 1982],
  ]],
  ['Suspense / Thriller', 'teal', [
    ['The Sixth Sense', 1999], ['The Others', 2001], ['The Village', 2004], ['The Shining', 1980],
    ['The House of the Devil', 2009], ['The Invitation', 2015], ['10 Cloverfield Lane', 2016], ['The Changeling', 1980],
    ['The Night House', 2020], ["The Blackcoat's Daughter", 2015], ['The Omen', 1976], ['The Skeleton Key', 2005],
  ]],
  WILD,
];

const CHRISTMAS = [
  ['Certified Classics', 'crimson', [
    ["It's a Wonderful Life", 1946], ['Miracle on 34th Street', 1947], ['Holiday Inn', 1942], ['White Christmas', 1954],
    ['A Christmas Story', 1983], ['A Christmas Carol', 1984], ['Scrooged', 1988], ["National Lampoon's Christmas Vacation", 1989],
    ['Home Alone', 1990], ['Home Alone 2: Lost in New York', 1992], ['Jingle All the Way', 1996], ['Elf', 2003],
  ]],
  ['Holiday Horror', 'violet', [
    ['Black Christmas', 1974], ['Christmas Evil', 1980], ['Gremlins', 1984], ['Silent Night, Deadly Night', 1984],
    ["Santa's Slay", 2005], ['Rare Exports', 2010], ['Krampus', 2015], ['A Christmas Horror Story', 2015],
    ['Better Watch Out', 2016], ['Anna and the Apocalypse', 2017], ['The Lodge', 2019], ['Silent Night', 2021],
  ]],
  ['Hold Onto Your Sleigh!', 'indigo', [
    ['Lethal Weapon', 1987], ['Die Hard', 1988], ['Die Hard 2', 1990], ['Batman Returns', 1992],
    ['The Long Kiss Goodnight', 1996], ['Reindeer Games', 2000], ['Kiss Kiss Bang Bang', 2005], ['Iron Man 3', 2013],
    ['Fatman', 2020], ['Violent Night', 2022], ['Red One', 2024], ['Carry-On', 2024],
  ]],
  ['Mistletoe & Meet-Cutes', 'pumpkin', [
    ['The Shop Around the Corner', 1940], ['While You Were Sleeping', 1995], ['Serendipity', 2001], ["Bridget Jones's Diary", 2001],
    ['Love Actually', 2003], ['The Family Stone', 2005], ['The Holiday', 2006], ['Four Christmases', 2008],
    ['The Princess Switch', 2018], ['Last Christmas', 2019], ['Happiest Season', 2020], ['Single All the Way', 2021],
  ]],
  ['North Pole Magic', 'moss', [
    ['Rudolph the Red-Nosed Reindeer', 1964], ['A Charlie Brown Christmas', 1965], ['How the Grinch Stole Christmas!', 1966], ['Frosty the Snowman', 1969],
    ['The Year Without a Santa Claus', 1974], ['Santa Claus: The Movie', 1985], ['The Nightmare Before Christmas', 1993], ['The Santa Clause', 1994],
    ['The Polar Express', 2004], ['Arthur Christmas', 2011], ['The Christmas Chronicles', 2018], ['Klaus', 2019],
  ]],
  WILD,
];

const AWARDS = [
  ['Best Picture Winners', 'gold', [
    ['Casablanca', 1942], ['All About Eve', 1950], ['Lawrence of Arabia', 1962], ['The Godfather', 1972],
    ['Rocky', 1976], ['Amadeus', 1984], ['The Silence of the Lambs', 1991], ["Schindler's List", 1993],
    ['Titanic', 1997], ['No Country for Old Men', 2007], ['Parasite', 2019], ['Oppenheimer', 2023],
  ]],
  ['Robbed!', 'crimson', [
    ['Citizen Kane', 1941], ["It's a Wonderful Life", 1946], ['12 Angry Men', 1957], ['Dr. Strangelove', 1964],
    ['Jaws', 1975], ['Taxi Driver', 1976], ['Raging Bull', 1980], ['E.T. the Extra-Terrestrial', 1982],
    ['Pulp Fiction', 1994], ['The Shawshank Redemption', 1994], ['Saving Private Ryan', 1998], ['The Social Network', 2010],
  ]],
  ['Acting Showcases', 'violet', [
    ['A Streetcar Named Desire', 1951], ['Network', 1976], ['Misery', 1990], ['Fargo', 1996],
    ['Erin Brockovich', 2000], ['Monster', 2003], ['There Will Be Blood', 2007], ['The Dark Knight', 2008],
    ['Black Swan', 2010], ['Whiplash', 2014], ['Three Billboards Outside Ebbing, Missouri', 2017], ['Joker', 2019],
  ]],
  ['Before They Were Famous', 'teal', [
    ['Rebel Without a Cause', 1955], ['Paper Moon', 1973], ["What's Eating Gilbert Grape", 1993], ['Good Will Hunting', 1997],
    ['The Sixth Sense', 1999], ['Little Miss Sunshine', 2006], ['Juno', 2007], ["Winter's Bone", 2010],
    ['True Grit', 2010], ['Beasts of the Southern Wild', 2012], ['Manchester by the Sea', 2016], ['Lady Bird', 2017],
  ]],
  ["The Director's Chair", 'indigo', [
    ['Rear Window', 1954], ['Psycho', 1960], ['The Graduate', 1967], ['Cabaret', 1972],
    ['Apocalypse Now', 1979], ['Reds', 1981], ['Blue Velvet', 1986], ['Goodfellas', 1990],
    ['Brokeback Mountain', 2005], ['Gravity', 2013], ['The Revenant', 2015], ['The Power of the Dog', 2021],
  ]],
  WILD,
];

export const BUILT_IN_FESTIVALS = [
  { id: 'halloween', name: 'Halloween', icon: 'skull', themeSet: 'halloween', categoryDie: 6, movieDie: 12, categories: HALLOWEEN },
  { id: 'christmas', name: 'Christmas', icon: 'tree', themeSet: 'christmas', categoryDie: 6, movieDie: 12, categories: CHRISTMAS },
  { id: 'awards', name: 'Awards Season', icon: 'trophy', themeSet: 'awards', categoryDie: 6, movieDie: 12, categories: AWARDS },
];

export function makeCategory(name, color, die, movies = []) {
  return {
    id: uid(),
    name,
    color,
    die,
    slots: Array.from({ length: die }, (_, i) => (movies[i] ? makeMovie(movies[i][0], movies[i][1]) : null)),
  };
}

// Fresh copy of a built-in festival's tables.
export function builtInCategories(def) {
  return def.categories.map(([name, color, movies]) => makeCategory(name, color, def.movieDie, movies));
}

export function buildBuiltInFestival(def) {
  return {
    id: def.id,
    name: def.name,
    builtIn: true,
    icon: def.icon,
    themeSet: def.themeSet,
    theme: null, // null = first theme in the set
    mode: 'two',
    categoryDie: def.categoryDie,
    freshSince: null,
    categories: builtInCategories(def),
  };
}

export function buildDefaultState() {
  return {
    version: 2,
    settings: { diceMode: 'virtual', slotMode: 'keep' },
    activeFestival: 'halloween',
    festivals: BUILT_IN_FESTIVALS.map(buildBuiltInFestival),
    history: [],
  };
}
