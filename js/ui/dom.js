// Finding elements, movie labels, and the navigation hub screens use to reach each other.

import { esc } from '../util.js';

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

export const movieLabel = (m) => (m.year ? `${esc(m.title)} <span class="year">(${m.year})</span>` : esc(m.title));

// Screens register here so they can switch to each other without circular imports.
export const nav = {
  go: () => {},
  back: () => {},
  render: () => {},
  filters: null, // Watched-screen filters other screens can preset
};
