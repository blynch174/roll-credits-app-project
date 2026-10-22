#!/usr/bin/env python3
"""Roll Credits movie catalog tool. Run it on your own computer (it needs your TMDB key). See CATALOG.md.

  python3 tools/catalog.py fetch            Get details + posters from TMDB for movies that don't have them yet
  python3 tools/catalog.py fetch --refresh  Re-fetch every movie (picks up TMDB corrections)
  python3 tools/catalog.py fetch --retry    Also try again for movies TMDB didn't match last time
  python3 tools/catalog.py add "Terrifier" 2016 --to halloween
                                            Add a movie (finds it on TMDB, then builds)
  python3 tools/catalog.py oscars           Re-download the Oscar data and rebuild every movie's Oscar fields
  python3 tools/catalog.py requests         Add movies admins approved in the app (Admin Tools → Movie Requests)
  python3 tools/catalog.py build            Merge everything into data/all_movies.json (the file the app reads)
  python3 tools/catalog.py check            List movies missing a poster, moods, or a TMDB match

Files (in data/catalog/):
  curation.json  YOURS. One line per movie: id, IMDb id, title, year, moods, scariness, comedy, franchise.
                 Optional "overrides": {"contentRating": "PG"} beats anything TMDB says.
  facts.json     Written by `fetch`: runtime, rating, countries, languages, genres, directors, poster, summary.
  oscars.json    Written by `oscars`: nominations and wins.
Only Python 3 is needed (no installs). Your key is read from tools/tmdb_key.txt or the TMDB_TOKEN variable.
"""
import csv, io, json, os, re, sys, time, unicodedata, urllib.error, urllib.parse, urllib.request
from collections import defaultdict

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CAT = os.path.join(ROOT, 'data', 'catalog')
CURATION = os.path.join(CAT, 'curation.json')
FACTS = os.path.join(CAT, 'facts.json')
OSCARS = os.path.join(CAT, 'oscars.json')
OUT = os.path.join(ROOT, 'data', 'all_movies.json')
KEY_FILE = os.path.join(ROOT, 'tools', 'tmdb_key.txt')
API = os.environ.get('TMDB_API_BASE', 'https://api.themoviedb.org/3')
OSCAR_CSV_URL = os.environ.get('OSCAR_CSV_URL', 'https://raw.githubusercontent.com/DLu/oscar_data/main/oscars.csv')
COLLECTIONS = {  # festival id -> its list of movie ids (the app ranks these first in search)
    'halloween': 'halloween_collection.json', 'christmas': 'christmas_collection.json', 'awards': 'roll_credits_oscars.json',
    'kids': 'kids_family_collection.json', 'bucketlist': 'bucket_list_collection.json', 'tearjerkers': 'tearjerkers_collection.json',
    'boomer': 'boomer_collection.json', 'genx': 'genx_collection.json',
}

# Field order in data/all_movies.json
OUT_KEYS = ['id', 'imdbId', 'imdbLink', 'tmdbId', 'tmdbType', 'title', 'originalTitle', 'releaseYear', 'type', 'runtimeMinutes',
            'contentRating', 'countries', 'languages', 'genres', 'directors', 'posterPath', 'overview', 'moodTone', 'scariness',
            'comedy', 'franchise', 'seriesOrder', 'oscarCeremony', 'oscarNominationsTotal', 'oscarWinsTotal',
            'oscarNominationCategories', 'oscarWinCategories', 'oscarMajorNoms', 'oscarMajorWins']
FACT_KEYS = ['originalTitle', 'runtimeMinutes', 'contentRating', 'countries', 'languages', 'genres', 'directors']
OSCAR_EMPTY = dict(oscarCeremony=None, oscarNominationsTotal=0, oscarWinsTotal=0, oscarNominationCategories=[],
                   oscarWinCategories=[], oscarMajorNoms=[], oscarMajorWins=[])
COUNTRY_NAMES = {'United States of America': 'United States'}
GENRE_NAMES = {'Science Fiction': 'Sci-Fi'}


# ---------- files ----------

def read(path, default):
    try:
        with open(path, encoding='utf-8') as f:
            return json.load(f)
    except FileNotFoundError:
        return default

