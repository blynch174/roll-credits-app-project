// SVG drawings: rating icons and dice outlines.
// Rating icons use class "b" (body, current color), "h" (holes, surface color), "s" (strokes).

const ICONS = {
  skull: '<path class="b" d="M12 2.2c-4.9 0-8.6 3.5-8.6 8.1 0 2.7 1.2 4.8 3.2 6.1v2.4c0 .9.7 1.6 1.6 1.6h7.6c.9 0 1.6-.7 1.6-1.6v-2.4c2-1.3 3.2-3.4 3.2-6.1 0-4.6-3.7-8.1-8.6-8.1z"/><circle class="h" cx="8.6" cy="10.6" r="2"/><circle class="h" cx="15.4" cy="10.6" r="2"/><path class="h" d="M12 13.6l-1.2 2.2h2.4z"/>',
  tree: '<path class="b" d="M12 1.8l4.6 5.6h-2.4l4.1 5.3h-2.6l4.3 5.7H4l4.3-5.7H5.7l4.1-5.3H7.4z"/><rect class="b" x="10.4" y="18.6" width="3.2" height="3.6" rx=".6"/>',
  trophy: '<path class="b" fill-rule="evenodd" d="M7 2.5h10v2h3.2v2.2c0 2.7-2 4.7-4.6 5A5.2 5.2 0 0 1 13.2 15v3.2H16v3H8v-3h2.8V15a5.2 5.2 0 0 1-2.4-3.3c-2.6-.3-4.6-2.3-4.6-5V4.5H7zM5.6 6.3v.4c0 1.5 1 2.7 2.4 3V6.3zm12.8 0H16v3.4c1.4-.3 2.4-1.5 2.4-3z"/>',
  star: '<path class="b" d="M12 2.5l2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17.4l-5.9 3.1 1.2-6.5L2.5 9.4l6.6-.9z"/>',
  popcorn: '<circle class="b" cx="7.2" cy="7.6" r="2.7"/><circle class="b" cx="11.6" cy="5.6" r="3.1"/><circle class="b" cx="16.4" cy="7.4" r="2.8"/><path class="b" d="M4.6 9.4h14.8l-1.9 12a1 1 0 0 1-1 .9H7.5a1 1 0 0 1-1-.9z"/><path class="h" d="M9.2 11.4h1.4l.4 8.6H9.8zM13.4 11.4h1.4l-.6 8.6H13z"/>',
  heart: '<path class="b" d="M12 21s-8.5-5.3-8.5-11.2A4.8 4.8 0 0 1 12 6.9a4.8 4.8 0 0 1 8.5 2.9C20.5 15.7 12 21 12 21z"/>',
  ghost: '<path class="b" d="M12 2.5a7 7 0 0 0-7 7v11.3l2.3-1.8 2.3 1.8 2.4-1.8 2.4 1.8 2.3-1.8 2.3 1.8V9.5a7 7 0 0 0-7-7z"/><ellipse class="h" cx="9.4" cy="10.2" rx="1.4" ry="1.9"/><ellipse class="h" cx="14.6" cy="10.2" rx="1.4" ry="1.9"/>',
  snowflake: '<path class="s" d="M12 2.5v19M3.8 7.25l16.4 9.5M3.8 16.75l16.4-9.5M9.4 4.3L12 6.5l2.6-2.2M9.4 19.7L12 17.5l2.6 2.2M4.6 11.2l2.9.8-.6 3.3M19.4 12.8l-2.9-.8.6-3.3"/>',
};

export function iconSVG(name) {
  return `<svg viewBox="0 0 24 24" aria-hidden="true">${ICONS[name] || ICONS.star}</svg>`;
}

// Die outlines, 100x100. Each shape is the recognizable 2D silhouette of that die.
const SHAPES = {
  2: '<circle cx="50" cy="50" r="44" />',
  4: '<polygon points="50,6 95,88 5,88" />',
  6: '<rect x="8" y="8" width="84" height="84" rx="16" />',
  8: '<polygon points="50,3 95,50 50,97 5,50" />',
  12: '<polygon points="50,6 93,37 77,90 23,90 7,37" />',
  20: '<polygon points="50,4 92,27 92,73 50,96 8,73 8,27" />',
};

export function dieSVG(sides) {
  return `<svg viewBox="0 0 100 100" aria-hidden="true">${SHAPES[sides] || SHAPES[6]}</svg>`;
}
