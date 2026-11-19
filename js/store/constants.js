// Fixed ids, names, and limits shared by the store modules and the screens.

// Watch history entries that aren't tied to a festival table.
export const OFF_MENU = 'off-menu'; // category id for a logged movie that isn't on the festival's tables
export const NO_FEST = 'none'; // logged with no festival at all
export const NO_FEST_NAME = 'No Festival';
export const NO_FEST_ICON = 'star';
export const POPCORN = 'popcorn'; // Popcorn Pick: a random catalog movie, its own group in the history
export const POPCORN_NAME = 'Popcorn Pick';

// Save for Later (Popcorn Pick) keeps this many movies.
export const SAVED_MAX = 3;

// Free accounts get a few festivals of their own (official ones don't count). Admins aren't limited.
// Only checked in the app: when paid plans exist this needs enforcing on the server too.
export const CUSTOM_FESTIVAL_LIMIT = 3;