def write_lines(path, obj):
    """One record per line: easy to read, and git diffs stay small."""
    with open(path, 'w', encoding='utf-8') as f:
        if isinstance(obj, list):
            f.write('[\n' + ',\n'.join(json.dumps(x, ensure_ascii=False) for x in obj) + '\n]\n')
        else:
            f.write('{\n' + ',\n'.join(json.dumps(k, ensure_ascii=False) + ': ' + json.dumps(v, ensure_ascii=False)
                                       for k, v in obj.items()) + '\n}\n')

def slug(title, year):
    s = unicodedata.normalize('NFKD', title).encode('ascii', 'ignore').decode().lower()
    s = s.replace('&', ' ')  # "Marley & Me" -> marley-me, like the rest of the catalog
    s = re.sub(r'[^a-z0-9]+', '-', s).strip('-')
    return f'{s}-{year}'


# ---------- TMDB ----------

def token():
    t = os.environ.get('TMDB_TOKEN', '').strip()
    if not t and os.path.exists(KEY_FILE):
        t = open(KEY_FILE, encoding='utf-8').read().strip()
    if not t:
        sys.exit('No TMDB key. Put your API Read Access Token in tools/tmdb_key.txt (that file never gets committed).')
    return t

def tmdb(path, **params):
    t = token()
    headers = {'Accept': 'application/json'}
    if t.startswith('eyJ'):  # the long "API Read Access Token"
        headers['Authorization'] = 'Bearer ' + t
    else:                    # the short "API Key"
        params['api_key'] = t
    url = f'{API}{path}' + ('?' + urllib.parse.urlencode(params) if params else '')
    for attempt in range(5):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers=headers), timeout=20) as r:
                return json.load(r)
        except urllib.error.HTTPError as e:
            if e.code == 404:
                return None
            if e.code == 401:
                sys.exit('TMDB says the key is wrong (401). Check tools/tmdb_key.txt.')
            if e.code == 429:
                time.sleep(float(e.headers.get('Retry-After', 2)))
                continue
            if attempt == 4:
                raise
            time.sleep(1 + attempt)
        except urllib.error.URLError as e:
            if 'CERTIFICATE_VERIFY_FAILED' in str(e):
                sys.exit('Python can\'t verify HTTPS certificates. On a Mac with the python.org installer, run\n'
                         '"Install Certificates.command" from Applications → Python 3.x, then try again.')
            if attempt == 4:
                raise
            time.sleep(1 + attempt)
    return None

def us_rating(release_dates):
    for r in (release_dates or {}).get('results', []):
        if r.get('iso_3166_1') != 'US':
            continue
        certs = [d for d in r.get('release_dates', []) if d.get('certification')]
        certs.sort(key=lambda d: (d.get('type') != 3, d.get('release_date') or ''))  # theatrical first
        if certs:
            return certs[0]['certification']
    return None

def movie_facts(tid):
    d = tmdb(f'/movie/{tid}', append_to_response='release_dates,credits,external_ids')
    if not d:
        return None
    col = d.get('belongs_to_collection')
    return {
        'tmdbId': d['id'], 'tmdbType': 'movie',
        'tmdbTitle': d.get('title'), 'tmdbYear': int(d['release_date'][:4]) if d.get('release_date') else None,
        'originalTitle': d.get('original_title') if d.get('original_title') != d.get('title') else None,
        'runtimeMinutes': d.get('runtime') or None,
        'contentRating': us_rating(d.get('release_dates')),
        'countries': [COUNTRY_NAMES.get(c['name'], c['name']) for c in d.get('production_countries', [])],
        'languages': [l.get('english_name') or l.get('name') for l in d.get('spoken_languages', [])],
        'genres': [GENRE_NAMES.get(g['name'], g['name']) for g in d.get('genres', [])],
        'directors': [c['name'] for c in (d.get('credits') or {}).get('crew', []) if c.get('job') == 'Director'],
        'posterPath': d.get('poster_path'),
        'overview': trim(d.get('overview')),
        'collection': {'id': col['id'], 'name': col['name']} if col else None,
        'imdbId': (d.get('external_ids') or {}).get('imdb_id') or d.get('imdb_id'),
        'source': 'tmdb', 'fetchedAt': time.strftime('%Y-%m-%d'),
    }

