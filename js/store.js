// The app's data, and every change to it. Screens import from here and re-render after a change.
//
// This file only gathers the store's parts into one place, so each screen needs a single import:
//   store/state.js      the saved data: loading and saving, the account's copy, settings, undo, backups
//   store/migrate.js    checking and upgrading saved data from older versions or other sources
//   store/festivals.js  festivals and their tables, dice, official festivals, the Festival Library
//   store/history.js    the watch history, logging, Popcorn Picks, Save for Later
//   store/constants.js  fixed ids, names, and limits

// Saved data: load and save, the account copy, settings, drafts, undo, backups (store/state.js)
export {
  load,
  save,
  onSave,
  replaceState,
  mergeIn,
  backupBeforeSync,
  syncBackup,
  restoreSyncBackup,
  isPristine,
  canSave,
  getState,
  setSetting,
  openDraft,
  closeDraft,
  currentDraft,
  snapshot,
  restore,
  exportJSON,
  importJSON,
  resetAll,
} from './store/state.js';

// Festivals and tables (store/festivals.js)
export {
  festivals,
  festival,
  activeFestival,
  editFestival,
  themeId,
  setActiveFestival,
  category,
  filledCount,
  isWild,
  isSeen,
  isCatalogSeen,
  onTables,
  openSlots,
  setSlot,
  linkCatalog,
  customMovies,
  addCustomMovie,
  stepToSequel,
  clearSlot,
  updateCategory,
  categoryDieLoss,
  setCategoryDie,
  shuffleCategory,
  clearCategory,
  festivalDiceLoss,
  setFestivalDice,
  updateFestivalLook,
  startFresh,
  restoreBuiltIn,
  isUntouched,
  applyOfficial,
  keepMine,
  clearAnnounce,
  reconcileOfficial,
  deleteFestival,
  removedOfficial,
  librarySeen,
  markLibrarySeen,
  restoreOfficialFestival,
  canCreateFestival,
  createFestival,
} from './store/festivals.js';

// Watch history (store/history.js)
export {
  watchMovie,
  entry,
  updateEntry,
  moveEntry,
  setEntryDate,
  removeEntry,
  findSlot,
  logMovie,
  addPopcornPick,
  savedPicks,
  isSaved,
  savePick,
  removeSaved,
  watchSaved,
  historyGroupName,
  clearHistory,
} from './store/history.js';

// Fixed ids, names, and limits (store/constants.js)
export {
  CUSTOM_FESTIVAL_LIMIT,
  NO_FEST,
  NO_FEST_ICON,
  NO_FEST_NAME,
  OFF_MENU,
  POPCORN,
  POPCORN_NAME,
  SAVED_MAX,
} from './store/constants.js';
