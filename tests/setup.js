// Loaded before every test file (see "test" in package.json).
// The app is written for the browser. These two stand-ins let its modules run in Node unchanged:
//   localStorage - kept in memory, so each test file starts with an empty device
//   fetch        - reads files from the repo instead of the network (data/all_movies.json etc.)

import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

class MemoryStorage {
  #items = new Map();
  getItem(k) { return this.#items.has(k) ? this.#items.get(k) : null; }
  setItem(k, v) { this.#items.set(k, String(v)); }
  removeItem(k) { this.#items.delete(k); }
  clear() { this.#items.clear(); }
}
globalThis.localStorage = new MemoryStorage();

globalThis.fetch = async (url) => {
  const file = path.join(ROOT, String(url).replace(/^\.?\//, ''));
  try {
    const text = await readFile(file, 'utf8');
    return { ok: true, status: 200, json: async () => JSON.parse(text), text: async () => text };
  } catch {
    return { ok: false, status: 404, json: async () => { throw new Error('404'); }, text: async () => '' };
  }
};
