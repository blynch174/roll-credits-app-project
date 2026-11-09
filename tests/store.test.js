// Saved data (js/store.js): first launch, upgrades from old versions, repairing bad imports,
// and the table/history actions behind the main screens.

import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import * as store from '../js/store.js';
import { STARTER_FESTIVALS } from '../js/defaults.js';

const KEY = 'roll-credits:data';

beforeEach(() => {
  localStorage.clear();
  store.load(); // fresh install every test
});

const halloween = () => store.festival('halloween');
const firstFilled = (f) => {
  for (const cat of f.categories) {
    const index = cat.slots.findIndex(Boolean);
    if (index !== -1) return { cat, index, movie: cat.slots[index] };
  }
  throw new Error('no filled slot');
};

// ---------- First launch and saving ----------

test('a fresh install starts with the starter festivals and saves them', () => {
  const s = store.getState();
  assert.deepEqual(s.festivals.map((f) => f.id), STARTER_FESTIVALS);
  assert.equal(s.version, 3);
  assert.equal(s.history.length, 0);
  assert.ok(store.isPristine());
  assert.ok(JSON.parse(localStorage.getItem(KEY)).festivals.length > 0, 'state was written to storage');
});

test('every starter festival has one category per face of its category die', () => {
  for (const f of store.festivals()) {
    assert.equal(f.categories.length, f.categoryDie, f.id);
    for (const c of f.categories) assert.equal(c.slots.length, c.die, `${f.id} / ${c.name}`);
  }
});

test('saved data survives a reload', () => {
  const { cat, index } = firstFilled(halloween());
  store.setSlot('halloween', cat.id, index, { title: 'Totally New Movie', year: 2024 });
  store.load();
  assert.equal(store.category(halloween(), cat.id).slots[index].title, 'Totally New Movie');
});

// ---------- Upgrades ----------

test('version 1 data (one Halloween menu) upgrades to the current format', () => {
  const v1 = {
    version: 1,
    activeMenu: 'm1',
    settings: { diceMode: 'physical', slotMode: 'keep' },
    menus: [{ id: 'm1', categories: [{ id: 'c1', name: 'Slashers', color: 'crimson', slots: [{ id: 'x', title: 'Halloween', year: 1978 }] }] }],
    season: { watched: [{ id: 'w1', categoryId: 'c1', categoryName: 'Slashers', movieId: 'x', title: 'Halloween', year: 1978, slotIndex: 0, date: '2025-10-31T20:00:00Z', rating: 5 }] },
  };
  localStorage.setItem(KEY, JSON.stringify(v1));
  const s = store.load();
  assert.equal(s.version, 3);
  assert.equal(s.settings.diceMode, 'physical');
  assert.equal(s.settings.sequels, true, 'v3 turned sequels on');
  assert.equal(s.settings.tutorialSeen, true, 'existing users skip the tour');
  const h = s.festivals.find((f) => f.id === 'halloween');
  assert.equal(h.categories[0].name, 'Slashers');
  assert.equal(h.categories[0].slots.length, 12);
  assert.equal(s.history[0].title, 'Halloween');
  assert.ok(store.isSeen(h, h.categories[0].slots[0]), 'the watched movie still shows as Seen');
});

test('retired theme ids move to their replacement', () => {
  const s = store.getState();
  s.settings.theme = 'bloodmoon';
  localStorage.setItem(KEY, JSON.stringify(s));
  assert.equal(store.load().settings.theme, 'grindhouse');
});

// ---------- Imports and repairs ----------

test('importJSON rejects text that is not Roll Credits data', () => {
  assert.equal(store.importJSON('not json'), false);
  assert.equal(store.importJSON('{"hello": "world"}'), false);
  assert.equal(store.importJSON(JSON.stringify({ version: 3, festivals: 'nope', history: [], settings: {} })), false);
  assert.deepEqual(store.festivals().map((f) => f.id), STARTER_FESTIVALS, 'a rejected import changes nothing');
});

test('importJSON drops broken entries and trims oversized text', () => {
  const d = JSON.parse(store.exportJSON());
  d.history = [
    { id: 'ok', title: 'Good Entry', date: '2026-10-01T00:00:00Z', rating: 99, notes: 'x'.repeat(10000) },
    { id: 'no-date', title: 'Broken' },
    'garbage',
  ];
  d.festivals[0].name = 'N'.repeat(1000);
  assert.equal(store.importJSON(JSON.stringify(d)), true);
  const s = store.getState();
  assert.deepEqual(s.history.map((e) => e.id), ['ok']);
  assert.equal(s.history[0].rating, 5, 'ratings are clamped to 0-5');
  assert.equal(s.history[0].notes.length, 4000);
  assert.equal(s.festivals[0].name.length, 300);
});

test('an import with no festivals gets the starter set back', () => {
  const d = JSON.parse(store.exportJSON());
  d.festivals = [];
  store.importJSON(JSON.stringify(d));
  assert.deepEqual(store.festivals().map((f) => f.id), STARTER_FESTIVALS);
});

