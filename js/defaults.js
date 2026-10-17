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
export const RATING_ICONS = ['skull', 'tree', 'trophy', 'star', 'popcorn', 'heart', 'ghost', 'snowflake', 'balloon', 'hourglass'];

export function uid() {
  if (globalThis.crypto && crypto.randomUUID) return crypto.randomUUID();
  return 'id-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
}

// A movie in a table slot. catalogId will link to data/catalog.json later (sequels).
export function makeMovie(title, year, catalogId = null) {
  return { id: uid(), title, year: year || null, catalogId };
}

// [name, color, [[title, year], ...], die?]  — an empty movie list makes a Wild Card slot.
// die is optional; without it the category uses the festival's movieDie.
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

const KIDS = [
  ["Disney Animation", 'crimson', [
    ["Snow White and the Seven Dwarfs", 1937], ["Pinocchio", 1940], ["Dumbo", 1941], ["Cinderella", 1950],
    ["Alice in Wonderland", 1951], ["Peter Pan", 1953], ["Lady and the Tramp", 1955], ["One Hundred and One Dalmatians", 1961],
    ["The Jungle Book", 1967], ["The Little Mermaid", 1989], ["Beauty and the Beast", 1991], ["Aladdin", 1992],
    ["The Lion King", 1994], ["Mulan", 1998], ["Lilo & Stitch", 2002], ["Tangled", 2010],
    ["Frozen", 2013], ["Zootopia", 2016], ["Moana", 2016], ["Encanto", 2021],
  ], 20],
  ["Pixar Picks", 'indigo', [
    ["Toy Story", 1995], ["Monsters, Inc.", 2001], ["Finding Nemo", 2003], ["The Incredibles", 2004],
    ["Cars", 2006], ["Ratatouille", 2007], ["WALL·E", 2008], ["Up", 2009],
    ["Inside Out", 2015], ["Coco", 2017], ["Soul", 2020], ["Luca", 2021],
  ], 12],
  ["More Animation", 'pumpkin', [
    ["The Land Before Time", 1988], ["The Nightmare Before Christmas", 1993], ["The Prince of Egypt", 1998], ["The Iron Giant", 1999],
    ["Chicken Run", 2000], ["Shrek", 2001], ["Madagascar", 2005], ["Wallace & Gromit: The Curse of the Were-Rabbit", 2005],
    ["Kung Fu Panda", 2008], ["Coraline", 2009], ["Cloudy with a Chance of Meatballs", 2009], ["How to Train Your Dragon", 2010],
    ["Despicable Me", 2010], ["Megamind", 2010], ["The Adventures of Tintin", 2011], ["Hotel Transylvania", 2012],
    ["The Lego Movie", 2014], ["The Secret Life of Pets", 2016], ["Sing", 2016], ["The Wild Robot", 2024],
  ], 20],
  ["Ghibli & Beyond", 'teal', [
    ["Castle in the Sky", 1986], ["My Neighbor Totoro", 1988], ["Kiki's Delivery Service", 1989], ["Spirited Away", 2001],
    ["Howl's Moving Castle", 2004], ["Ponyo", 2008], ["The Secret World of Arrietty", 2010], ["Klaus", 2019],
  ], 8],
  ["Timeless Classics", 'gold', [
    ["The Wizard of Oz", 1939], ["The Parent Trap", 1961], ["Mary Poppins", 1964], ["The Sound of Music", 1965],
    ["Willy Wonka & the Chocolate Factory", 1971], ["E.T. the Extra-Terrestrial", 1982], ["The Karate Kid", 1984], ["The NeverEnding Story", 1984],
    ["Back to the Future", 1985], ["The Goonies", 1985], ["Labyrinth", 1986], ["The Princess Bride", 1987],
    ["Beetlejuice", 1988], ["Home Alone", 1990], ["The Addams Family", 1991], ["Jurassic Park", 1993],
    ["The Sandlot", 1993], ["Cool Runnings", 1993], ["Babe", 1995], ["Jumanji", 1995],
  ], 20],
  ["Big Adventures", 'moss', [
    ["Matilda", 1996], ["The Parent Trap", 1998], ["Stuart Little", 1999], ["Spy Kids", 2001],
    ["Harry Potter and the Sorcerer's Stone", 2001], ["The Princess Diaries", 2001], ["Holes", 2003], ["Charlie and the Chocolate Factory", 2005],
    ["Zathura: A Space Adventure", 2005], ["The Chronicles of Narnia: The Lion, the Witch and the Wardrobe", 2005], ["Night at the Museum", 2006], ["Bridge to Terabithia", 2007],
    ["Enchanted", 2007], ["Percy Jackson & the Olympians: The Lightning Thief", 2010], ["Hugo", 2011], ["The Muppets", 2011],
    ["The Secret Life of Walter Mitty", 2013], ["Paddington", 2014], ["Teenage Mutant Ninja Turtles", 2014], ["The Greatest Showman", 2017],
  ], 20],
];

