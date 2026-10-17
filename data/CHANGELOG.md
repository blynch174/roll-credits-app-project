# Roll Credits data: cleanup pass

## v3.10 (2026-10-17): Tear Jerkers

Catalog: 2,114 → 2,160 movies. List: `tearjerkers_collection.json` (145 movies; the List Obsession top 100 keep their `ranks`).

- 37 new movies from the package. *Bicycle Thieves* was listed as new but was already in the catalog.
- *Spoiler Alert* (2022) pointed at the wrong film (tt16969934, "Dana Skvarek II"). Fixed to tt7775720, directed by
  Michael Showalter. *If I Stay* genres fixed (it isn't a comedy).
- 9 extra picks added as new movies: Big Fish, A Monster Calls, Where the Red Fern Grows, The Champ (1979), My Dog Skip,
  Pay It Forward, Deep Impact, Avengers: Endgame, The Iron Claw. 36 movies already in the catalog were tagged into the
  festival too (The Elephant Man, Philadelphia, Kramer vs. Kramer, Room, Casablanca, Still Alice, Logan, …).
- New moods: **Bittersweet** and **Heartbreaking**. Real moods for 137 of the festival's movies (replacing the package's
  lowercase "emotional / bittersweet / heartfelt" and the old generic Awards moods). Scariness/comedy rewritten for the new
  movies (the package had 3/2 on most of them).
- Age rating, countries, and languages for the new movies are left for `tools/catalog.py fetch` to fill from TMDB.
- Oscar fields for the new movies computed from the same Oscar data as the rest of the catalog.

## v3.7 (2026-10-17)

- The catalog is now built from `data/catalog/` (curation, TMDB facts, Oscars) by `tools/catalog.py`. See CATALOG.md.
  The split itself changed no values: the rebuilt `all_movies.json` matches the old one field for field.
- `all_movies.json` is written one movie per line (smaller, cleaner git diffs). New fields once fetched:
  `tmdbId`, `tmdbType`, `posterPath`, `overview`.
- Removed the per-festival reference copies (`halloween_movies.json`, `christmas_movies.json`,
  `kids_family_movies.json`, `bucket_list_movies.json`, `roll_credits_movies_oscars_complete.json`). They duplicated
  `all_movies.json` and would drift. The `*_collection.json` lists stay.

## v3.4 (2026-10-16)

Catalog: 1,952 → 2,114 movies.

**Kids & Family** (`kids_family_movies.json`, `kids_family_collection.json`, 148 movies)
- Dropped *Matilda* (1978), an unrelated film (the real *Matilda* 1996 is on the list), and *Kiki's Delivery Service*
  (2014), the Japanese live-action remake (the 1989 Ghibli film is on the list).
- 117 new to the catalog; 31 were already in it and kept their facts.
- Filled in the blank age ratings, countries, and languages for the 117 new movies.
- Replaced the copied-across moods and scariness/comedy scores with per-movie ones (also for the 31 overlaps; holiday
  movies keep Festive). New mood word: Adventurous.
- *Teenage Mutant Ninja Turtles* (2014) was tagged Animation; it's live action.
- *Back to the Future* rating PG-13 → PG.
- Oscar fields for the new movies rebuilt from the same Oscar data as the rest of the catalog.
- Franchises linked: Toy Story, Harry Potter, Shrek (with Puss in Boots), Back to the Future, Kung Fu Panda,
  How to Train Your Dragon, The Incredibles, Monsters, Inc., Finding Nemo, Inside Out, Jumanji, Night at the Museum,
  The Chronicles of Narnia.

**Bucket List Cinema** (`bucket_list_movies.json`, `bucket_list_collection.json`, 102 movies)
- Source: Time Out, *The 100 best movies of all time*, 2026-09-02 edition. `ranks` in the collection file.
- 57 were already in the catalog. 45 new records (42 films plus the 3 Apu Trilogy films, linked as a franchise).
- IMDb ids filled in for the 52 that had none. Two corrections versus common listings: *Daughters of the Dust* is
  tt0104057, *Killer of Sheep* is tt0076263 and listed under 1978 (its IMDb year; Time Out says 1977).

## Files

| File | Movies | Notes |
|---|---|---|
| `halloween_movies.json` + `halloween_collection.json` | 405 | was 400 |
| `christmas_movies.json` + `christmas_collection.json` | 407 | was 400 |
| `roll_credits_movies_oscars_complete.json` + `roll_credits_oscars.json` | 1,187 | was 1,185 |
| `roll_credits_oscar_snubs.json` | 668 | was 667 |
| `all_movies.json` | 1,952 | **New.** Every movie once, no duplicates, sorted by year. The collection files point into it by `id`. |

