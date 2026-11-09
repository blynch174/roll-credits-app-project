// The movie catalog (js/catalog.js), loaded from the real data/all_movies.json.

import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import * as catalog from '../js/catalog.js';
import { suggestMoods } from '../js/moodmatch.js';

before(async () => {
  await catalog.load();
  assert.ok(catalog.isReady(), 'catalog loaded');
});

test('norm ignores case, accents, punctuation, "&", and a leading article', () => {
  assert.equal(catalog.norm('The Evil Dead'), 'evildead');
  assert.equal(catalog.norm('Amélie'), 'amelie');
  assert.equal(catalog.norm('Bill & Ted’s Excellent Adventure'), 'billandtedsexcellentadventure');
  assert.equal(catalog.norm('A Nightmare on Elm Street'), 'nightmareonelmstreet');
  assert.equal(catalog.norm(null), '');
});

test('match finds a movie by title and year, despite spelling differences', () => {
  const m = catalog.match('the cabinet of dr. caligari', 1920);
  assert.ok(m);
  assert.equal(m.id, 'the-cabinet-of-dr-caligari-1920');
  assert.equal(catalog.match('The Cabinet of Dr. Caligari', 1921), null, 'the year has to match');
});

test('every catalog movie can be found again by its own title and year', () => {
  const misses = catalog.all().filter((m) => !catalog.match(m.title, m.releaseYear));
  assert.deepEqual(misses.map((m) => m.id), []);
});

test('search puts an exact title first', () => {
  const [top] = catalog.search('Halloween 1978', null);
  assert.ok(top, 'got results');
  assert.equal(top.title, 'Halloween');
  assert.equal(top.releaseYear, 1978);
  assert.deepEqual(catalog.search('a', null), [], 'one-letter queries return nothing');
});

test('nextInFranchise skips movies that are not open', () => {
  const withSequel = catalog.all().find((m) => m.franchise && catalog.nextInFranchise(m.id, () => true));
  assert.ok(withSequel, 'catalog has at least one franchise with a later entry');
  const next = catalog.nextInFranchise(withSequel.id, () => true);
  assert.equal(next.franchise, withSequel.franchise);
  assert.ok((next.seriesOrder || 0) > (withSequel.seriesOrder || 0));
  const skipped = catalog.nextInFranchise(withSequel.id, (x) => x.id !== next.id);
  assert.notEqual(skipped && skipped.id, next.id);
});

test('suggestMoods weights keywords over the summary and caps the list', () => {
  const moods = suggestMoods({ keywords: ['haunted house', 'ghost', 'possession'], genres: ['Horror'], overview: 'A family moves in.' });
  assert.ok(moods.includes('Supernatural'));
  assert.ok(moods.length <= 4);
  assert.deepEqual(suggestMoods(null), []);
  assert.deepEqual(suggestMoods({ keywords: [], genres: [], overview: '' }), []);
});
