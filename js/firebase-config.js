// Firebase setup for accounts and sync. See FIREBASE_SETUP.md.
//
// Paste the config object from Firebase console → Project settings → Your apps → SDK setup and configuration → Config.
// While this is null the app runs exactly as before: no accounts, everything saved on the device only.
//
// These values are meant to be public. They only say which Firebase project to talk to.
// The security rules (firestore.rules) are what protect each person's data.

export const firebaseConfig = {
  apiKey: "AIzaSyCM2xdwNUS2WDsA4NrpbrKNlqy3V8o227M",
  authDomain: "roll-credits-9e530.firebaseapp.com",
  projectId: "roll-credits-9e530",
  storageBucket: "roll-credits-9e530.firebasestorage.app",
  messagingSenderId: "44120958764",
  appId: "1:44120958764:web:a1e28a24b9b230513bee89"
};

// Name shown to people who sign up but aren't on the invite list yet ("Ask Brandon to add you").
export const INVITE_CONTACT = 'Brandon';
