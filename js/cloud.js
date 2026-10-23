// Firebase: sign-in and the database. Everything else in the app goes through sync.js, never here directly.
// The Firebase code (vendor/firebase) is only downloaded when firebase-config.js is filled in.
//
// Database layout (Firestore):
//   users/{uid}      { state: "<the app's saved data as JSON>", clientUpdatedAt, updatedAt, email, device, appVersion }
//   admins/{uid}     { email }                 Added by hand in the Firebase console.
//   official/{id}    { name, icon, rev, kind, message, hidden, order, tables: "<JSON>", publishedAt, publishedBy }
//                    Published official festivals. Anyone can read (no account needed). Admins write.
//   drafts/{id}      { name, icon, tables: "<JSON>", baseRev, updatedAt, updatedBy }   Admins only.
//   presence/{uid}   { email, lastSeen, firstSeen, appVersion, platform, watched, festivals }   Admins can list.
//   requests/{tmdbId} { tmdbId, title, year, posterPath, count, status, moods, firstAt, lastAt }
//                    Movies people want in the catalog. Anyone can read (no personal info). Signed-in people add
//                    one vote each (requests/{tmdbId}/voters/{uid}); admins approve or reject.
// firestore.rules enforces who can read and write each of these.

import { firebaseConfig } from './appconfig.js';

let fb = null;
let loading = null;

export const configured = () => !!(firebaseConfig && firebaseConfig.apiKey);

// Loads the Firebase SDK and connects. Resolves to null if accounts aren't set up or the SDK can't load (offline).
export function init() {
  if (!configured()) return Promise.resolve(null);
  if (loading) return loading;
  loading = Promise.all([
    import('../vendor/firebase/firebase-app.js'),
    import('../vendor/firebase/firebase-auth.js'),
    import('../vendor/firebase/firebase-firestore-lite.js'),
  ])
    .then(([appM, A, F]) => {
      const app = appM.initializeApp(firebaseConfig);
      const auth = A.getAuth(app);
      const db = F.getFirestore(app);
      // Local testing against the Firebase emulators: localStorage['roll-credits:emulator'] = '1'
      if (emulatorOn()) {
        A.connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
        F.connectFirestoreEmulator(db, '127.0.0.1', 8080);
      }
      fb = { auth, db, A, F };
      return fb;
    })
    .catch(() => {
      loading = null; // try again next time (probably offline on first load)
      return null;
    });
  return loading;
}

function emulatorOn() {
  try { return localStorage.getItem('roll-credits:emulator') === '1'; } catch (e) { return false; }
}

export const currentUser = () => (fb ? fb.auth.currentUser : null);

export function onUser(cb) {
  return fb.A.onAuthStateChanged(fb.auth, cb);
}

// ---------- Accounts ----------

export async function signUp(email, password) {
  const cred = await fb.A.createUserWithEmailAndPassword(fb.auth, email.trim(), password);
  return cred.user;
}

export async function signIn(email, password) {
  const cred = await fb.A.signInWithEmailAndPassword(fb.auth, email.trim(), password);
  return cred.user;
}

export const signOut = () => fb.A.signOut(fb.auth);
export const sendReset = (email) => fb.A.sendPasswordResetEmail(fb.auth, email.trim());
// Admins are listed by hand in the Firebase console (admins/{uid}).
export async function isAdmin(user) {
  const { F, db } = fb;
  const doc = await F.getDoc(F.doc(db, 'admins', user.uid)).catch(() => null);
  return !!(doc && doc.exists());
}

// Deletes the saved data, then the sign-in itself. Firebase asks for the password again first.
export async function deleteAccount(user, password) {
  const { A, F, db } = fb;
  await A.reauthenticateWithCredential(user, A.EmailAuthProvider.credential(user.email, password));
  await F.deleteDoc(F.doc(db, 'users', user.uid));
  await F.deleteDoc(F.doc(db, 'presence', user.uid)).catch(() => {});
  await A.deleteUser(user);
}

// ---------- This user's saved data ----------

export async function getUserData(uid) {
  const { F, db } = fb;
  const snap = await F.getDoc(F.doc(db, 'users', uid));
  if (!snap.exists()) return null;
  const d = snap.data();
  return { state: d.state, clientUpdatedAt: d.clientUpdatedAt || 0 };
}

export async function putUserData(uid, { state, clientUpdatedAt, email, device, appVersion }) {
  const { F, db } = fb;
  await F.setDoc(F.doc(db, 'users', uid), {
    state, clientUpdatedAt, email, device, appVersion, updatedAt: F.serverTimestamp(),
  });
}