// ---------- Watching and history ----------

test('watching a movie logs it and marks it Seen; Start fresh clears the mark but keeps history', () => {
  const { cat, index, movie } = firstFilled(halloween());
  const e = store.watchMovie('halloween', cat.id, index);
  assert.equal(e.title, movie.title);
  assert.equal(store.getState().history[0].id, e.id);
  assert.ok(store.isSeen(halloween(), movie));

  // Watched an hour ago (a watch and Start fresh in the same millisecond can't happen in real use).
  store.getState().history[0].date = new Date(Date.now() - 3600_000).toISOString();
  store.startFresh('halloween');
  assert.ok(!store.isSeen(halloween(), store.category(halloween(), cat.id).slots[index]));
  assert.equal(store.getState().history.length, 1);
});

test('"replace" slot mode empties the slot after watching', () => {
  store.setSetting('slotMode', 'replace');
  const { cat, index } = firstFilled(halloween());
  store.watchMovie('halloween', cat.id, index);
  assert.equal(store.category(halloween(), cat.id).slots[index], null);
});

test('removing a history entry as "hated" also clears its slot', () => {
  const { cat, index } = firstFilled(halloween());
  const e = store.watchMovie('halloween', cat.id, index);
  const msg = store.removeEntry(e.id, 'hated');
  assert.match(msg, /gone for good/);
  assert.equal(store.category(halloween(), cat.id).slots[index], null);
  assert.equal(store.getState().history.length, 0);
});

test('removing an entry as "mistake" puts the movie back in its empty slot', () => {
  store.setSetting('slotMode', 'replace');
  const { cat, index, movie } = firstFilled(halloween());
  const e = store.watchMovie('halloween', cat.id, index);
  const msg = store.removeEntry(e.id, 'mistake');
  assert.match(msg, /back in its slot/);
  assert.equal(store.category(halloween(), cat.id).slots[index].title, movie.title);
});

test('removing an entry as "unfinished" keeps its notes on the movie', () => {
  const { cat, index } = firstFilled(halloween());
  const e = store.watchMovie('halloween', cat.id, index);
  store.updateEntry(e.id, { notes: 'Stopped at the cabin scene' });
  store.removeEntry(e.id, 'unfinished');
  assert.equal(store.category(halloween(), cat.id).slots[index].note, 'Stopped at the cabin scene');
});

// ---------- Editing tables ----------

test('shrinking a category die reports and drops the movies past the new size', () => {
  const cat = halloween().categories[0];
  const filledPast6 = cat.slots.slice(6).filter(Boolean).length;
  assert.equal(store.categoryDieLoss(cat, 6), filledPast6);
  store.setCategoryDie('halloween', cat.id, 6);
  const after = store.category(halloween(), cat.id);
  assert.equal(after.die, 6);
  assert.equal(after.slots.length, 6);
});

test('setSlot ignores blank titles and impossible years', () => {
  const cat = halloween().categories[0];
  const before = JSON.stringify(cat.slots[0]);
  store.setSlot('halloween', cat.id, 0, { title: '   ', year: 2000 });
  assert.equal(JSON.stringify(store.category(halloween(), cat.id).slots[0]), before);
  store.setSlot('halloween', cat.id, 0, { title: 'Some Movie', year: 99999 });
  assert.equal(store.category(halloween(), cat.id).slots[0].year, null);
});

test('shuffle keeps the same movies in a category', () => {
  const cat = halloween().categories[0];
  const titles = (c) => c.slots.map((m) => (m ? m.title : '')).sort();
  const before = titles(cat);
  store.shuffleCategory('halloween', cat.id, (min, max) => min + Math.floor(Math.random() * (max - min + 1)));
  assert.deepEqual(titles(store.category(halloween(), cat.id)), before);
});

// ---------- Custom festivals and Saved for Later ----------

test('free users can make up to 3 custom festivals; admins are not limited', () => {
  const opts = (n) => ({ name: `Mine ${n}`, icon: 'star', mode: 'two', categoryDie: 4, movieDie: 6 });
  for (let i = 0; i < store.CUSTOM_FESTIVAL_LIMIT; i++) {
    assert.ok(store.canCreateFestival());
    store.createFestival(opts(i));
  }
  assert.ok(!store.canCreateFestival());
  assert.ok(store.canCreateFestival(true));
  const f = store.activeFestival();
  assert.equal(f.name, 'Mine 2');
  assert.equal(f.categories.length, 4);
  assert.ok(f.categories.every((c) => c.slots.length === 6));
});

test('Saved for Later holds at most 3 movies and no duplicates', () => {
  const movie = (n) => ({ id: 'm' + n, title: 'Movie ' + n, releaseYear: 2000 + n });
  assert.ok(store.savePick(movie(1)));
  assert.ok(!store.savePick(movie(1)), 'no duplicates');
  assert.ok(store.savePick(movie(2)));
  assert.ok(store.savePick(movie(3)));
  assert.ok(!store.savePick(movie(4)), 'full at 3');
  assert.equal(store.savedPicks().length, 3);
});
