// Keeps the device's saved data and the account's copy in step.
//
// The device copy (localStorage) is still the one the app reads and writes. When signed in, every change is
// also sent to the account about a second and a half later. Opening the app, or coming back to it, pulls the
// account's copy if another device saved something newer. If both changed, the two are combined item by item
// (merge.js): each festival, history entry, and saved movie keeps its most recent change, and deletions stick.
//
// Status: off | loading | signedOut | choosing | synced | saving | offline | error

import * as store from './store.js';
import * as cloud from './cloud.js';

export const APP_VERSION = '3.24';
const META_KEY = 'roll-credits:sync';
const DEVICE_KEY = 'roll-credits:device';
const PUSH_DELAY = 1500;

let status = 'off';
let user = null;
let admin = false;
let ready = false; // true once this device and the account have been reconciled
let lastSynced = 0;
let pushTimer = null;
let pushing = null;
let changeSeq = 0;
let deniedOnce = false; // stops a re-check loop if the database keeps refusing
let hooks = { onRemoteApplied: () => {}, chooseSide: (remote, done) => done('combine'), onReplaced: () => {} };
const listeners = [];

export function getStatus() {
  return { status, admin, lastSynced, email: user ? user.email : '', uid: user ? user.uid : '', configured: cloud.configured() };
}
export function onStatus(cb) {
  listeners.push(cb);
}
function set(s, extra = {}) {
  status = s;
  if ('lastSynced' in extra) lastSynced = extra.lastSynced;
  listeners.forEach((cb) => cb(getStatus()));
}

// ---------- Small stored bookkeeping ----------

function readMeta() {
  try {
    return { uid: null, syncedAt: 0, dirty: false, localAt: 0, ...JSON.parse(localStorage.getItem(META_KEY) || '{}') };
  } catch (e) {
    return { uid: null, syncedAt: 0, dirty: false, localAt: 0 };
  }
}
function writeMeta(m) {
  try { localStorage.setItem(META_KEY, JSON.stringify(m)); } catch (e) { /* storage full or blocked */ }
}
function deviceId() {
  try {
    let id = localStorage.getItem(DEVICE_KEY);
    if (!id) { id = Math.random().toString(36).slice(2, 10); localStorage.setItem(DEVICE_KEY, id); }
    return id;
  } catch (e) {
    return 'unknown';
  }
}

// ---------- Start ----------

export function start(h = {}) {
  hooks = { ...hooks, ...h };
  if (!cloud.configured()) return set('off');
  store.onSave(localChanged);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flush();
    else pullIfNewer();
  });
  window.addEventListener('online', () => {
    if (!user) return connect();
    if (status === 'offline' || status === 'error') (ready ? syncNow() : checkAccess());
  });
  connect();
}

async function connect() {
  set('loading');
  const fb = await cloud.init();
  if (!fb) return set('offline'); // couldn't load Firebase (offline on first open); retried on 'online'
  cloud.onUser(handleUser);
}

function handleUser(u) {
  ready = false;
  user = u;
  admin = false;
  if (!u) return set('signedOut');
  checkAccess();
}

// Is this account an admin? Then line up this device with the account.
export async function checkAccess() {
  if (!user) return;
  set('loading');
  try {
    admin = await cloud.isAdmin(user);
  } catch (e) {
    return failed(e);
  }
  await reconcile();
  notePresence();
}

// First contact after signing in: decide whose data wins.
async function reconcile() {
  const uid = user.uid;
  let remote;
  try {
    remote = await cloud.getUserData(uid);
  } catch (e) {
    return failed(e);
  }
  const meta = readMeta();
  if (!remote) {
    // Brand-new account: this device's data becomes the account's.
    ready = true;
    return push();
  }
  if (meta.uid === uid) {
    ready = true;
    const remoteNewer = remote.clientUpdatedAt > meta.syncedAt;
    if (meta.dirty) return push(remote); // push combines the two first if the account changed meanwhile
    if (remoteNewer) return apply(remote);
    return set('synced', { lastSynced: meta.syncedAt });
  }
  // First time this account is used on this device.
  if (store.isPristine()) {
    ready = true;
    return apply(remote);
  }
  set('choosing');
  hooks.chooseSide(remote, (choice) => {
    if (!user || user.uid !== uid) return;
    ready = true;
    if (choice === 'account') {
      apply(remote, true);
      hooks.onReplaced();
    } else if (choice === 'combine') {
      combine(remote, false);
    } else push(null, true);
  });
}

const parse = (remote) => {
  try { return JSON.parse(remote.state); } catch (e) { return null; }
};

// The account's data replaces this device's. Only used when this device has no unsent changes
// (or the person chose it), so nothing is lost; a copy is still kept for Restore Previous Data.
// Lets admins see who's using the app (View Users). At most every few hours per device.
const PRESENCE_KEY = 'roll-credits:presence';
function notePresence() {
  if (!user) return;
  try {
    const last = JSON.parse(localStorage.getItem(PRESENCE_KEY) || '{}');
    if (last.uid === user.uid && Date.now() - last.at < 6 * 3600 * 1000) return;
  } catch (e) { /* ignore */ }
  const ua = navigator.userAgent || '';
  const platform = /iPhone|iPad|iPod/.test(ua) ? 'iPhone/iPad' : /Android/.test(ua) ? 'Android' : /Mac/.test(ua) ? 'Mac' : /Windows/.test(ua) ? 'Windows' : 'Other';
  const st = store.getState();
  const uid = user.uid;
  cloud.touchPresence(user, { appVersion: APP_VERSION, platform, watched: st.history.length, festivals: st.festivals.length })
    .then(() => { try { localStorage.setItem(PRESENCE_KEY, JSON.stringify({ uid, at: Date.now() })); } catch (e) { /* full */ } })
    .catch(() => {});
}

