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
  balloon: '<path class="b" d="M12 2.4c-3.9 0-6.8 3-6.8 6.9 0 4.1 3.2 7.6 6 8.3l-.9 1.7h3.4l-.9-1.7c2.8-.7 6-4.2 6-8.3 0-3.9-2.9-6.9-6.8-6.9z"/><ellipse class="h" cx="9.3" cy="7.9" rx="1.1" ry="2" transform="rotate(28 9.3 7.9)"/><path class="s" d="M12 19.6c-1 .8-1 1.6 0 2.4"/>',
  hourglass: '<path class="b" d="M5.8 2.5h12.4v2.1H17v1.6c0 2.4-1.5 4.3-3.4 5.8 1.9 1.5 3.4 3.4 3.4 5.8v1.6h1.2v2.1H5.8v-2.1H7v-1.6c0-2.4 1.5-4.3 3.4-5.8C8.5 10.5 7 8.6 7 6.2V4.6H5.8z"/><path class="h" d="M9.3 18.9h5.4c-.4-1.7-1.5-2.8-2.7-3.7-1.2.9-2.3 2-2.7 3.7zM9.7 7.3h4.6c-.6.9-1.4 1.7-2.3 2.4-.9-.7-1.7-1.5-2.3-2.4z"/>',
  vinyl: '<circle class="b" cx="12" cy="12" r="9.8"/><path class="h" d="M12 4.1a7.9 7.9 0 0 1 7.6 5.7l-.9.3A6.9 6.9 0 0 0 12 5.1zM12 19.9a7.9 7.9 0 0 1-7.6-5.7l.9-.3a6.9 6.9 0 0 0 6.7 5z"/><circle class="h" cx="12" cy="12" r="3.3"/><circle class="b" cx="12" cy="12" r="1"/>',
  vhs: '<rect class="b" x="1.8" y="5" width="20.4" height="14" rx="1.8"/><rect class="h" x="4" y="7" width="16" height="4.2" rx=".8"/><circle class="h" cx="8.2" cy="15.3" r="2.1"/><circle class="h" cx="15.8" cy="15.3" r="2.1"/><rect class="h" x="10.3" y="14.6" width="3.4" height="1.4" rx=".5"/>',
  clapper: '<path class="b" d="M3 9.2h18v10.3a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 19.5z"/><path class="b" d="M2.6 7.6l16.9-4.5.6 2.3-16.9 4.5z"/><path class="h" d="M6.2 6.6l2.6-.7 1.4 2.4-2.6.7zM11.4 5.2l2.6-.7 1.4 2.4-2.6.7z"/><rect class="h" x="5.5" y="12.4" width="13" height="1.4" rx=".7"/>',
  chair: '<path class="b" d="M5 3h14v7.5H5z"/><path class="h" d="M7 5h10v3.5H7z"/><path class="b" d="M4 11.8h16v2.4H4z"/><path class="s" d="M6 14.2l12 7M18 14.2L6 21.2"/>',
  reel: '<circle class="b" cx="12" cy="12" r="9.6"/><circle class="h" cx="12" cy="6.6" r="2.3"/><circle class="h" cx="12" cy="17.4" r="2.3"/><circle class="h" cx="6.6" cy="12" r="2.3"/><circle class="h" cx="17.4" cy="12" r="2.3"/><circle class="h" cx="12" cy="12" r="1"/>',
  note: '<path class="b" d="M9 4.6l11-2.1v13.3a3.1 3.1 0 1 1-2.2-3V7.1L11.2 8.4v9.4a3.1 3.1 0 1 1-2.2-3z"/>',
  masks: '<path class="b" d="M2.5 4.5c3-1.4 6.6-1.4 9.6 0v6.1c0 3.2-2.1 5.9-4.8 5.9S2.5 13.8 2.5 10.6z"/><ellipse class="h" cx="5.4" cy="8.1" rx="1" ry=".7"/><ellipse class="h" cx="9.2" cy="8.1" rx="1" ry=".7"/><path class="h" d="M4.8 11.4c1.6 1.7 3.4 1.7 5 0-1.6.7-3.4.7-5 0z"/><path class="b" d="M11.9 9.2c3-1.4 6.6-1.4 9.6 0v6.1c0 3.2-2.1 5.9-4.8 5.9s-4.8-2.7-4.8-5.9z"/><ellipse class="h" cx="14.8" cy="12.8" rx="1" ry=".7"/><ellipse class="h" cx="18.6" cy="12.8" rx="1" ry=".7"/><path class="h" d="M14.2 17.6c1.6-1.6 3.4-1.6 5 0-1.6-.6-3.4-.6-5 0z"/>',
  globe: '<circle class="b" cx="12" cy="12" r="9.6"/><path class="h" d="M12 3.6c-2.3 2.3-3.4 5.1-3.4 8.4s1.1 6.1 3.4 8.4c-1.4-2.6-2.1-5.4-2.1-8.4s.7-5.8 2.1-8.4zM12 3.6c2.3 2.3 3.4 5.1 3.4 8.4s-1.1 6.1-3.4 8.4c1.4-2.6 2.1-5.4 2.1-8.4s-.7-5.8-2.1-8.4z"/><path class="h" d="M3.6 11.3h16.8v1.4H3.6zM5 7.3h14v1.2H5zM5 15.5h14v1.2H5z"/>',
  castle: '<path class="b" d="M3 9.5h3.4v-3l1.2-2 1.2 2v3H11V5.2l1-2.4 1 2.4v4.3h2.2v-3l1.2-2 1.2 2v3H21V21H3z"/><path class="h" d="M10.2 21v-4.3a1.8 1.8 0 0 1 3.6 0V21zM6 12.4h1.6v2H6zM16.4 12.4H18v2h-1.6zM11.3 10.8h1.4v1.8h-1.4z"/>',
  tomato: '<path class="b" d="M12 7.2c5.1 0 8.6 2.9 8.6 6.6S16.8 21 12 21s-8.6-3.4-8.6-7.2 3.5-6.6 8.6-6.6z"/><path class="b" d="M12 3v3.4M8.6 5.2l3.4 2.3 3.4-2.3"/><path class="s" d="M12 2.8v4.4M8.4 5.2L12 7.4l3.6-2.2"/><ellipse class="h" cx="8.4" cy="12" rx="1.6" ry="1" transform="rotate(-25 8.4 12)"/>',
  cleaver: '<path class="b" d="M2.5 4.8h12.2v6.6c0 2.6-2.1 4.7-4.7 4.7H2.5z"/><circle class="h" cx="11.6" cy="7.6" r="1.2"/><rect class="b" x="14" y="6.2" width="8" height="3.4" rx="1.3"/><rect class="h" x="16.4" y="7.4" width="3.6" height="1" rx=".5"/>',
  drop: '<path class="b" d="M10.5 4c-.3.4-5.6 6.7-5.6 10.5a5.6 5.6 0 0 0 11.2 0C16.1 10.7 10.8 4.4 10.5 4z"/><circle class="b" cx="18.6" cy="6.4" r="1.9"/><circle class="b" cx="20" cy="11.6" r="1.2"/><circle class="b" cx="4.2" cy="5.2" r="1.1"/><path class="h" d="M7.8 15c.2 1.6 1.2 2.6 2.7 2.9-.4.3-1 .4-1.7.2a3 3 0 0 1-2-2.8c0-.2.5-.5 1-.3z"/>',
  claw: '<path class="b" d="M7.5 21.5c-2.2 0-3.6-1.7-3.3-3.8.4-2.4 2.9-3.6 5.3-4.8 1.5-.8 2.4-.9 3.2-.3.9.7 1 2.3.7 4.1-.5 2.8-3.1 4.8-5.9 4.8z"/><path class="b" d="M4.6 11.6C3.9 9 4.2 5.4 6 2.8c.2 2.6.9 5 2.3 7.6zM9.5 9.6C9.4 6.8 10.6 3.6 12.9 1.8c-.3 2.6 0 5.2.9 7.9zM14.2 11.6c.9-2.5 2.9-4.9 5.8-6.1-1.1 2.3-1.6 4.6-1.7 7.4zM16.3 16.4c1.8-1.3 4.2-2 6.4-1.6-1.6 1.3-2.8 2.8-3.6 4.6z"/>',
  rocket: '<path class="b" d="M12 1.8c3.2 2.2 4.7 5.6 4.7 9.6v5.1H7.3v-5.1c0-4 1.5-7.4 4.7-9.6z"/><circle class="h" cx="12" cy="9.3" r="1.9"/><path class="b" d="M7.3 12.3L4 15.6v3.6l3.3-2zM16.7 12.3l3.3 3.3v3.6l-3.3-2z"/><path class="b" d="M10 17.6h4l-.6 3.6h-2.8z"/>',
  d20: '<path class="b" d="M12 1.8l9 5.2v10L12 22.2 3 17V7z"/><path class="h" d="M12 5.2l5.4 9.4H6.6z"/><path class="s" style="stroke:var(--surface);stroke-width:1" d="M12 1.8v3.4M3 7l3.6 7.6M21 7l-3.6 7.6M6.6 14.6L3 17M17.4 14.6L21 17M6.6 14.6L12 22.2l5.4-7.6"/>',
  controller: '<path class="b" d="M7.3 7h9.4c2.6 0 4.4 2 4.9 5l.8 4.6a2.6 2.6 0 0 1-4.6 2.2L15.9 16.6H8.1l-1.9 2.2a2.6 2.6 0 0 1-4.6-2.2l.8-4.6C2.9 9 4.7 7 7.3 7z"/><path class="h" d="M6.4 10.2h1.4v1.6h1.6v1.4H7.8v1.6H6.4v-1.6H4.8v-1.4h1.6z"/><circle class="h" cx="16.4" cy="10.9" r="1"/><circle class="h" cx="18.4" cy="12.9" r="1"/>',
  ufo: '<path class="b" d="M8.3 9.3a3.7 3.7 0 0 1 7.4 0z"/><ellipse class="b" cx="12" cy="12.4" rx="10" ry="3.6"/><circle class="h" cx="7" cy="12.4" r=".9"/><circle class="h" cx="12" cy="13.1" r=".9"/><circle class="h" cx="17" cy="12.4" r=".9"/><path class="b" d="M9 16.6h6l2.2 5H6.8z" opacity=".55"/>',
  arrowheart: '<path class="b" d="M12 20s-7.5-4.7-7.5-9.9A4.2 4.2 0 0 1 12 7.6a4.2 4.2 0 0 1 7.5 2.5C19.5 15.3 12 20 12 20z"/><path class="s" d="M2.5 19.5L21 4"/><path class="b" d="M21.9 2.4l-.3 4-3.7-.3zM3.9 17.4l-1.8.5-.6 2.1 2.1-.6.5-1.8"/>',
  rose: '<path class="b" d="M12 2.6c3 0 5.6 2 5.6 5.4 0 3.1-2.5 5.4-5.6 5.4S6.4 11.1 6.4 8c0-1.6.6-2.9 1.6-3.8 1 .9 2.4 1.4 4 1.4-.8-.7-1.2-1.8-1.2-2.9z"/><path class="h" d="M10.3 8.4c.6 1.2 2.6 1.4 3.6.1-1.2.4-2.4.4-3.6-.1z"/><path class="s" d="M12 13.4v8.2M12 18c-1.6-2.2-3.8-2.6-5.6-1.8 1.3 1.4 3.4 2.2 5.6 1.8z"/>',
  glasses3d: '<path class="b" d="M1.8 8h20.4v2.2l-1 .3v5.3a1.6 1.6 0 0 1-1.6 1.6h-4.2a1.6 1.6 0 0 1-1.5-1l-.8-2.2h-2.2l-.8 2.2a1.6 1.6 0 0 1-1.5 1H4.4a1.6 1.6 0 0 1-1.6-1.6v-5.3l-1-.3z"/><rect class="h" x="4.6" y="10.6" width="5.4" height="4.6" rx=".6"/><rect class="h" x="14" y="10.6" width="5.4" height="4.6" rx=".6" opacity=".55"/>',
  ticket: '<path class="b" d="M2.5 6.5h19v3.6a1.9 1.9 0 0 0 0 3.8v3.6h-19v-3.6a1.9 1.9 0 0 0 0-3.8z"/><path class="h" d="M8.2 8.2h1.2v1.6H8.2zM8.2 11.2h1.2v1.6H8.2zM8.2 14.2h1.2v1.6H8.2z"/><path class="h" d="M11.4 10.2h7v1.2h-7zM11.4 12.8h5v1.2h-5z"/>',
  pumpkin: '<path class="b" d="M12 6.4c-1.4-.9-3.2-1.2-4.9-.8C4 6.3 2.2 9.4 2.2 13.2s2.4 7.4 6.4 7.4c1.3 0 2.4-.5 3.4-1.2 1 .7 2.1 1.2 3.4 1.2 4 0 6.4-3.4 6.4-7.4s-1.8-6.9-4.9-7.6c-1.7-.4-3.5-.1-4.9.8z"/><path class="b" d="M11.2 6.6c0-1.6.3-3 1.6-4.4l1.4 1c-.9 1-1.2 2.1-1.2 3.4z"/><path class="h" d="M7 11.6l2 2.2-2.4.4zM17 11.6l-2 2.2 2.4.4zM7.4 16.2c1.4 1.4 2.9 2 4.6 2s3.2-.6 4.6-2l-1.5.3-.7.9-.8-.7-1.6.6-1.6-.6-.8.7-.7-.9z"/>',
  crown: '<path class="b" d="M2.8 7.4l4.7 4.4L12 4.2l4.5 7.6 4.7-4.4-1.8 11H4.6z"/><rect class="b" x="4.6" y="19.4" width="14.8" height="2" rx=".6"/><circle class="h" cx="12" cy="14.2" r="1.3"/>',
  teardrop: '<path class="b" d="M12 2.4c-.4.5-6.7 8-6.7 12.6a6.7 6.7 0 0 0 13.4 0c0-4.6-6.3-12.1-6.7-12.6z"/><ellipse class="h" cx="9.6" cy="15.2" rx="1.25" ry="2" transform="rotate(-20 9.6 15.2)"/>',
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
