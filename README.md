# Roll Credits

Roll dice to pick tonight's movie. A d6 picks the category, a d12 picks the movie.
Plain HTML, CSS, and JavaScript. No frameworks, no build step.

## Run it on your computer

The JavaScript files load as modules, which browsers won't run from a double-clicked file.
Start a tiny local server from this folder instead:

```
python -m http.server 8000
```

Then open http://localhost:8000.

## Files

| File | What it does |
|---|---|
| `index.html` | The three screens (Roll, Tables, Settings) and the bottom tab bar |
| `css/styles.css` | Layout and the four themes (each theme is a block of color variables at the top) |
| `js/app.js` | Everything you see and tap: rolling, sheets, rendering each screen |
| `js/store.js` | Saving and loading data, plus every change to it (watch, remove, edit, import/export) |
| `js/defaults.js` | The starter Halloween menu, category colors, and theme list |
| `js/dice.js` | Fair random numbers and the 2D dice tumble |
| `manifest.webmanifest` | App name, icon, and colors for "Add to Home Screen" |
| `sw.js` | Offline caching |
| `icons/` | App icons |

## Publishing an update

1. Make your changes.
2. Open `sw.js` and bump `CACHE_VERSION` (`v1` → `v2`). **If you skip this, phones keep the old version.**
3. Push to GitHub. Pages updates within a minute or two.
4. On the phone, close and reopen the app (sometimes twice) to pick up the new version.

## Where data is saved

Everything lives in the browser's localStorage under the key `roll-credits:data`, on this device only.
Use **Settings → Export backup** to save a copy or move it to another device.

The saved data looks like this:

```
{
  version: 1,
  settings: { theme, diceMode, slotMode },
  activeMenu: "halloween",
  menus: [ { id, name, categories: [ { id, name, vibe, color, slots: [12 × movie or null] } ] } ],
  season: { started, watched: [ { movieId, title, year, categoryId, date, rating, notes, ... } ] }
}
```

- `menus` is a list so other marathons (Christmas, etc.) can be added later without restructuring.
- Every movie has a permanent `id`, which is how watched status and "add back to table" work.
- Watched entries keep their own copy of the title, so editing a table never changes history.
- If the data shape ever changes, bump `version` and add a conversion step in `migrate()` in `store.js`.

## Rules the app follows

- An empty category acts as the Wild Card (roll its number and you pick any category).
- **Keep mode:** watched movies stay in their slot, marked Seen. Rolling one offers a reroll.
- **Replace mode:** watched movies leave the table, and the open slot appears under "slots to fill."
- Removing from the watched list:
  - *Didn't finish:* goes back to its slot (if still open) and keeps your note.
  - *Hated it:* removed from the table for good, slot opens.
  - *Rolled by mistake:* undone as if it never happened.