def tv_facts(tid):
    d = tmdb(f'/tv/{tid}', append_to_response='content_ratings,external_ids')
    if not d:
        return None
    rating = next((r['rating'] for r in (d.get('content_ratings') or {}).get('results', []) if r.get('iso_3166_1') == 'US'), None)
    return {
        'tmdbId': d['id'], 'tmdbType': 'tv',
        'tmdbTitle': d.get('name'), 'tmdbYear': int(d['first_air_date'][:4]) if d.get('first_air_date') else None,
        'runtimeMinutes': (d.get('episode_run_time') or [None])[0], 'contentRating': rating,
        'genres': [g['name'] for g in d.get('genres', [])],
        'posterPath': d.get('poster_path'), 'overview': trim(d.get('overview')),
        'collection': None, 'source': 'tmdb', 'fetchedAt': time.strftime('%Y-%m-%d'),
    }

def trim(text, n=420):
    text = (text or '').strip()
    if len(text) <= n:
        return text or None
    cut = text[:n].rsplit(' ', 1)[0].rstrip(',;:.')
    return cut + '…'

def find_on_tmdb(m):
    """IMDb id first (exact). Falls back to a title + year search."""
    if m.get('tmdbId'):
        return (m.get('tmdbType') or 'movie', m['tmdbId'])
    if m.get('imdbId'):
        r = tmdb(f"/find/{m['imdbId']}", external_source='imdb_id') or {}
        if r.get('movie_results'):
            return ('movie', r['movie_results'][0]['id'])
        if r.get('tv_results'):
            return ('tv', r['tv_results'][0]['id'])
    r = tmdb('/search/movie', query=m['title'], year=m['releaseYear']) or {}
    if r.get('results'):
        return ('movie', r['results'][0]['id'])
    return None


# ---------- commands ----------

ADDITIONS = os.path.join(ROOT, 'data', 'additions')

def merge_additions():
    """New movies shipped with app updates (data/additions/*.json) join curation.json once. Movies already there
    (same id, or same title + year) are skipped, so this is safe to run every time."""
    if not os.path.isdir(ADDITIONS):
        return 0
    cur = read(CURATION, [])
    ids = {m['id'] for m in cur}
    keys = {(m['title'].lower(), m['releaseYear']) for m in cur}
    added = 0
    for name in sorted(os.listdir(ADDITIONS)):
        if not name.endswith('.json'):
            continue
        for m in read(os.path.join(ADDITIONS, name), {}).get('movies', []):
            if m['id'] in ids or (m['title'].lower(), m['releaseYear']) in keys:
                continue
            cur.append(m); ids.add(m['id']); keys.add((m['title'].lower(), m['releaseYear'])); added += 1
    if added:
        write_lines(CURATION, cur)
        print(f'Added {added} new movies from data/additions/.')
    return added

def cmd_fetch(args):
    merge_additions()
    cur = read(CURATION, [])
    facts = read(FACTS, {})
    refresh = '--refresh' in args
    retry = refresh or '--retry' in args
    def needs(m):
        f = facts.get(m['id'], {})
        if refresh:
            return True
        if f.get('source') == 'tmdb':
            return False  # already has its details and poster
        return retry or not f.get('tmdbMissing')  # no match last time: skip unless asked to retry
    todo = [m for m in cur if needs(m)]
    print(f'Fetching {len(todo)} of {len(cur)} movies from TMDB…')
    missing = []
    for i, m in enumerate(todo, 1):
        hit = find_on_tmdb(m)
        f = None
        if hit:
            f = movie_facts(hit[1]) if hit[0] == 'movie' else tv_facts(hit[1])
        if not f:
            missing.append(m['id'])
            facts[m['id']] = {**facts.get(m['id'], {}), 'tmdbMissing': True}  # remembered, so the next run skips it
        else:
            old = facts.get(m['id'], {})
            # keep earlier hand-entered values where TMDB has nothing
            for k in FACT_KEYS:
                if f.get(k) in (None, [], '') and old.get(k) not in (None, [], ''):
                    f[k] = old[k]
            if f.get('imdbId') and m.get('imdbId') and f['imdbId'] != m['imdbId']:
                print(f"  ! {m['id']}: TMDB links a different IMDb id ({f['imdbId']}). Check it.")
            facts[m['id']] = f
        if i % 25 == 0 or i == len(todo):
            print(f'  {i}/{len(todo)}')
            write_lines(FACTS, facts)  # save as we go, so stopping halfway loses nothing
        time.sleep(0.03)
    write_lines(FACTS, facts)
    if missing:
        print(f'\nNo TMDB match for {len(missing)}: ' + ', '.join(missing[:20]) + (' …' if len(missing) > 20 else ''))
        print('These are skipped next time. Fix their IMDb id or title in curation.json, then run fetch --retry.')
        print('Add "tmdbId": <number> to those lines in curation.json and run fetch again.')
    cmd_build([])

