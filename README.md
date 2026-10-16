# Roll Credits

Roll dice to pick tonight's movie. Each **film festival** (Halloween, Christmas, Awards Season, or one you make)
has its own tables, dice, theme, and rating icon. Plain HTML, CSS, and JavaScript. No frameworks, no build step.

## Run it on your computer

```
python3 -m http.server 8000
```

Then open http://localhost:8000. (The JS loads as modules, which don't run from a double-clicked file.)

## Files

| File | What it does |
|---|---|
| `index.html` | Screen layout: Roll, Watched, Tables, Settings, and the festival creator |
| `css/styles.css` | All styling. Colors come from variables set by `js/themes.js` |
| `js/app.js` | Boot, tab navigation, festival switcher, background loading of the catalog and 3D dice |
| `js/store.js` | Saved data and every change to it, plus upgrading older saved data |
| `js/defaults.js` | Built-in festivals and their starter movies, dice options, category colors, rating icon list |
| `js/themes.js` | Theme sets for each built-in festival, and the generator for custom festivals |
| `js/icons.js` | SVG drawings for rating icons and flat dice |
| `js/dice.js` | Fair random numbers, the flat dice tumble, and the CSS 3D coin flip |
| `js/dice3d.js` | 3D dice: loads dice-box only when 3D is on, falls back to flat dice if it can't start |
| `js/catalog.js` | Loads `data/all_movies.json`: title search, title matching, franchise lookups |
| `js/autofind.js` | Catalog suggestions under a title box (slot editor and Log a movie) |
| `js/ui.js` | Shared helpers: sheets, toasts, the type-DELETE confirm, dice and coin markup |
| `js/screens/*.js` | One file per screen |
| `data/` | The movie catalog. `all_movies.json` is the master copy the app reads; the collection files list each built-in festival's movies |
| `vendor/dice-box/` | [dice-box](https://github.com/3d-dice/dice-box) v1.1.4 (MIT), copied unmodified from npm. About 3 MB, only downloaded when 3D dice are used |
| `sw.js` | Offline support |

## Publishing an update

1. Make your changes.
2. If you added a new file under `js/`, add it to the `FILES` list in `sw.js`.
3. Bump `CACHE_VERSION` in `sw.js` (`v4` → `v5`).
4. `git add .`, `git commit -m "what changed"`, `git push`.

`data/` and `vendor/` are deliberately not in `FILES`. They're too big to download at install, and get saved for
offline use the first time the app loads them.

## Editing the movie data

Edit `data/all_movies.json` (the master copy). The app reads it directly; no build step. The per-festival
`*_movies.json` files are reference copies and aren't used by the app.

## Adding a built-in festival

Add an entry to `BUILT_IN_FESTIVALS` in `js/defaults.js`, and a theme set in `js/themes.js` under the same
`themeSet` name. Existing users get it automatically next time they open the app.

## Saved data (version 3)

Stored in localStorage under `roll-credits:data`, on this device only. Settings → Export backup saves a copy.

```
{
  version: 3,
  settings: { diceMode, diceStyle, slotMode, sequels },
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
- Each slot movie has a `catalogId` linking it to `data/all_movies.json`. Movies typed before the catalog existed get
  linked automatically when the catalog loads (exact title + year). A slot that moved on to a sequel keeps the
  original in `base`, which Start fresh restores.
- Logged movies that aren't on a table use the category id `off-menu` ("Off the menu").
- Version 1 and 2 data upgrade automatically. To change the shape again, bump `CURRENT_VERSION` in `store.js`
  and add a step in `migrate()`.

## Rules the app follows

- **Two dice:** the first die picks a category (number of categories = its sides), the second picks a movie.
  Each category has its own movie die. **One die:** a single list, no categories.
- Dice: Coin (2), d4, d6, d8, d12, d20. Shrinking a die warns before removing anything.
- **Dice style** (Settings, 3D by default): 3D dice are thrown across the screen and the number they land on is the
  roll. Flat dice tumble in place. Coin flips always use the CSS 3D coin, in both styles.
- An empty category in a two-dice festival acts as the Wild Card.
- **Keep mode:** watched movies stay in their slot, marked Seen. **Replace mode:** they leave the table.
- **Sequel switching** (Settings, on by default): rolling a movie already seen at this festival offers the next
  unseen movie in its franchise (by `seriesOrder`), skipping any that are already on the tables.
- **Log a movie** (Watched tab): add something watched outside the app. If it's on that festival's tables it's
  linked to that slot, like a normal watch.
- Removing from history: *Didn't finish* goes back to its slot and keeps the note, *Hated it* is removed
  from the table, *Rolled by mistake* is undone.
