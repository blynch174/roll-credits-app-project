// The dice have to be fair, or the whole app is pointless.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randInt, faceLabel } from '../js/dice.js';
import { DIE_OPTIONS } from '../js/defaults.js';

test('randInt always lands inside the range', () => {
  for (const sides of DIE_OPTIONS) {
    for (let i = 0; i < 2000; i++) {
      const n = randInt(1, sides);
      assert.ok(Number.isInteger(n) && n >= 1 && n <= sides, `d${sides} rolled ${n}`);
    }
  }
});

test('randInt can return both ends of the range', () => {
  const seen = new Set();
  for (let i = 0; i < 5000; i++) seen.add(randInt(1, 20));
  assert.equal(seen.size, 20, 'every face of a d20 should come up in 5,000 rolls');
});

test('randInt handles a one-value range', () => {
  assert.equal(randInt(7, 7), 7);
});

// Chi-square goodness of fit at p = 0.0001: a fair die fails this about once in 10,000 runs, so CI stays green,
// while a real bias (e.g. one face coming up 3 points more often) fails it every time at 60,000 rolls.
test('d6 and d20 rolls are uniform (chi-square)', () => {
  const critical = { 6: 25.74, 20: 50.80 }; // p = 0.0001, df = sides - 1
  for (const sides of [6, 20]) {
    const rolls = 60000;
    const counts = new Array(sides).fill(0);
    for (let i = 0; i < rolls; i++) counts[randInt(1, sides) - 1]++;
    const expected = rolls / sides;
    const chi2 = counts.reduce((sum, c) => sum + (c - expected) ** 2 / expected, 0);
    assert.ok(chi2 < critical[sides], `d${sides} chi-square ${chi2.toFixed(2)} >= ${critical[sides]}: counts ${counts}`);
  }
});

test('faceLabel shows H/T for coins and numbers for dice', () => {
  assert.equal(faceLabel(2, 1), 'H');
  assert.equal(faceLabel(2, 2), 'T');
  assert.equal(faceLabel(20, 17), '17');
  assert.equal(faceLabel(6, null), '?');
  assert.equal(faceLabel(6, undefined), '?');
});