// Ranked by Time Out's 100 best movies of all time (2026). Each table is 20 ranks, in order.
const BUCKET_LIST = [
  ["The Summit (1–20)", 'gold', [
    ["2001: A Space Odyssey", 1968], ["The Godfather", 1972], ["Citizen Kane", 1941], ["Jeanne Dielman, 23, quai du Commerce, 1080 Bruxelles", 1975],
    ["Raiders of the Lost Ark", 1981], ["La Dolce Vita", 1960], ["Seven Samurai", 1954], ["In the Mood for Love", 2000],
    ["There Will Be Blood", 2007], ["Singin' in the Rain", 1952], ["GoodFellas", 1990], ["North by Northwest", 1959],
    ["Mulholland Drive", 2001], ["Bicycle Thieves", 1948], ["The Dark Knight", 2008], ["City Lights", 1931],
    ["Grand Illusion", 1937], ["His Girl Friday", 1940], ["The Red Shoes", 1948], ["Vertigo", 1958],
  ], 20],
  ["The Canon (21–40)", 'crimson', [
    ["Beau Travail", 1999], ["The Searchers", 1956], ["Persona", 1966], ["Do the Right Thing", 1989],
    ["Rashomon", 1950], ["The Rules of the Game", 1939], ["Jaws", 1975], ["Double Indemnity", 1944],
    ["The 400 Blows", 1959], ["Star Wars: Episode IV - A New Hope", 1977], ["The Passion of Joan of Arc", 1928], ["Once Upon a Time in the West", 1968],
    ["Alien", 1979], ["Tokyo Story", 1953], ["Pulp Fiction", 1994], ["The Truman Show", 1998],
    ["Lawrence of Arabia", 1962], ["Psycho", 1960], ["Sansho the Bailiff", 1954], ["Andrei Rublev", 1966],
  ], 20],
  ["Essentials (41–60)", 'indigo', [
    ["The Umbrellas of Cherbourg", 1964], ["Chinatown", 1974], ["The Seventh Seal", 1957], ["Lost in Translation", 2003],
    ["Taxi Driver", 1976], ["Spirited Away", 2001], ["Night of the Living Dead", 1968], ["Battleship Potemkin", 1925],
    ["Modern Times", 1936], ["Breathless", 1960], ["Dr. Strangelove or: How I Learned to Stop Worrying and Love the Bomb", 1964], ["M", 1931],
    ["Blade Runner", 1982], ["The Bitter Tears of Petra von Kant", 1972], ["Rome, Open City", 1945], ["Nosferatu", 1922],
    ["Airplane!", 1980], ["Mad Max: Fury Road", 2015], ["Apocalypse Now", 1979], ["Brokeback Mountain", 2005],
  ], 20],
  ["Deep Cuts (61–80)", 'teal', [
    ["Duck Soup", 1933], ["The Blair Witch Project", 1999], ["All the President's Men", 1976], ["Pather Panchali", 1955],
    ["Eternal Sunshine of the Spotless Mind", 2004], ["The General", 1926], ["The Texas Chain Saw Massacre", 1974], ["Come and See", 1985],
    ["Heat", 1995], ["The Shining", 1980], ["Toy Story", 1995], ["Killer of Sheep", 1978],
    ["A Woman Under the Influence", 1974], ["Annie Hall", 1977], ["Some Like It Hot", 1959], ["Metropolis", 1927],
    ["The Maltese Falcon", 1941], ["This Is Spinal Tap", 1984], ["It Happened One Night", 1934], ["Die Hard", 1988],
  ], 20],
  ["The Last Reel (81–100)", 'violet', [
    ["The Conformist", 1970], ["The Thing", 1982], ["The Zone of Interest", 2023], ["Daughters of the Dust", 1991],
    ["Barry Lyndon", 1975], ["Raging Bull", 1980], ["Se7en", 1995], ["Aguirre, the Wrath of God", 1972],
    ["The Battle of Algiers", 1966], ["No Country for Old Men", 2007], ["Women on the Verge of a Nervous Breakdown", 1988], ["The Discreet Charm of the Bourgeoisie", 1972],
    ["Paths of Glory", 1957], ["Secrets & Lies", 1996], ["Sweet Smell of Success", 1957], ["The Cabinet of Dr. Caligari", 1920],
    ["Nashville", 1975], ["Don't Look Now", 1973], ["Bonnie and Clyde", 1967], ["Get Out", 2017],
  ], 20],
  ['Wild Card', 'slate', [], 20],
];

export const BUILT_IN_FESTIVALS = [
  { id: 'halloween', name: 'Halloween', icon: 'skull', themeSet: 'halloween', categoryDie: 6, movieDie: 12, categories: HALLOWEEN },
  { id: 'christmas', name: 'Christmas', icon: 'tree', themeSet: 'christmas', categoryDie: 6, movieDie: 12, categories: CHRISTMAS },
  { id: 'awards', name: 'Awards Season', icon: 'trophy', themeSet: 'awards', categoryDie: 6, movieDie: 12, categories: AWARDS },
  { id: 'kids', name: 'Kids & Family', icon: 'balloon', themeSet: 'kids', categoryDie: 6, movieDie: 20, categories: KIDS },
  { id: 'bucketlist', name: 'Bucket List Cinema', icon: 'hourglass', themeSet: 'bucketlist', categoryDie: 6, movieDie: 20, categories: BUCKET_LIST },
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
  return def.categories.map(([name, color, movies, die]) => makeCategory(name, color, die || def.movieDie, movies));
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
    version: 3,
    settings: { diceMode: 'virtual', diceStyle: 'flat', slotMode: 'keep', sequels: true, tutorialSeen: false },
    activeFestival: 'halloween',
    festivals: BUILT_IN_FESTIVALS.map(buildBuiltInFestival),
    history: [],
  };
}