function apply(remote, backup = false) {
  const d = parse(remote);
  if (!d) return set('error');
  if (backup && !store.isPristine()) store.backupBeforeSync();
  if (!store.replaceState(d)) return set('error');
  writeMeta({ uid: user.uid, syncedAt: remote.clientUpdatedAt, dirty: false, localAt: 0 });
  deniedOnce = false;
  set('synced', { lastSynced: remote.clientUpdatedAt });
  hooks.onRemoteApplied();
}

// Both sides changed: combine them, then send the result back if the account is missing anything.
function combine(remote, remoteWinsTies = true) {
  const d = parse(remote);
  if (!d) return set('error');
  const before = store.isPristine() ? null : store.snapshot();
  const r = store.mergeIn(d, { remoteWinsTies });
  if (!r) return set('error');
  if (r.changed && before) {
    try { localStorage.setItem('roll-credits:before-sync', JSON.stringify({ at: Date.now(), state: JSON.parse(before) })); } catch (e) { /* best-effort */ }
  }
  writeMeta({ uid: user.uid, syncedAt: remote.clientUpdatedAt, dirty: r.differs, localAt: Date.now() });
  if (r.changed) hooks.onRemoteApplied();
  if (r.differs) return push(null, true);
  set('synced', { lastSynced: remote.clientUpdatedAt });
}

// ---------- Sending changes ----------

function localChanged() {
  const m = readMeta();
  m.dirty = true;
  m.localAt = Date.now();
  writeMeta(m);
  changeSeq++;
  if (!ready || !user) return;
  clearTimeout(pushTimer);
  pushTimer = setTimeout(push, PUSH_DELAY);
  if (status !== 'saving') set('saving');
}

// Sends this device's data. Before writing, checks whether another device saved since the last sync
// (knownRemote: already fetched). If so, combines first so that device's changes aren't overwritten.
// force: skip the check (this device's data was chosen to replace the account's).
function push(knownRemote = null, force = false) {
  clearTimeout(pushTimer);
  pushTimer = null;
  if (!ready || !user) return Promise.resolve();
  if (pushing) return pushing.then(() => (readMeta().dirty ? push() : null));
  const uid = user.uid;
  set('saving');
  pushing = (force ? Promise.resolve(null) : knownRemote ? Promise.resolve(knownRemote) : cloud.getUserData(uid))
    .then((remote) => {
      if (remote && remote.clientUpdatedAt > readMeta().syncedAt) {
        const d = parse(remote);
        const r = d && store.mergeIn(d, { remoteWinsTies: false });
        if (r && r.changed) hooks.onRemoteApplied();
      }
      return write(uid);
    })
    .catch(failed)
    .finally(() => {
      pushing = null;
    });
  return pushing;
}

function write(uid) {
  const seq = changeSeq;
  const now = Date.now();
  return cloud.putUserData(uid, {
    state: JSON.stringify(store.getState()),
    clientUpdatedAt: now,
    email: user.email,
    device: deviceId(),
    appVersion: APP_VERSION,
  })
    .then(() => {
      const m = readMeta();
      m.uid = uid;
      m.syncedAt = now;
      if (changeSeq === seq) m.dirty = false;
      writeMeta(m);
      deniedOnce = false;
      set('synced', { lastSynced: now });
      if (changeSeq !== seq && ready && user) {
        clearTimeout(pushTimer);
        pushTimer = setTimeout(push, PUSH_DELAY);
      }
    });
}

// Send anything waiting right now (app going to the background, signing out).
function flush() {
  if (pushTimer) return push();
  return pushing || Promise.resolve();
}

async function pullIfNewer() {
  if (!ready || !user || pushing) return;
  const m = readMeta();
  if (m.dirty) return push();
  try {
    const remote = await cloud.getUserData(user.uid);
    if (readMeta().dirty) return push(remote); // something changed here while we were fetching
    if (remote && remote.clientUpdatedAt > m.syncedAt) apply(remote);
    else if (status !== 'synced') set('synced', { lastSynced: m.syncedAt });
  } catch (e) {
    failed(e);
  }
}

function failed(e) {
  const code = (e && e.code) || '';
  if (code === 'permission-denied' && user && !deniedOnce) {
    // Maybe the account changed (e.g. admin removed). Re-check once rather than keep failing.
    deniedOnce = true;
    ready = false;
    return checkAccess();
  }
  if (!navigator.onLine || code === 'unavailable' || code === 'auth/network-request-failed') return set('offline');
  set('error');
}

// ---------- Actions for the account screens ----------

export async function syncNow() {
  if (!user) return;
  if (!ready) return checkAccess();
  if (readMeta().dirty) return push();
  return pullIfNewer();
}

export async function signIn(email, password) {
  await cloud.signIn(email, password);
}

export async function signUp(email, password) {
  await cloud.signUp(email, password);
}

export async function signOut() {
  await flush();
  ready = false;
  await cloud.signOut();
}

export const sendReset = (email) => cloud.sendReset(email);

// Files a catalog request for a movie picked from TMDB. Quietly does nothing without an account.
export function requestMovie(m) {
  if (!user || !m || !m.tmdbId) return Promise.resolve(null);
  return cloud.requestMovie(user, m).catch(() => null);
}

// Deletes the account and everything saved in it. This device keeps its own copy.
export async function deleteAccount(password) {
  if (!user) return;
  clearTimeout(pushTimer);
  pushTimer = null;
  ready = false;
  await cloud.deleteAccount(user, password);
  writeMeta({ uid: null, syncedAt: 0, dirty: false, localAt: 0 });
}

export const isSignedIn = () => !!user;
export const isAdmin = () => admin;
