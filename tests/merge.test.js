// Multi-device sync (js/merge.js). Two phones edit offline, then sync: nothing either one did should be lost,
// and something deleted on one phone shouldn't come back from the other.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { emptySync, ensureSync, baselineOf, stamp, merge, sameData } from '../js/merge.js';

const DAY = 24 * 3600 * 1000;
const NOW = 1_800_000_000_000;

// A minimal saved state. `at` / `gone` fill in sync times for the item kinds used here.
function state({ festivals = [], history = [], savedPicks = [], settings = {}, at = {}, gone = {}, settingsAt = 0 } = {}) {
  const s = emptySync();
  Object.assign(s.at.f, at.f); Object.assign(s.at.h, at.h); Object.assign(s.at.s, at.s);
  Object.assign(s.gone.f, gone.f); Object.assign(s.gone.h, gone.h);
  s.at.settings = settingsAt;
  return { festivals, history, savedPicks, customMovies: [], settings, activeFestival: festivals[0]?.id, sync: s };
}
const fest = (id, name = id) => ({ id, name, categories: [] });
const watched = (id, date) => ({ id, title: 'Movie ' + id, date });

test('the newer edit to the same festival wins', () => {
  const local = state({ festivals: [fest('a', 'Old name')], at: { f: { a: NOW - 1000 } } });
  const remote = state({ festivals: [fest('a', 'New name')], at: { f: { a: NOW } } });
  assert.equal(merge(local, remote, { now: NOW }).festivals[0].name, 'New name');
  assert.equal(merge(remote, local, { now: NOW }).festivals[0].name, 'New name', 'order of arguments should not matter');
});

test('items that only exist on one device are kept', () => {
  const local = state({ history: [watched('h1', '2026-10-01')], at: { h: { h1: NOW - 5 } } });
  const remote = state({ history: [watched('h2', '2026-10-02')], at: { h: { h2: NOW - 3 } } });
  const out = merge(local, remote, { now: NOW });
  assert.deepEqual(out.history.map((e) => e.id).sort(), ['h1', 'h2']);
});

test('a deletion beats an older edit on the other device', () => {
  const local = state({ history: [], gone: { h: { h1: NOW - 100 } } });
  const remote = state({ history: [watched('h1', '2026-10-01')], at: { h: { h1: NOW - 500 } } });
  const out = merge(local, remote, { now: NOW });
  assert.equal(out.history.length, 0);
  assert.equal(out.sync.gone.h.h1, NOW - 100, 'the deletion is remembered so a third device also drops it');
});

test('an edit made after the deletion brings the item back', () => {
  const local = state({ history: [], gone: { h: { h1: NOW - 500 } } });
  const remote = state({ history: [watched('h1', '2026-10-01')], at: { h: { h1: NOW - 100 } } });
  const out = merge(local, remote, { now: NOW });
  assert.equal(out.history.length, 1);
  assert.equal(out.sync.gone.h.h1, undefined);
});

test('old deletion records expire after 120 days', () => {
  const local = state({ gone: { h: { h1: NOW - 121 * DAY } } });
  const out = merge(local, state(), { now: NOW });
  assert.equal(out.sync.gone.h.h1, undefined);
});

test('history comes back newest first', () => {
  const local = state({ history: [watched('old', '2026-01-01')], at: { h: { old: 1 } } });
  const remote = state({ history: [watched('new', '2026-11-01'), watched('mid', '2026-06-01')], at: { h: { new: 1, mid: 1 } } });
  assert.deepEqual(merge(local, remote, { now: NOW }).history.map((e) => e.id), ['new', 'mid', 'old']);
});

test('Saved for Later keeps only the most recent picks', () => {
  const pick = (movieId, date) => ({ movieId, title: movieId, date });
  const local = state({ savedPicks: [pick('a', '2026-01-01'), pick('b', '2026-02-01')], at: { s: { a: 1, b: 1 } } });
  const remote = state({ savedPicks: [pick('c', '2026-03-01'), pick('d', '2026-04-01')], at: { s: { c: 1, d: 1 } } });
  const out = merge(local, remote, { now: NOW, savedMax: 3 });
  assert.deepEqual(out.savedPicks.map((p) => p.movieId), ['b', 'c', 'd']);
});

test('settings: the newer change wins as a whole; ties go to remote only when asked', () => {
  const local = state({ settings: { theme: 'noir' }, settingsAt: NOW - 10 });
  const remote = state({ settings: { theme: 'sepia' }, settingsAt: NOW - 20 });
  assert.equal(merge(local, remote, { now: NOW }).settings.theme, 'noir');

  const tieL = state({ settings: { theme: 'noir' } });
  const tieR = state({ settings: { theme: 'sepia' } });
  assert.equal(merge(tieL, tieR, { now: NOW, remoteWinsTies: true }).settings.theme, 'sepia');
  assert.equal(merge(tieL, tieR, { now: NOW, remoteWinsTies: false }).settings.theme, 'noir');
});

test('the active festival falls back when it was deleted elsewhere', () => {
  const local = state({ festivals: [fest('a'), fest('b')], at: { f: { a: 1, b: 1 } } });
  local.activeFestival = 'b';
  const remote = state({ festivals: [fest('a')], at: { f: { a: 1 } }, gone: { f: { b: NOW - 5 } } });
  const out = merge(local, remote, { now: NOW });
  assert.deepEqual(out.festivals.map((f) => f.id), ['a']);
  assert.equal(out.activeFestival, 'a');
});

test('merge does not modify its inputs', () => {
  const local = state({ history: [watched('h1', '2026-10-01')], at: { h: { h1: 5 } } });
  const remote = state({ history: [watched('h2', '2026-10-02')], at: { h: { h2: 6 } } });
  const before = JSON.stringify([local, remote]);
  merge(local, remote, { now: NOW });
  assert.equal(JSON.stringify([local, remote]), before);
});

test('stamp records edits, additions, and deletions since the last save', () => {
  const d = { festivals: [fest('a'), fest('b')], history: [], savedPicks: [], customMovies: [], settings: { theme: 'noir' } };
  const base = baselineOf(d);
  d.festivals[0].name = 'Renamed';       // edit
  d.festivals.splice(1, 1);              // delete b
  d.history.push(watched('h1', '2026-10-01')); // add
  d.settings.theme = 'sepia';
  stamp(d, base, 1234);
  assert.equal(d.sync.at.f.a, 1234);
  assert.equal(d.sync.gone.f.b, 1234);
  assert.equal(d.sync.at.h.h1, 1234);
  assert.equal(d.sync.at.settings, 1234);
});

test('stamp leaves unchanged items alone', () => {
  const d = { festivals: [fest('a')], history: [], savedPicks: [], customMovies: [], settings: {} };
  const base = stamp(d, null, 1);
  stamp(d, base, 999);
  assert.equal(d.sync.at.f.a, undefined);
});

test('ensureSync repairs a missing or malformed sync record', () => {
  const d = { sync: { at: { f: [] , settings: 'x' }, gone: null } };
  const s = ensureSync(d);
  assert.deepEqual(s, emptySync());
});

test('sameData ignores sync bookkeeping and which festival is open', () => {
  const a = state({ festivals: [fest('a'), fest('b')], at: { f: { a: 1 } } });
  const b = JSON.parse(JSON.stringify(a));
  b.sync.at.f.a = 999;
  b.activeFestival = 'b';
  assert.ok(sameData(a, b));
  b.festivals[0].name = 'Different';
  assert.ok(!sameData(a, b));
});