def cmd_add(args):
    if len(args) < 2 or not args[1].isdigit():
        sys.exit('Usage: python3 tools/catalog.py add "Title" YEAR [--to halloween]')
    title, year = args[0], int(args[1])
    fest = args[args.index('--to') + 1] if '--to' in args else None
    r = tmdb('/search/movie', query=title, year=year) or {}
    results = r.get('results', [])[:6]
    if not results:
        sys.exit(f'Nothing on TMDB for "{title}" ({year}). Check the spelling and year.')
    pick = results[0]
    exact = [x for x in results if x.get('title', '').lower() == title.lower() and (x.get('release_date') or '')[:4] == str(year)]
    if len(exact) == 1:
        pick = exact[0]
    elif len(results) > 1:
        for n, x in enumerate(results, 1):
            print(f"  {n}. {x.get('title')} ({(x.get('release_date') or '????')[:4]})  tmdb {x['id']}")
        choice = input('Which one? [1] ').strip() or '1'
        pick = results[int(choice) - 1]
    f = movie_facts(pick['id'])
    cur = read(CURATION, [])
    mid = slug(title, year)
    existing = next((m for m in cur if m['id'] == mid or (f.get('imdbId') and m.get('imdbId') == f['imdbId'])), None)
    if existing:
        mid = existing['id']
        print(f'{title} ({year}) is already in the catalog as "{mid}".')
    else:
        cur.append({'id': mid, 'imdbId': f.get('imdbId'), 'tmdbId': f['tmdbId'], 'title': title, 'releaseYear': year,
                    'type': 'Feature Film', 'moodTone': [], 'scariness': None, 'comedy': None, 'franchise': None, 'seriesOrder': None})
        write_lines(CURATION, cur)
        facts = read(FACTS, {})
        facts[mid] = f
        write_lines(FACTS, facts)
        print(f'Added {title} ({year}) as "{mid}". Give it moods (and scariness/comedy) in data/catalog/curation.json.')
    if fest:
        path = os.path.join(ROOT, 'data', COLLECTIONS.get(fest, f'{fest}_collection.json'))
        col = read(path, {'id': fest, 'name': fest, 'movieIds': []})
        if mid not in col['movieIds']:
            col['movieIds'].append(mid)
            with open(path, 'w', encoding='utf-8') as fh:
                json.dump(col, fh, ensure_ascii=False, indent=2); fh.write('\n')
            print(f'Added to the {fest} list.')
    cmd_build([])

# ---------- approved movie requests (Firestore) ----------

FIRESTORE = os.environ.get('FIRESTORE_BASE', 'https://firestore.googleapis.com')

def firebase_project():
    pid = os.environ.get('FIREBASE_PROJECT_ID', '').strip()
    if pid:
        return pid
    path = os.path.join(ROOT, 'js', 'firebase-config.js')
    if os.path.exists(path):
        m = re.search(r'projectId\s*:\s*[\'"]([^\'"]+)', open(path, encoding='utf-8').read())
        if m:
            return m.group(1)
    return None

def fs_value(v):
    if 'stringValue' in v: return v['stringValue']
    if 'integerValue' in v: return int(v['integerValue'])
    if 'doubleValue' in v: return v['doubleValue']
    if 'booleanValue' in v: return v['booleanValue']
    if 'arrayValue' in v: return [fs_value(x) for x in v['arrayValue'].get('values', [])]
    return None

def approved_requests(pid):
    """Movie requests are public to read (no personal info), so no key is needed."""
    out, token = [], ''
    while True:
        url = f'{FIRESTORE}/v1/projects/{pid}/databases/(default)/documents/requests?pageSize=300'
        if token:
            url += '&pageToken=' + urllib.parse.quote(token)
        with urllib.request.urlopen(url, timeout=30) as r:
            d = json.loads(r.read().decode('utf-8'))
        for doc in d.get('documents', []):
            f = {k: fs_value(v) for k, v in doc.get('fields', {}).items()}
            if f.get('status') == 'approved' and f.get('tmdbId'):
                out.append(f)
        token = d.get('nextPageToken')
        if not token:
            return out

