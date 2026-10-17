// Keeps the device's saved data and the account's copy in step.
//
// The device copy (localStorage) is still the one the app reads and writes. When signed in, every change is
// also sent to the account about a second and a half later. Opening the app, or coming back to it, pulls the
// account's copy if another device saved something newer. If both changed, the newer save wins.
//
// Status: off | loading | signedOut | notInvited | unverified | choosing | synced | saving | offline | error

import * as store from './store.js';
import * as cloud from './cloud.js';

export const APP_VERSION = '3.12';
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
let deniedOnce = false; // stops a re-check loop if the database keeps refusing for some other reason
let hooks = { onRemoteApplied: () => {}, chooseSide: (remote, done) => done('account') };
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

// Is this account on the invite list (or an admin), and is its email verified?
export async function checkAccess() {
  if (!user) return;
  set('loading');
  let a;
  try {
    a = await cloud.access(user);
  } catch (e) {
    return failed(e);
  }
  admin = a.admin;
  if (!a.admin && !a.invited) return set('notInvited');
  if (!a.admin && !a.verified) return set('unverified');
  await reconcile();
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
    if (meta.dirty) return remoteNewer && remote.clientUpdatedAt > meta.localAt ? apply(remote) : push();
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
    if (choice === 'account') apply(remote);
    else push();
  });
}

function apply(remote) {
  let d = null;
  try { d = JSON.parse(remote.state); } catch (e) { /* bad data */ }
  if (!d || !store.replaceState(d)) return set('error');
  writeMeta({ uid: user.uid, syncedAt: remote.clientUpdatedAt, dirty: false, localAt: 0 });
  deniedOnce = false;
  set('synced', { lastSynced: remote.clientUpdatedAt });
  hooks.onRemoteApplied();
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

function push() {
  clearTimeout(pushTimer);
  pushTimer = null;
  if (!ready || !user) return Promise.resolve();
  if (pushing) return pushing.then(() => (readMeta().dirty ? push() : null));
  const uid = user.uid;
  const seq = changeSeq;
  const now = Date.now();
  set('saving');
  pushing = cloud.putUserData(uid, {
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
    })
    .catch(failed)
    .finally(() => {
      pushing = null;
      if (changeSeq !== seq && ready && user) {
        clearTimeout(pushTimer);
        pushTimer = setTimeout(push, PUSH_DELAY);
      }
    });
  return pushing;
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
    if (remote && remote.clientUpdatedAt > m.syncedAt) apply(remote);
    else if (status !== 'synced') set('synced', { lastSynced: m.syncedAt });
  } catch (e) {
    failed(e);
  }
}

function failed(e) {
  const code = (e && e.code) || '';
  if (code === 'permission-denied' && user && !deniedOnce) {
    // Probably taken off the invite list. Re-check once rather than keep failing.
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
export const resendVerification = () => cloud.resendVerification();

export async function refreshVerification() {
  await cloud.refreshUser();
  user = cloud.currentUser();
  return checkAccess();
}

export const isSignedIn = () => !!user;
export const isAdmin = () => admin;
