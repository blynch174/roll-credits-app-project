// Suggests Roll Credits moods for a movie from its TMDB keywords, genres, and summary. Used when admins add or
// approve a movie: the suggestions come pre-selected, and the admin can change them.

// mood -> words that point to it (matched against keywords, genres, and the overview, all lowercase)
const RULES = {
  Adventurous: ['adventure', 'quest', 'treasure', 'journey', 'expedition', 'explorer', 'road trip', 'swashbuckler', 'jungle'],
  Atmospheric: ['atmospheric', 'fog', 'isolation', 'remote', 'small town', 'rural', 'haunted house', 'night', 'dread'],
  Bittersweet: ['bittersweet', 'coming of age', 'nostalgia', 'first love', 'growing up', 'loss of innocence', 'farewell'],
  Brutal: ['gore', 'brutality', 'torture', 'massacre', 'splatter', 'violence', 'revenge', 'bloody'],
  'Character-Driven': ['character study', 'drama', 'friendship', 'loneliness', 'midlife crisis', 'relationship', 'independent film'],
  Cinematic: ['epic', 'historical', 'war', 'spectacle', 'biography', 'period piece', 'desert', 'based on true story'],
  Cozy: ['cozy', 'small town', 'bakery', 'family holiday', 'christmas', 'snow', 'heartwarming', 'feel-good'],
  'Creature-driven': ['monster', 'creature', 'giant monster', 'alien', 'shark', 'dinosaur', 'werewolf', 'kaiju', 'mutant'],
  Dark: ['dark', 'serial killer', 'murder', 'crime', 'corruption', 'drug', 'noir', 'neo-noir', 'psychopath'],
  'Darkly Comic': ['dark comedy', 'black comedy', 'satire', 'absurd', 'horror comedy', 'parody'],
  Dramatic: ['drama', 'family drama', 'courtroom', 'melodrama', 'tragedy'],
  Energetic: ['action', 'dance', 'music', 'sports', 'heist', 'car chase', 'party', 'competition'],
  Festive: ['christmas', 'holiday', 'santa claus', 'new year', 'thanksgiving', 'halloween', 'christmas party'],
  Gothic: ['gothic', 'vampire', 'castle', 'victorian', 'dracula', 'frankenstein', 'mansion'],
  Grim: ['post-apocalyptic', 'dystopia', 'war crimes', 'despair', 'bleak', 'survival'],
  Heartbreaking: ['tearjerker', 'terminal illness', 'cancer', 'grief', 'death of', 'dying', 'loss of loved one', 'tragic'],
  Kinetic: ['martial arts', 'shootout', 'car chase', 'fight', 'chase', 'one man army', 'hand to hand combat'],
  Macabre: ['macabre', 'corpse', 'cemetery', 'skeleton', 'grave', 'body horror', 'zombie', 'cannibal'],
  Nostalgic: ['nostalgia', '1950s', '1960s', '1970s', '1980s', '1990s', 'coming of age', 'summer'],
  Otherworldly: ['fantasy', 'magic', 'space', 'alien', 'parallel world', 'fairy tale', 'science fiction', 'dream'],
  Playful: ['comedy', 'slapstick', 'family', 'animation', 'talking animal', 'spoof', 'buddy'],
  Reflective: ['philosophy', 'existentialism', 'meaning of life', 'memory', 'regret', 'aging', 'introspection'],
  Romantic: ['romance', 'love', 'romantic comedy', 'wedding', 'love triangle', 'falling in love', 'first love'],
  'Self-aware': ['meta', 'parody', 'spoof', 'breaking the fourth wall', 'mockumentary', 'satire'],
  Sentimental: ['sentimental', 'heartwarming', 'family relationships', 'father son relationship', 'mother daughter relationship', 'pet', 'dog'],
  Somber: ['somber', 'grief', 'depression', 'mourning', 'holocaust', 'suicide', 'war'],
  Supernatural: ['supernatural', 'ghost', 'demon', 'possession', 'witch', 'curse', 'exorcism', 'paranormal'],
  Suspenseful: ['suspense', 'mystery', 'whodunit', 'investigation', 'conspiracy', 'thriller', 'hostage'],
  Tense: ['tension', 'thriller', 'hostage', 'kidnapping', 'stalker', 'home invasion', 'trapped', 'escape'],
  Unsettling: ['psychological horror', 'disturbing', 'paranoia', 'cult', 'nightmare', 'horror', 'creepy', 'insanity'],
  Warm: ['heartwarming', 'friendship', 'family', 'kindness', 'community', 'feel-good', 'found family'],
  Whimsical: ['whimsical', 'fairy tale', 'magic', 'talking animal', 'imagination', 'toy', 'animation', 'musical'],
  Witty: ['witty', 'screwball comedy', 'banter', 'comedy of manners', 'satire', 'romantic comedy', 'comedy'],
};

// Strong words in keywords/genres count more than words found in the summary.
export function suggestMoods(movie, available = Object.keys(RULES), max = 4) {
  if (!movie) return [];
  const tags = [...(movie.keywords || []), ...(movie.genres || [])].map((x) => String(x).toLowerCase());
  const text = String(movie.overview || '').toLowerCase();
  const scores = [];
  for (const mood of available) {
    const words = RULES[mood];
    if (!words) continue;
    let score = 0;
    for (const w of words) {
      if (tags.some((t) => t === w)) score += 3;
      else if (tags.some((t) => t.includes(w))) score += 2;
      else if (text.includes(w)) score += 1;
    }
    if (score >= 2) scores.push([score, mood]);
  }
  scores.sort((a, b) => b[0] - a[0]);
  return scores.slice(0, max).map((x) => x[1]);
}
