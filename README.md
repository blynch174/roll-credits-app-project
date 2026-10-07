# Roll Credits

Roll dice to pick tonight's movie. Each **film festival** (Halloween, Christmas, Awards Season, or one you make)
has its own tables, dice, theme, and rating icon. Plain HTML, CSS, and JavaScript. No frameworks, no build step.

## Run it on your computer

```
python -m http.server 8000
```

Then open http://localhost:8000. (The JS loads as modules, which don't run from a double-clicked file.)

## Files

| File | What it does |
|---|---|
| `index.html` | Screen layout: Roll, Watched, Tables, Settings, and the festival creator |
| `css/styles.css` | All styling. Colors come from variables set by `js/themes.js` |
| `js/app.js` | Boot, tab navigation, festival switcher |
| `js/store.js` | Saved data and every change to it, plus upgrading older saved data |
| `js/defaults.js` | Built-in festivals and their starter movies, dice options, category colors, rating icon list |
| `js/themes.js` | Theme sets for each built-in festival, and the generator for custom festivals |
| `js/icons.js` | SVG drawings for rating icons and dice |
| `js/dice.js` | Fair random numbers and the dice animation |
| `js/ui.js` | Shared helpers: sheets, toasts, the type-DELETE confirm, dice markup |
| `js/screens/*.js` | One file per screen |
| `sw.js` | Offline support |

## Publishing an update

1. Make your changes.
2. If you added a new file, add it to the `FILES` list in `sw.js`.
3. Bump `CACHE_VERSION` in `sw.js` (`v2` → `v3`).
4. `git add .`, `git commit -m "what changed"`, `git push`.

## Adding a built-in festival

Add an entry to `BUILT_IN_FESTIVALS` in `js/defaults.js`, and a theme set in `js/themes.js` under the same
`themeSet` name. Existing users get it automatically next time they open the app.

## Saved data (version 2)

Stored in localStorage under `roll-credits:data`, on this device only. Settings → Export backup saves a copy.

```
{
  version: 2,
  settings: { diceMode, slotMode },
  activeFestival: "halloween",
  festivals: [ { id, name, builtIn, icon, themeSet | accent, theme, mode: "one"|"two",
                 categoryDie, freshSince,
                 categories: [ { id, name, color, die, slots: [movie or null] } ] } ],
  history: [ { festivalId, festivalName, icon, categoryId, categoryName, movieId, catalogId,
               title, year, date, rating, notes } ]
}
```

- **History is permanent** and tagged with the festival it came from. Only Settings → Clear watch history
  deletes it (pick a festival or everything, then type DELETE).
- **Seen marks** only count history from the current festival since its last **Start fresh**.
- Each movie has `catalogId` (empty for now). It will link to `data/catalog.json` for sequel switching.
- Version 1 data (the original Halloween-only app) upgrades automatically. To change the shape again,
  bump `CURRENT_VERSION` in `store.js` and add a step in `migrate()`.

## Rules the app follows

- **Two dice:** the first die picks a category (number of categories = its sides), the second picks a movie.
  Each category has its own movie die. **One die:** a single list, no categories.
- Dice: Coin (2), d4, d6, d8, d12, d20. Shrinking a die warns before removing anything.
- An empty category in a two-dice festival acts as the Wild Card.
- **Keep mode:** watched movies stay in their slot, marked Seen. **Replace mode:** they leave the table.
- Removing from history: *Didn't finish* goes back to its slot and keeps the note, *Hated it* is removed
  from the table, *Rolled by mistake* is undone.
