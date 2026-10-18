# The movie catalog

The app reads one file: `data/all_movies.json`. You don't edit that file by hand anymore. It's built from three
files in `data/catalog/` by `tools/catalog.py`:

| File | Who writes it | What's in it |
|---|---|---|
| `curation.json` | **You** | One line per movie: id, IMDb id, title, year, moods, scariness, comedy, franchise. Optional `"overrides"` |
| `facts.json` | `fetch` | From TMDB: runtime, US rating, countries, languages, genres, directors, poster, summary |
| `oscars.json` | `oscars` | Oscar nominations and wins |

The script only needs Python 3 (already on your Mac; check with `python3 --version` in the VS Code terminal).

## Automatic: GitHub Actions (recommended)

`.github/workflows/catalog.yml` runs on every push. It fetches details and posters for movies that don't have them
yet (everything that already has a poster is skipped), rebuilds `data/all_movies.json`, and commits both files
back to the repo. Its own commit doesn't start it again.

One-time setup: GitHub repo → **Settings → Secrets and variables → Actions → New repository secret**.
Name `TMDB_TOKEN`, value your **API Read Access Token** (the long one starting with `eyJ`).

- After it commits, run `git pull` before your next push.
- To redo everything (picks up TMDB corrections) or retry movies it couldn't match: **Actions → Update movie
  catalog → Run workflow**, and tick *refresh* or *retry*.
- Movies TMDB can't match are remembered and skipped next time. Fix their IMDb id or title in `curation.json`,
  then use *retry*.

The rest of this page is for running it on your own computer instead.

## One-time setup: your TMDB key

1. In VS Code, create a file called **`tools/tmdb_key.txt`**.
2. Paste your **API Read Access Token** (the long one starting with `eyJ`) into it and save. Nothing else in the file.

`.gitignore` keeps that file out of GitHub. Run `git status` once to make sure it isn't listed.

## First run: get posters and details for everything

In the VS Code terminal, from the repo folder:

```
python3 tools/catalog.py fetch
```

It looks up all ~2,100 movies (a few minutes) and saves as it goes, so if it stops you can run it again and it
picks up where it left off. Then:

```
python3 tools/catalog.py check
```

That lists anything TMDB couldn't match, movies without a poster, and titles or years that look off. A year that's
2+ years off usually means a wrong IMDb id in `curation.json`.

Then bump `CACHE_VERSION` in `sw.js`, and commit and push like normal.

## Adding a movie

```
python3 tools/catalog.py add "Late Night with the Devil" 2023 --to halloween
```

It finds the movie on TMDB (asks you to pick if there's more than one), adds a line to `curation.json`, fetches its
details and poster, and rebuilds. `--to` also puts it on that festival's list (`halloween`, `christmas`, `awards`,
`kids`, `bucketlist`). Leave `--to` off to just add it to the catalog.

Then open `data/catalog/curation.json`, find the new line at the bottom, and fill in its moods, for example
`"moodTone": ["Unsettling", "Atmospheric", "Macabre"]`. Run `python3 tools/catalog.py build` after editing.

## Fixing something

- **TMDB has it wrong** (rating, runtime, anything): add an override to that movie's line in `curation.json`, like
  `"overrides": {"contentRating": "PG", "runtimeMinutes": 96}`, then `build`. Overrides always win.
- **Matched the wrong movie on TMDB:** add `"tmdbId": 12345` (the number in the movie's TMDB address) to its line, then
  `fetch --refresh`.
- **Moods, scariness, comedy, franchise:** edit `curation.json`, then `build`.

## Other commands

| Command | What it does |
|---|---|
| `python3 tools/catalog.py build` | Rebuilds `data/all_movies.json` from the three files. Run after any hand edit |
| `python3 tools/catalog.py fetch --refresh` | Re-downloads TMDB details for every movie (picks up their corrections) |
| `python3 tools/catalog.py fetch --retry` | Tries again for movies TMDB didn't match before |
| `python3 tools/catalog.py oscars` | Downloads the latest Oscar data and redoes every movie's Oscar fields (after each ceremony) |
| `python3 tools/catalog.py check` | The report described above |

## How the pieces fit

- **Your fields always win.** Title, year, and id come from `curation.json`, never from TMDB, so the festival
  tables keep matching.
- **Franchises:** yours win. Movies without one get it from TMDB's collections ("Toy Story Collection" → `Toy
  Story`) when two or more catalog movies share a collection, numbered by release year.
- **Posters** load from TMDB's image server (`image.tmdb.org`), which needs no key. The key is only used by the
  script on your computer.
- **Credit:** TMDB's terms ask for their logo and the line in Settings → About. You can drop their official logo
  (themoviedb.org/about/logos-attribution) into `icons/` later.
