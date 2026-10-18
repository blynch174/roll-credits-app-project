// Firebase: sign-in and the database. Everything else in the app goes through sync.js, never here directly.
// The Firebase code (vendor/firebase) is only downloaded when firebase-config.js is filled in.
//
// Database layout (Firestore):
//   users/{uid}      { state: "<the app's saved data as JSON>", clientUpdatedAt, updatedAt, email, device, appVersion }
//   admins/{uid}     { email }                 Added by hand in the Firebase console.
//   official/{id}    { name, icon, rev, kind, message, hidden, order, tables: "<JSON>", publishedAt, publishedBy }
//                    Published official festivals. Anyone can read (no account needed). Admins write.
//   drafts/{id}      { name, icon, tables: "<JSON>", baseRev, updatedAt, updatedBy }   Admins only.
// firestore.rules enforces who can read and write each of these.

import { firebaseConfig } from './firebase-config.js';

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

// ---------- Official festivals ----------

const parseOfficial = (id, d) => {
  let tables = null;
  try { tables = JSON.parse(d.tables); } catch (e) { return null; }
  return {
    id, name: d.name, icon: d.icon, rev: d.rev || 1, kind: d.kind || 'version', message: d.message || '',
    hidden: !!d.hidden, order: d.order || 0, tables, publishedAt: d.publishedAt || 0, publishedBy: d.publishedBy || '',
  };
};

// Everyone can read these, signed in or not.
export async function listOfficial() {
  const { F, db } = fb;
  const snap = await F.getDocs(F.collection(db, 'official'));
  return snap.docs.map((d) => parseOfficial(d.id, d.data())).filter(Boolean).sort((a, b) => a.order - b.order);
}

export async function publishOfficial(id, { name, icon, tables, rev, kind, message, hidden, order }) {
  const { F, db } = fb;
  await F.setDoc(F.doc(db, 'official', id), {
    name, icon, tables: JSON.stringify(tables), rev, kind, message: message || '', hidden: !!hidden, order: order || 0,
    publishedAt: Date.now(), publishedBy: fb.auth.currentUser.email,
  });
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