Same field layout as before (25 fields). Every check passes: unique IDs and IMDb IDs, every ID ends in its
`releaseYear`, collections match their movie files exactly, wins never exceed nominations, no duplicate
franchise order numbers.

## Oscar fields rebuilt for every movie

All Oscar fields in all three files were rebuilt from the same source the Oscars package used
(DLu/oscar_data `oscars.csv`, ceremonies 1–98), matched on IMDb ID. The Oscars file came out unchanged,
which confirms the rebuild follows the same rules. Category names now use the same style everywhere
("ACTOR IN A LEADING ROLE", "BEST PICTURE", ...).

30 holiday movies had wrong Oscar numbers (nominations / wins):

- Halloween: Bride of Frankenstein 0→1, Them! 0→1, Kwaidan 0→1, Rosemary's Baby 0→2 (1 win), The Addams Family 0→1, Addams Family Values 0→1
- Christmas: The Thin Man 0→4, The Night Before Christmas (1941) 0→1, It Happened on Fifth Avenue 0→1, Bell, Book and Candle 0→2,
  The Poseidon Adventure 0→9 (2 wins), Three Days of the Condor 0→1, Mickey's Christmas Carol 0→1, Brazil 0→2, The Dead 0→2,
  Die Hard 0→4, When Harry Met Sally... 0→1, Home Alone 0→2, Metropolitan 0→1, Sleepless in Seattle 0→2, Bridget Jones's Diary 0→1,
  About a Boy 0→1, Joyeux Noel 0→1, In Bruges 0→1, The Girl with the Dragon Tattoo 0→5 (1 win), Iron Man 3 0→1, Spencer 0→1
- Wrong numbers removed: Little Women (1994) had the 2019 version's numbers (6/1 → 3/0); Miracle on 34th Street (1994) had the 1947
  version's (4/3 → 0/0); Arthur Christmas had a nomination it never got (1 → 0)

## Other fixes

- Scream (2022) series order 1 → 5, Scream VI 5 → 6
- IDs now match `releaseYear`: `cronos-1993` → `cronos-1992`, `a-quiet-place-part-ii-2021` → `-2020`, `the-night-house-2021` → `-2020` (collections updated)
- Fanny and Alexander runtime 322 (TV cut) → 188 (theatrical)
- Franchise links added so sequel switching works: Die Hard (1988) #1, Cloverfield (2008) #1, Frosty the Snowman #1–3

## Added (movies on the app's premade tables that were missing)

IMDb IDs found by search on imdb.com; runtime, country, language, and director from Wikipedia; Oscar fields from the source CSV.
Genres, moods, and scariness/comedy were set by hand using the existing mood vocabulary.

- Halloween: Something Wicked This Way Comes (1983), Elvira: Mistress of the Dark (1988), Dead Alive (1992, original title Braindead),
  The Blackcoat's Daughter (2015), 10 Cloverfield Lane (2016, Cloverfield #2)
- Christmas: Frosty the Snowman (1969), Silent Night, Deadly Night (1984), Die Hard 2 (1990, Die Hard #2), The Princess Switch (2018),
  Fatman (2020), Happiest Season (2020), Silent Night (2021)
- Oscars: All About Eve (1950), Rebel Without a Cause (1955, also added to Snubs: major nominations, no major wins)

## Duplicate check

- No duplicate movies inside any file, and no ID used for two different movies.
- 47 movies appear in more than one list on purpose (19 Halloween + Oscars, 22 Christmas + Oscars, 6 Halloween + Christmas).
  Each one has the same ID and an identical record in every file it appears in.
- No hidden duplicates (same title, release year within 1, different IMDb ID).
- 40 titles are shared by different movies, all real remakes or separate films (Halloween 1978/2007/2018, Black Christmas 1974/2006/2019,
  five versions of A Christmas Carol, etc.).

## Left as-is (decide later)

- **Oscars file placeholder metadata.** Most of the 1,146 Oscar-only movies still have default countries (US), languages (English),
  content ratings (mostly PG-13), moods, and scariness/comedy scores. Needs a real source before mood or country filters are built.
- **Vertigo is in Snubs** with no major nomination. That breaks the "nominated but lost" rule, but it is the most famous snub there is,
  so it looks intentional.
- **Two premade titles differ from the catalog**: the app says "Santa Claus: The Movie" (catalog: "Santa Claus", 1985) and
  "Dr. Strangelove" (catalog: full title). Same movies. Matching on ID instead of title avoids this.
- 30% of the Christmas file is TV movies; `type` can filter them.