// ---------- Movie requests ----------

// Asks for a TMDB movie to be added to the catalog. One vote per account. Returns 'added', 'voted' or 'already'.
export async function requestMovie(user, m) {
  const { F, db } = fb;
  const id = String(m.tmdbId);
  const reqRef = F.doc(db, 'requests', id);
  const voterRef = F.doc(db, 'requests', id, 'voters', user.uid);
  const [r, v] = await Promise.all([F.getDoc(reqRef), F.getDoc(voterRef)]);
  if (v.exists()) return 'already';
  const now = Date.now();
  const batch = F.writeBatch(db);
  if (r.exists()) {
    batch.update(reqRef, { count: (r.data().count || 0) + 1, lastAt: now });
  } else {
    batch.set(reqRef, {
      tmdbId: m.tmdbId, title: String(m.title).slice(0, 300), year: m.releaseYear || null, posterPath: m.posterPath || null,
      count: 1, status: 'pending', moods: [], firstAt: now, lastAt: now,
    });
  }
  batch.set(voterRef, { at: now });
  await batch.commit();
  return r.exists() ? 'voted' : 'added';
}

export async function listRequests() {
  const { F, db } = fb;
  const snap = await F.getDocs(F.collection(db, 'requests'));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

// Admins: add a movie straight to the catalog (approved in one step). The catalog workflow picks it up.
export async function adminAddMovie(m, moods, scariness = null) {
  const { F, db } = fb;
  const ref = F.doc(db, 'requests', String(m.tmdbId));
  const now = Date.now();
  const snap = await F.getDoc(ref);
  if (snap.exists()) {
    await F.updateDoc(ref, { status: 'approved', moods: moods || [], scariness: scariness || null, reviewedAt: now });
  } else {
    await F.setDoc(ref, {
      tmdbId: m.tmdbId, title: String(m.title).slice(0, 300), year: m.releaseYear || null, posterPath: m.posterPath || null,
      count: 0, status: 'approved', moods: moods || [], scariness: scariness || null, firstAt: now, lastAt: now, reviewedAt: now, addedByAdmin: true,
    });
  }
}

// Admins: status 'approved' | 'rejected' | 'pending', plus the moods and scare factor (1-10) it gets in the catalog.
export function setRequest(id, { status, moods, scariness = null }) {
  const { F, db } = fb;
  return F.updateDoc(F.doc(db, 'requests', String(id)), { status, moods: moods || [], scariness: scariness || null, reviewedAt: Date.now() });
}

// ---------- Catalog edits (admins fix a movie's moods and scare factor) ----------

// Everyone can read these, signed in or not: { movieId: { moods, scariness } }.
export async function listCatalogEdits() {
  const { F, db } = fb;
  const snap = await F.getDocs(F.collection(db, 'catalogEdits'));
  const out = {};
  snap.docs.forEach((d) => { const x = d.data(); out[d.id] = { moods: Array.isArray(x.moods) ? x.moods : null, scariness: Number.isInteger(x.scariness) ? x.scariness : null }; });
  return out;
}

export function setCatalogEdit(id, { moods, scariness, title }) {
  const { F, db } = fb;
  return F.setDoc(F.doc(db, 'catalogEdits', String(id)), {
    moods: (moods || []).slice(0, 8), scariness: Number.isInteger(scariness) ? scariness : null,
    title: String(title || '').slice(0, 200), at: Date.now(), by: fb.auth.currentUser.email,
  });
}

// ---------- Feedback (Settings → Send Feedback; read in Admin Tools → Feedback) ----------

export async function sendFeedback(fields) {
  const { F, db } = fb;
  const u = fb.auth.currentUser;
  await F.addDoc(F.collection(db, 'feedback'), {
    ...fields, uid: u ? u.uid : null, email: u ? u.email || '' : '', status: 'new', createdAt: Date.now(),
  });
}

export async function listFeedback() {
  const { F, db } = fb;
  const snap = await F.getDocs(F.collection(db, 'feedback'));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
}

export function setFeedbackStatus(id, status) {
  const { F, db } = fb;
  return F.updateDoc(F.doc(db, 'feedback', id), { status });
}

export function deleteFeedback(id) {
  const { F, db } = fb;
  return F.deleteDoc(F.doc(db, 'feedback', id));
}

// ---------- Who uses the app (Admin Tools → View Users) ----------
// presence/{uid}: email, when the app was last opened, which version, rough device type, and two counts.

export async function touchPresence(user, info) {
  const { F, db } = fb;
  const ref = F.doc(db, 'presence', user.uid);
  const snap = await F.getDoc(ref).catch(() => null);
  const firstSeen = snap && snap.exists() ? snap.data().firstSeen || Date.now() : Date.now();
  await F.setDoc(ref, { email: user.email || '', lastSeen: Date.now(), firstSeen, ...info });
}

export async function listPresence() {
  const { F, db } = fb;
  const snap = await F.getDocs(F.collection(db, 'presence'));
  return snap.docs.map((d) => ({ uid: d.id, ...d.data() }));
}

// ---------- Official festivals ----------

const parseOfficial = (id, d) => {
  let tables = null;
  try { tables = JSON.parse(d.tables); } catch (e) { return null; }
  return {
    id, name: d.name, icon: d.icon, rev: d.rev || 1, kind: d.kind || 'version', message: d.message || '',
    hidden: !!d.hidden, order: d.order || 0, tables, publishedAt: d.publishedAt || 0, publishedBy: d.publishedBy || '',
    shelf: d.shelf || '', blurb: d.blurb || '',
  };
};

// Everyone can read these, signed in or not.
export async function listOfficial() {
  const { F, db } = fb;
  const snap = await F.getDocs(F.collection(db, 'official'));
  return snap.docs.map((d) => parseOfficial(d.id, d.data())).filter(Boolean).sort((a, b) => a.order - b.order);
}

export async function publishOfficial(id, { name, icon, tables, rev, kind, message, hidden, order, shelf, blurb }) {
  const { F, db } = fb;
  await F.setDoc(F.doc(db, 'official', id), {
    name, icon, tables: JSON.stringify(tables), rev, kind, message: message || '', hidden: !!hidden, order: order || 0,
    shelf: shelf || '', blurb: blurb || '',
    publishedAt: Date.now(), publishedBy: fb.auth.currentUser.email,
  });
}

// Festival Library placement. Takes effect right away (no new version needed).
export async function setOfficialShelf(id, { shelf, blurb }) {
  const { F, db } = fb;
  await F.updateDoc(F.doc(db, 'official', id), { shelf: shelf || '', blurb: String(blurb || '').slice(0, 120) });
}

export async function setOfficialHidden(id, hidden) {
  const { F, db } = fb;
  await F.updateDoc(F.doc(db, 'official', id), { hidden: !!hidden });
}

export async function listDrafts() {
  const { F, db } = fb;
  const snap = await F.getDocs(F.collection(db, 'drafts'));
  return snap.docs.map((d) => {
    const x = d.data();
    let tables = null;
    try { tables = JSON.parse(x.tables); } catch (e) { /* skip broken */ }
    return { id: d.id, name: x.name, icon: x.icon, tables, baseRev: x.baseRev || 0, updatedAt: x.updatedAt || 0, updatedBy: x.updatedBy || '' };
  }).filter((d) => d.tables);
}

export async function saveDraft(id, { name, icon, tables, baseRev }) {
  const { F, db } = fb;
  await F.setDoc(F.doc(db, 'drafts', id), {
    name, icon, tables: JSON.stringify(tables), baseRev: baseRev || 0, updatedAt: Date.now(), updatedBy: fb.auth.currentUser.email,
  });
}

export function deleteDraft(id) {
  const { F, db } = fb;
  return F.deleteDoc(F.doc(db, 'drafts', id));
}

// Firebase error codes → something a person can act on.
export function errorText(e) {
  const code = (e && e.code) || '';
  const map = {
    'auth/invalid-credential': 'Wrong email or password.',
    'auth/wrong-password': 'Wrong email or password.',
    'auth/user-not-found': 'Wrong email or password.',
    'auth/invalid-email': "That doesn't look like an email address.",
    'auth/email-already-in-use': 'There’s already an account with that email. Try signing in.',
    'auth/weak-password': 'Pick a password with at least 8 characters.',
    'auth/missing-password': 'Enter your password.',
    'auth/too-many-requests': 'Too many tries. Wait a few minutes and try again.',
    'auth/network-request-failed': "Can't reach the internet right now.",
    'permission-denied': "Your account doesn't have access to that.",
    unavailable: "Can't reach the internet right now.",
  };
  return map[code] || 'Something went wrong. Try again.';
}
