# Roll Credits data: cleanup pass

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