def cmd_requests(args):
    pid = firebase_project()
    if not pid:
        sys.exit('No Firebase project id (set FIREBASE_PROJECT_ID, or fill in js/firebase-config.js).')
    try:
        approved = approved_requests(pid)
    except urllib.error.HTTPError as e:
        sys.exit(f'Could not read movie requests ({e.code}). Are the latest firestore.rules published?')
    cur = read(CURATION, [])
    facts = read(FACTS, {})
    have_tmdb = {m.get('tmdbId') for m in cur} | {f.get('tmdbId') for f in facts.values() if f.get('tmdbType', 'movie') == 'movie'}
    have_imdb = {m.get('imdbId') for m in cur if m.get('imdbId')}
    ids = {m['id'] for m in cur}
    added = 0
    for r in approved:
        tid = int(r['tmdbId'])
        if tid in have_tmdb:
            continue
        f = movie_facts(tid)
        if not f or not f.get('tmdbYear'):
            print(f'  ! TMDB {tid} ({r.get("title")}): no details on TMDB, skipped.')
            continue
        if f.get('imdbId') and f['imdbId'] in have_imdb:
            continue  # already in the catalog under another TMDB entry
        title, year = f['tmdbTitle'], f['tmdbYear']
        mid = slug(title, year)
        if mid in ids:
            mid = f'{mid}-{tid}'
        cur.append({'id': mid, 'imdbId': f.get('imdbId'), 'tmdbId': tid, 'title': title, 'releaseYear': year,
                    'type': 'Feature Film', 'moodTone': [m for m in (r.get('moods') or []) if isinstance(m, str)],
                    'scariness': None, 'comedy': None, 'franchise': None, 'seriesOrder': None, 'requested': True})
        facts[mid] = f
        ids.add(mid); have_tmdb.add(tid)
        added += 1
        print(f'  + {title} ({year}) as "{mid}"')
    if added:
        write_lines(CURATION, cur)
        write_lines(FACTS, facts)
    print(f'Approved requests: {len(approved)}. Newly added to the catalog: {added}.')

MAJOR = {'BEST PICTURE': 'picture', 'DIRECTING': 'director', 'ACTOR IN A LEADING ROLE': 'actor', 'ACTRESS IN A LEADING ROLE': 'actress',
         'ACTOR IN A SUPPORTING ROLE': 'supportingActor', 'ACTRESS IN A SUPPORTING ROLE': 'supportingActress',
         'WRITING (Original Screenplay)': 'originalScreenplay', 'WRITING (Adapted Screenplay)': 'adaptedScreenplay'}

def cmd_oscars(args):
    src = args[args.index('--csv') + 1] if '--csv' in args else None
    if src:
        text = open(src, encoding='utf-8').read()
    else:
        print('Downloading Oscar data…')
        with urllib.request.urlopen(OSCAR_CSV_URL, timeout=60) as r:
            text = r.read().decode('utf-8')
    by = defaultdict(list)
    for row in csv.DictReader(io.StringIO(text), delimiter='\t'):
        for fid in filter(None, (row.get('FilmId') or '').split('|')):
            by[fid].append(row)
    out = {}
    for m in read(CURATION, []):
        rows = by.get(m.get('imdbId'))
        if not rows:
            continue
        noms, wins, mn, mw = [], [], [], []
        for r in rows:
            c = r['CanonicalCategory']
            if c not in noms: noms.append(c)
            if r['Winner'] == 'True' and c not in wins: wins.append(c)
            k = MAJOR.get(c)
            if k and k not in mn: mn.append(k)
            if k and r['Winner'] == 'True' and k not in mw: mw.append(k)
        out[m['id']] = dict(oscarCeremony=max(int(r['Ceremony']) for r in rows), oscarNominationsTotal=len(rows),
                            oscarWinsTotal=sum(r['Winner'] == 'True' for r in rows), oscarNominationCategories=noms,
                            oscarWinCategories=wins, oscarMajorNoms=mn, oscarMajorWins=mw)
    write_lines(OSCARS, out)
    print(f'Oscar data for {len(out)} movies.')
    cmd_build([])

