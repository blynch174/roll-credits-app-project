# Roll Credits

Roll dice to pick tonight's movie. Each **film festival** (Halloween, Christmas, Awards Season, Kids & Family, Bucket List Cinema, or one you make)
has its own tables, dice, and rating icon. Colors are one app-wide theme (Settings → Themes). Plain HTML, CSS, and JavaScript. No frameworks, no build step.

## Run it on your computer

```
python3 -m http.server 8000
```

Then open http://localhost:8000. (The JS loads as modules, which don't run from a double-clicked file.)

## Files

| File | What it does |
|---|---|
| `index.html` | Screen layout: the Roll, Watched, Popcorn, and Settings tabs, plus the Edit festival screen and the festival creator |
| `css/styles.css` | All styling. Colors come from variables set by `js/themes.js` |
| `js/app.js` | Boot, tab navigation, festival switcher, background loading of the catalog and 3D dice |
| `js/store.js` | Saved data and every change to it, plus upgrading older saved data |
| `js/defaults.js` | Built-in festivals and their starter movies, dice options, category colors, rating icon list |
| `js/themes.js` | The theme library (Classic, Seasonal, Common, Developer picks). One theme for the whole app |
| `js/official.js` | Official festivals: fetches the published versions, caches them, works out what changed |
| `js/icons.js` | SVG drawings for rating icons and flat dice |
| `js/dice.js` | Fair random numbers, the flat dice tumble, and the CSS 3D coin flip |
| `js/dice3d.js` | 3D dice: loads dice-box only when 3D is on, falls back to flat dice if it can't start |
| `js/catalog.js` | Loads `data/all_movies.json`: title search, title matching, franchise lookups |
| `js/autofind.js` | Catalog suggestions under a title box (slot editor and Log a movie) |
| `js/firebase-config.js` | Firebase project settings. `null` = no accounts (everything stays on the device). See `FIREBASE_SETUP.md` |
| `js/cloud.js` | Firebase sign-in and database calls |
| `js/sync.js` | Keeps the device's data and the account's copy in step |
| `js/tutorial.js` | First-run tour (shows on a fresh install; Settings → Show the tutorial replays it) |
| `js/ui.js` | Shared helpers: sheets (with swipe-down to close), toasts, the type-DELETE confirm, dice and coin markup |
| `js/screens/*.js` | One file per screen. `editor.js` is Edit festival (tables + festival settings), `tables.js` draws the tables inside it, `popcorn.js` is the Popcorn tab, `account.js` is the Account section, sign-in sheets, and Admin tools, `admin-official.js` is editing and publishing official festivals, `updates.js` is the update banner and Review sheet, `theme-picker.js` is Settings → Themes |
| `data/` | `all_movies.json` is what the app reads (built, don't hand-edit). `data/catalog/` holds its sources. The collection files list each built-in festival's movies |
| `tools/catalog.py` | Catalog tool: TMDB details and posters, adding movies, Oscar data, building `all_movies.json`. See `CATALOG.md` |
| `js/movieinfo.js` | Posters, the movie details sheet, and IMDb/TMDB links |
| `vendor/firebase/` | Firebase JS SDK 12.19.0 (Apache 2.0): app, auth, firestore-lite. Only downloaded when accounts are set up |
| `firestore.rules` | Database security rules. Paste into the Firebase console (Firestore → Rules) after any change |
| `vendor/dice-box/` | [dice-box](https://github.com/3d-dice/dice-box) v1.1.4 (MIT), copied unmodified from npm. About 3 MB, only downloaded when 3D dice are used |
| `sw.js` | Offline support |

## Publishing an update

1. Make your changes.
2. If you added a new file under `js/`, add it to the `FILES` list in `sw.js`.
3. Bump `CACHE_VERSION` in `sw.js` (`v14` → `v15`).
4. `git add .`, `git commit -m "what changed"`, `git push`.

`data/` and `vendor/` are deliberately not in `FILES`. They're too big to download at install, and get saved for
offline use the first time the app loads them.

## Editing the movie data

See `CATALOG.md`. In short: `data/catalog/curation.json` is yours (moods, franchises, overrides); `tools/catalog.py`
fetches details and posters from TMDB and builds `data/all_movies.json`, the only file the app reads. The
`*_collection.json` files list which catalog movies belong to each built-in festival
(`bucket_list_collection.json` also has each movie's rank).

## Adding a built-in festival

Easiest: Settings → Admin tools → **+ New official festival**, fill it in, Publish. Everyone gets it.
To also ship it inside the app (offline / first launch), add it to `BUILT_IN_FESTIVALS` in `js/defaults.js`;
it then shows up under Admin tools as not published yet. Existing users get code-added festivals automatically. A category can have its own
movie die as a 4th item (`[name, color, movies, 8]`); otherwise it uses the festival's `movieDie`. To give it a
movie list for search and sequels, add its collection file to `COLLECTIONS` in `js/catalog.js`.

## Accounts and sync (optional)

Set up once with `FIREBASE_SETUP.md`. Signing in is optional; without it nothing changes.

- The device copy (localStorage) is still what the app reads and writes, so it works offline. When signed in,
  each change is also saved to `users/{uid}` in Firestore about 1.5 seconds later.
- Opening the app, or switching back to it, pulls the account's copy if another device saved something newer.
  If both changed, the newer save wins.
- Signing in on a device that has its own data, with an account that also has data, asks which to keep.
  A device with untouched defaults just takes the account's data.
- Invite-only: `firestore.rules` only lets admins, or people on the invite list with a confirmed email, read or write
  their data. Admins manage the invite list in Settings → Admin tools. Admins themselves are added in the console.
- Testing locally without a real project: run the Firebase Auth and Firestore emulators and set
  `localStorage['roll-credits:emulator'] = '1'`.

## Official festivals (admins)

The built-in festivals are "official": admins edit and publish them from Settings → Admin tools → Official festivals.

- **First time:** tap *Publish the built-in festivals*. That uploads what's in `defaults.js` as revision 1, so
  nothing changes for anyone.
- **Editing** opens a draft in the normal Edit screen. Drafts save to the database (`drafts/{id}`) as you go and
  show who edited last. Nobody else sees them. Leaving the screen saves and closes the draft.
- **Publish** has two kinds:
  - *New version*: announced with your message. People who never changed that festival get it right away plus a
    "just got an update" banner. People who did get a **Review** banner: Update or Keep mine.
  - *Quick fix*: no announcement. Untouched copies update quietly; edited ones show *Update available* in
    Edit → Festival settings.
- **Update** replaces the festival's tables and dice. Movies that stay keep their slot (notes, sequel progress),
  so Seen marks and history are untouched. Brand-new installs take the latest version without any banner.
- **New official festivals** appear in everyone's list with a *New* badge. **Hide** stops new users getting one;
  people who already have it keep it. **Restore default tables** goes to the latest published version.
- Each copy stores `sourceRev` (the revision it came from) and `sourceSig` (a fingerprint of its tables then),
  which is how the app tells untouched from edited. The bundled `defaults.js` copy is revision 1.

## Themes

One theme for the whole app (`settings.theme`), picked in Settings → Themes. Add or move themes in the
`THEME_GROUPS` list in `js/themes.js`. Never change a theme's id; saved choices point at it.

## Saved data (version 3)

Stored in localStorage under `roll-credits:data` (sync bookkeeping is in `roll-credits:sync`).
Settings → Export backup saves a copy.

```
{
  version: 3,
  settings: { diceMode, diceStyle, slotMode, sequels, theme },
  activeFestival: "halloween",
  festivals: [ { id, name, builtIn, icon, mode: "one"|"two", categoryDie, freshSince,
                 sourceRev, sourceSig, dismissedRev, announce, isNew,   (official festivals only)
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
- **Dice style** (Settings, Flat by default; 3D is in beta and opt-in): 3D dice are thrown across the screen and the number they land on is the
  roll. Flat dice tumble in place. Coin flips always use the CSS 3D coin, in both styles.
- An empty category in a two-dice festival acts as the Wild Card.
- **Keep mode:** watched movies stay in their slot, marked Seen. **Replace mode:** they leave the table.
- **Sequel switching** (Settings, on by default): rolling a movie already seen at this festival offers the next
  unseen movie in its franchise (by `seriesOrder`), skipping any that are already on the tables. Kids & Family and
  Bucket List Cinema only offer sequels that are on their own list (`SEQUELS_IN_LIST` in `catalog.js`).
- **Log a movie** (Watched tab): add something watched outside the app. If it's on that festival's tables it's
  linked to that slot, like a normal watch.
- **Editing a festival:** tap the festival name at the top → **Edit**. Tables and everything specific to that festival
  (dice, look, Start fresh, restore/delete) live there. Settings only holds app-wide options, including the theme.
- **Popcorn Pick** (Popcorn tab): one random movie from the whole catalog, optionally limited to a mood. Every movie
  has an equal chance and watched ones stay in the mix. Watched picks go under their own "Popcorn Pick" label
  (`festivalId: "popcorn"`) and are rated with popcorn.
- **Swipe a watched movie left** to delete it (same as *Rolled by mistake*), with Undo in the toast.
- Removing from history: *Didn't finish* goes back to its slot and keeps the note, *Hated it* is removed
  from the table, *Rolled by mistake* is undone.
- **Kids & Family** has a different movie die per table (d20, d12, d8). **Bucket List Cinema** is Time Out's 100 best
  movies (2026 edition) in rank order, 20 per table, with 6 = Wild Card. Rank 64, the Apu Trilogy, is three films:
  *Pather Panchali* is on the table and the other two follow through sequel switching.
