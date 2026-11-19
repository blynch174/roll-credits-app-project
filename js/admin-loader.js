// Admin Tools load only when an admin opens them, so everyone else never downloads them.
// Everything admin-only lives in these modules; the rest of the app reaches them through here.

let modules = null; // set once loaded
let loading = null;

export function loadAdmin() {
  if (!loading) {
    loading = Promise.all([
      import('./screens/admin.js'),
      import('./screens/admin-festivals.js'),
      import('./screens/movie-edit.js'),
    ]).then(([admin, festivals, movieEdit]) => (modules = { admin, festivals, movieEdit }));
  }
  return loading;
}

// The admin modules if they're already loaded, otherwise null. An official festival draft can only be opened
// from Admin Tools, so whenever a draft is open these are loaded.
export const loadedAdmin = () => modules;