def cmd_build(args):
    cur = read(CURATION, [])
    facts = read(FACTS, {})
    osc = read(OSCARS, {})
    ids = [m['id'] for m in cur]
    dupes = {i for i in ids if ids.count(i) > 1}
    if dupes:
        sys.exit('Duplicate ids in curation.json: ' + ', '.join(sorted(dupes)))

    # Franchises from TMDB collections, for movies you haven't given one (2+ catalog movies in the collection).
    groups = defaultdict(list)
    for m in cur:
        c = (facts.get(m['id']) or {}).get('collection')
        if c and not m.get('franchise'):
            groups[c['id']].append(m)
    auto = {}
    for cid, members in groups.items():
        if len(members) < 2:
            continue
        name = re.sub(r'\s+Collection$', '', facts[members[0]['id']]['collection']['name'])
        for n, m in enumerate(sorted(members, key=lambda x: x['releaseYear']), 1):
            auto[m['id']] = (name, n)

    out = []
    for m in cur:
        f = facts.get(m['id'], {})
        rec = {k: None for k in OUT_KEYS}
        rec.update({k: m.get(k) for k in ('id', 'imdbId', 'title', 'releaseYear', 'type', 'moodTone', 'scariness', 'comedy',
                                          'franchise', 'seriesOrder')})
        rec['imdbId'] = m.get('imdbId') or f.get('imdbId')
        rec['imdbLink'] = f"https://www.imdb.com/title/{rec['imdbId']}/" if rec['imdbId'] else None
        rec['tmdbId'] = m.get('tmdbId') or f.get('tmdbId')
        rec['tmdbType'] = f.get('tmdbType') or ('movie' if rec['tmdbId'] else None)
        for k in FACT_KEYS:
            rec[k] = f.get(k)
        for k in ('countries', 'languages', 'genres', 'directors'):
            rec[k] = rec[k] or []
        rec['posterPath'] = f.get('posterPath')
        rec['overview'] = f.get('overview')
        rec['moodTone'] = rec['moodTone'] or []
        if not rec['franchise'] and m['id'] in auto:
            rec['franchise'], rec['seriesOrder'] = auto[m['id']]
        rec.update(osc.get(m['id'], OSCAR_EMPTY))
        for k, v in (m.get('overrides') or {}).items():  # your fixes win
            rec[k] = v
        out.append(rec)

    with open(OUT, 'w', encoding='utf-8') as fh:
        fh.write('[\n' + ',\n'.join(json.dumps(r, ensure_ascii=False, separators=(',', ':')) for r in out) + '\n]\n')
    posters = sum(1 for r in out if r['posterPath'])
    print(f'Built data/all_movies.json: {len(out)} movies, {posters} with posters, {len(auto)} given a franchise from TMDB.')
    print('Next: bump CACHE_VERSION in sw.js, then commit and push.')

def cmd_check(args):
    cur = read(CURATION, [])
    facts = read(FACTS, {})
    no_tmdb = [m['id'] for m in cur if facts.get(m['id'], {}).get('source') != 'tmdb' and not m.get('tmdbId')]
    no_poster = [m['id'] for m in cur if not facts.get(m['id'], {}).get('posterPath')]
    no_moods = [m['id'] for m in cur if not m.get('moodTone')]
    renamed = [(m['id'], facts[m['id']]['tmdbTitle']) for m in cur
               if facts.get(m['id'], {}).get('tmdbTitle') and facts[m['id']]['tmdbTitle'].lower() != m['title'].lower()]
    year_off = [(m['id'], facts[m['id']]['tmdbYear']) for m in cur
                if facts.get(m['id'], {}).get('tmdbYear') and abs(facts[m['id']]['tmdbYear'] - m['releaseYear']) > 1]
    def show(label, items):
        print(f'{label}: {len(items)}')
        for x in items[:30]:
            print('   ', x)
        if len(items) > 30:
            print(f'    … and {len(items) - 30} more')
    show('Not matched on TMDB yet (run fetch)', no_tmdb)
    show('No poster', no_poster)
    show('No moods (Popcorn Pick can only find them with no mood picked)', no_moods)
    show('TMDB uses a different title (yours is kept)', renamed)
    show('TMDB year is 2+ years off (check the IMDb id)', year_off)

COMMANDS = {'fetch': cmd_fetch, 'add': cmd_add, 'oscars': cmd_oscars, 'build': cmd_build, 'check': cmd_check,
            'requests': cmd_requests}

if __name__ == '__main__':
    if len(sys.argv) < 2 or sys.argv[1] not in COMMANDS:
        print(__doc__)
        sys.exit(1)
    COMMANDS[sys.argv[1]](sys.argv[2:])
