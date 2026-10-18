// Change tracking and merging, so edits made on two devices both survive a sync.
//
// Every saved state carries a small `sync` record:
//   sync.at   = { f: {festivalId: time}, h: {historyId: time}, s: {movieId: time}, settings: time }
//               when each item was last changed on any device
//   sync.gone = { f: {...}, h: {...}, s: {...} }   when each item was deleted
// stamp() fills these in by comparing the state with what was last saved. merge() combines two states item by
// item: the most recent change wins, and a deletion wins over anything older than it.

const KINDS = [
  { k: 'f', list: 'festivals', key: (x) => x.id },
  { k: 'h', list: 'history', key: (x) => x.id },
  { k: 's', list: 'savedPicks', key: (x) => x.movieId },
];
const KEEP_GONE = 120 * 24 * 3600 * 1000; // deletions are remembered this long (another device may be offline)

export function emptySync() {
  return { at: { f: {}, h: {}, s: {}, settings: 0 }, gone: { f: {}, h: {}, s: {} } };
}

// Makes sure d.sync exists and has the right shape (older data, or data from another source).
export function ensureSync(d) {
  const s = d.sync && typeof d.sync === 'object' ? d.sync : {};
  const obj = (o) => (o && typeof o === 'object' && !Array.isArray(o) ? o : {});
  const at = obj(s.at);
  const gone = obj(s.gone);
  d.sync = {
    at: { f: obj(at.f), h: obj(at.h), s: obj(at.s), settings: Number(at.settings) || 0 },
    gone: { f: obj(gone.f), h: obj(gone.h), s: obj(gone.s) },
  };
  return d.sync;
}

// What each item looked like at the last save. Built from a state; compared against on the next save.
export function baselineOf(d) {
  const b = { settings: JSON.stringify(d.settings || {}) };
  for (const { k, list, key } of KINDS) {
    b[k] = new Map();
    for (const x of d[list] || []) b[k].set(key(x), JSON.stringify(x));
  }
  return b;
}

// Records what changed since `base`. Returns the new baseline.
export function stamp(d, base, now = Date.now()) {
  const sync = ensureSync(d);
  const next = baselineOf(d);
  if (!base) return next;
  for (const { k } of KINDS) {
    for (const [id, json] of next[k]) {
      if (base[k].get(id) !== json) {
        sync.at[k][id] = now;
        delete sync.gone[k][id];
      }
    }
    for (const id of base[k].keys()) {
      if (!next[k].has(id)) {
        sync.gone[k][id] = now;
        delete sync.at[k][id];
      }
    }
  }
  if (next.settings !== base.settings) sync.at.settings = now;
  return next;
}

// Combines two states. remoteWinsTies: on equal times (older data without times), take the remote item.
// Returns a new state object; neither input is changed.
export function merge(local, remote, { remoteWinsTies = true, savedMax = 3, now = Date.now() } = {}) {
  const L = JSON.parse(JSON.stringify(local));
  const R = JSON.parse(JSON.stringify(remote));
  const ls = ensureSync(L);
  const rs = ensureSync(R);
  const out = { ...L };
  const sync = { at: { f: {}, h: {}, s: {}, settings: 0 }, gone: { f: {}, h: {}, s: {} } };

  for (const { k, list, key } of KINDS) {
    const lMap = new Map((L[list] || []).map((x) => [key(x), x]));
    const rMap = new Map((R[list] || []).map((x) => [key(x), x]));
    // Deletions: keep the latest time either side knows about.
    for (const g of [ls.gone[k], rs.gone[k]]) {
      for (const [id, t] of Object.entries(g)) {
        if (now - t < KEEP_GONE && t > (sync.gone[k][id] || 0)) sync.gone[k][id] = t;
      }
    }
    const order = [...lMap.keys(), ...[...rMap.keys()].filter((id) => !lMap.has(id))];
    const merged = [];
    for (const id of order) {
      const l = lMap.get(id);
      const r = rMap.get(id);
      const lt = ls.at[k][id] || 0;
      const rt = rs.at[k][id] || 0;
      let pick, t;
      if (l && r) {
        const useRemote = rt > lt || (rt === lt && remoteWinsTies);
        pick = useRemote ? r : l;
        t = Math.max(lt, rt);
      } else {
        pick = l || r;
        t = l ? lt : rt;
      }
      const goneAt = sync.gone[k][id] || 0;
      if (goneAt && goneAt >= t) continue; // deleted after its last change
      if (goneAt) delete sync.gone[k][id]; // changed after it was deleted somewhere: it stays
      if (t) sync.at[k][id] = t;
      merged.push(pick);
    }
    out[list] = merged;
  }

  // History newest first; Saved for Later keeps the most recent few.
  out.history.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
  if (out.savedPicks.length > savedMax) {
    out.savedPicks.sort((a, b) => (a.date < b.date ? -1 : 1));
    out.savedPicks = out.savedPicks.slice(-savedMax);
  }

  // Settings as a whole: the newer change wins.
  const lt = ls.at.settings || 0;
  const rt = rs.at.settings || 0;
  out.settings = rt > lt || (rt === lt && remoteWinsTies) ? R.settings : L.settings;
  sync.at.settings = Math.max(lt, rt);

  // Official festivals someone removed: only those that are still gone.
  const present = new Set(out.festivals.map((f) => f.id));
  out.removedOfficial = [...new Set([...(L.removedOfficial || []), ...(R.removedOfficial || [])])].filter((id) => !present.has(id));

  // Which festival is open is up to this device.
  if (!present.has(out.activeFestival)) out.activeFestival = out.festivals[0] ? out.festivals[0].id : out.activeFestival;
  out.sync = sync;
  return out;
}

// Same data, ignoring the bookkeeping? Used to skip pointless writes and backups.
export function sameData(a, b) {
  const strip = (d) => JSON.stringify({ ...d, sync: undefined, activeFestival: undefined });
  return strip(a) === strip(b);
}
