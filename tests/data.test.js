// Checks on the repo itself: the data files the app downloads, the built-in festivals, and the offline file list.
// These catch the mistakes that are easy to make by hand and only show up on someone's phone.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { BUILT_IN_FESTIVALS, STARTER_FESTIVALS, DIE_OPTIONS, SWATCHES, RATING_ICONS } from '../js/defaults.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(path.join(ROOT, p), 'utf8');
const json = (p) => JSON.parse(read(p));

function walk(dir, ext) {
  const out = [];
  for (const name of readdirSync(path.join(ROOT, dir))) {
    const rel = path.posix.join(dir, name);
    if (statSync(path.join(ROOT, rel)).isDirectory()) out.push(...walk(rel, ext));
    else if (rel.endsWith(ext)) out.push(rel);
  }
  return out;
}

const movies = json('data/all_movies.json');
const ids = new Set(movies.map((m) => m.id));

test('every JSON file in data/ parses', () => {
  for (const f of walk('data', '.json')) assert.doesNotThrow(() => json(f), f);
});

test('catalog movies have unique ids and the fields the app relies on', () => {
  assert.equal(ids.size, movies.length, 'duplicate catalog ids');
  for (const m of movies) {
    assert.equal(typeof m.id, 'string', JSON.stringify(m).slice(0, 80));
    assert.ok(m.title && typeof m.title === 'string', m.id);
    assert.ok(Number.isInteger(m.releaseYear), `${m.id} releaseYear`);
  }
});

test('festival collections only point at movies that exist in the catalog', () => {
  for (const f of walk('data', '.json')) {
    const d = json(f);
    if (!d || Array.isArray(d) || !Array.isArray(d.movieIds)) continue;
    const missing = d.movieIds.filter((id) => !ids.has(id));
    assert.deepEqual(missing, [], `${f} lists movies not in all_movies.json`);
  }
});

test('built-in festivals are well formed', () => {
  const seen = new Set();
  const colors = new Set(SWATCHES.map((s) => s.id));
  for (const def of BUILT_IN_FESTIVALS) {
    assert.ok(!seen.has(def.id), `duplicate festival id ${def.id}`);
    seen.add(def.id);
    assert.ok(DIE_OPTIONS.includes(def.categoryDie), `${def.id} categoryDie`);
    assert.ok(DIE_OPTIONS.includes(def.movieDie), `${def.id} movieDie`);
    assert.ok(RATING_ICONS.includes(def.icon), `${def.id} icon ${def.icon}`);
    assert.equal(def.categories.length, def.categoryDie, `${def.id}: one category per face of the category die`);
    for (const [name, color, list, die] of def.categories) {
      const size = die || def.movieDie;
      assert.ok(colors.has(color), `${def.id} / ${name}: unknown color ${color}`);
      assert.ok(list.length <= size, `${def.id} / ${name}: ${list.length} movies but only a d${size}`);
    }
  }
  for (const id of STARTER_FESTIVALS) assert.ok(seen.has(id), `starter festival ${id} is not built in`);
});

// The service worker's list is what works offline. A module missing from it breaks the whole app offline,
// because one failed import stops every module that depends on it.
test('every app module is in the service worker offline list, and every listed file exists', () => {
  const sw = read('sw.js');
  const listed = [...sw.matchAll(/'\.\/([^']+)'/g)].map((m) => m[1]).filter(Boolean);
  for (const f of listed) assert.ok(existsSync(path.join(ROOT, f)), `sw.js lists ${f}, which doesn't exist`);
  const missing = walk('js', '.js').filter((f) => !listed.includes(f));
  assert.deepEqual(missing, [], 'add these to FILES in sw.js (and bump CACHE_VERSION)');
});

test('the web app manifest parses and its icons exist', () => {
  const manifest = json('manifest.webmanifest');
  assert.ok(manifest.name);
  for (const icon of manifest.icons || []) {
    assert.ok(existsSync(path.join(ROOT, icon.src.replace(/^\.\//, ''))), icon.src);
  }
});
