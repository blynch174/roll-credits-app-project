// Account: the Account section in Settings, the sign-in / create account sheets, and the Admin screen.
// Accounts are optional. Without one, nothing changes: data stays on the device.

import * as sync from '../sync.js';
import * as cloud from '../cloud.js';
import { $, esc, toast, nav, openSheet, swapSheet, closeSheet, confirmSheet } from '../ui.js';
import { renderAdmin, adminBack, resetAdmin } from './admin.js';

// ---------- Settings → Account section ----------

function ago(ms) {
  if (!ms) return '';
  const s = Math.round((Date.now() - ms) / 1000);
  if (s < 45) return 'just now';
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} hr ago`;
  return new Date(ms).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export function statusText(st) {
  switch (st.status) {
    case 'loading': return 'Checking your account…';
    case 'signedOut': return 'Back up your data and use it on other devices';
    case 'choosing': return 'Pick which data to keep';
    case 'saving': return 'Backing up…';
    case 'synced': return `Backed up ${ago(st.lastSynced)}`;
    case 'offline': return "Offline. Changes back up when you're online again.";
    case 'error': return "Couldn't back up. Tap to try again.";
    default: return '';
  }
}

export function renderAccountSection() {
  const st = sync.getStatus();
  const wrap = $('#account-section');
  wrap.hidden = !st.configured;
  $('#dice-style-title').classList.toggle('first', !st.configured);
  if (!st.configured) return;
  const signedIn = sync.isSignedIn();
  const warn = st.status === 'error';
  $('#account-card').innerHTML = `
    <button type="button" class="row-btn account-row" id="btn-account">
      <span>${signedIn ? esc(st.email) : 'Sign in or create an account'}</span>
      <small class="${warn ? 'warn' : ''}">${esc(statusText(st))}</small>
    </button>
    ${st.admin ? `<button type="button" class="row-btn" id="btn-admin">
      <span>Admin tools</span></button>` : ''}`;
  $('#btn-account').addEventListener('click', () => (sync.isSignedIn() ? accountSheet() : signInSheet()));
  const ab = $('#btn-admin');
  if (ab) ab.addEventListener('click', () => { resetAdmin(); nav.go('admin'); });
}

// ---------- Sheets ----------

const field = (id, label, type, auto, value = '') => `
  <label class="field"><span class="label">${label}</span>
    <input id="${id}" type="${type}" autocomplete="${auto}" autocapitalize="off" autocorrect="off" spellcheck="false" enterkeyhint="${type === 'password' ? 'go' : 'next'}" value="${esc(value)}"></label>`;

function busy(sheet, btnId, on, label) {
  const b = $('#' + btnId, sheet);
  if (!b) return;
  if (on) { b.dataset.label = b.textContent; b.textContent = label; }
  else if (b.dataset.label) b.textContent = b.dataset.label;
  b.disabled = on;
}
const showError = (sheet, msg) => { const p = $('.sheet-error', sheet); p.textContent = msg; p.hidden = !msg; };

export function signInSheet(email = '') {
  const sheet = swapSheet({
    title: 'Sign in',
    body: `
      ${field('a-email', 'Email', 'email', 'username', email)}
      ${field('a-pass', 'Password', 'password', 'current-password')}
      <p class="sheet-error" hidden></p>
      <div class="sheet-links">
        <button type="button" class="link" id="a-forgot">Forgot password?</button>
        <button type="button" class="link" id="a-new">New here? Create an account</button>
      </div>`,
    actions: [
      { label: 'Cancel', kind: 'ghost', onClick: closeSheet },
      { label: 'Sign In', kind: 'primary', id: 'a-go', onClick: (s) => submitSignIn(s) },
    ],
  });
  $('#a-forgot', sheet).addEventListener('click', () => resetSheet($('#a-email', sheet).value));
  $('#a-new', sheet).addEventListener('click', () => createSheet($('#a-email', sheet).value));
  $('#a-pass', sheet).addEventListener('keydown', (e) => { if (e.key === 'Enter') submitSignIn(sheet); });
}

async function submitSignIn(sheet) {
  const email = $('#a-email', sheet).value.trim();
  const pass = $('#a-pass', sheet).value;
  if (!email || !pass) return showError(sheet, 'Enter your email and password.');
  showError(sheet, '');
  busy(sheet, 'a-go', true, 'Signing in…');
  try {
    await sync.signIn(email, pass);
    closeSheet();
    toast('Signed in.');
  } catch (e) {
    busy(sheet, 'a-go', false);
    showError(sheet, cloud.errorText(e));
  }
}

function createSheet(email = '') {
  const sheet = swapSheet({
    title: 'Create an account',
    body: `
      ${field('a-email', 'Email', 'email', 'username', email)}
      ${field('a-pass', 'Password (8 or more characters)', 'password', 'new-password')}
      ${field('a-pass2', 'Password again', 'password', 'new-password')}
      <p class="sheet-error" hidden></p>
      <div class="sheet-links"><button type="button" class="link" id="a-have">Already have an account? Sign in</button></div>`,
    actions: [
      { label: 'Cancel', kind: 'ghost', onClick: closeSheet },
      { label: 'Create Account', kind: 'primary', id: 'a-go', onClick: (s) => submitCreate(s) },
    ],
  });
  $('#a-have', sheet).addEventListener('click', () => signInSheet($('#a-email', sheet).value));
}

async function submitCreate(sheet) {
  const email = $('#a-email', sheet).value.trim();
  const pass = $('#a-pass', sheet).value;
  if (!email) return showError(sheet, 'Enter your email.');
  if (pass.length < 8) return showError(sheet, 'Pick a password with at least 8 characters.');
  if (pass !== $('#a-pass2', sheet).value) return showError(sheet, "The passwords don't match.");
  showError(sheet, '');
  busy(sheet, 'a-go', true, 'Creating…');
  try {
    await sync.signUp(email, pass);
    closeSheet();
    toast('Account created. Your data is backing up.');
  } catch (e) {
    busy(sheet, 'a-go', false);
    showError(sheet, cloud.errorText(e));
  }
}

function resetSheet(email = '') {
  const sheet = swapSheet({
    title: 'Reset your password',
    body: `
      ${field('a-email', 'Email', 'email', 'username', email)}
      <p class="sheet-error" hidden></p>`,
    actions: [
      { label: 'Back', kind: 'ghost', onClick: (s) => signInSheet($('#a-email', s).value) },
      {
        label: 'Send Link', kind: 'primary', id: 'a-go', onClick: async (s) => {
          const em = $('#a-email', s).value.trim();
          if (!em) return showError(s, 'Enter your email.');
          busy(s, 'a-go', true, 'Sending…');
          try {
            await sync.sendReset(em);
            closeSheet();
            toast('If that email has an account, a reset link is on its way.');
          } catch (e) {
            busy(s, 'a-go', false);
            showError(s, cloud.errorText(e));
          }
        },
      },
    ],
  });
}

function accountSheet() {
  const st = sync.getStatus();
  const actions = [{
    label: 'Back Up Now', kind: 'primary', id: 'a-go', onClick: async (s) => {
      busy(s, 'a-go', true, 'Backing up…');
      await sync.syncNow();
      closeSheet();
      const now = sync.getStatus().status;
      toast(now === 'synced' ? 'Backed up.' : statusText(sync.getStatus()));
    },
  }];
  const sheet = openSheet({
    title: 'Your account',
    body: `
      <div class="acct-head"><b>${esc(st.email)}</b><small>${esc(statusText(st))}</small></div>
      <div class="settings-list card acct-list">
        <button type="button" class="row-btn" id="a-pw"><span>Change Password</span></button>
        <button type="button" class="row-btn danger" id="a-out"><span>Sign Out</span></button>
        <button type="button" class="row-btn danger" id="a-del"><span>Delete Account</span></button>
      </div>
      <p class="fine acct-uid">User ID <code>${esc(st.uid)}</code> <button type="button" class="link" id="a-copy">Copy</button></p>`,
    actions: [{ label: 'Close', kind: 'ghost', onClick: closeSheet }, ...actions],
  });
  $('#a-pw', sheet).addEventListener('click', async () => {
    try { await sync.sendReset(st.email); toast(`Password link sent to ${st.email}.`); } catch (e) { toast(cloud.errorText(e)); }
  });
  $('#a-out', sheet).addEventListener('click', () => {
    confirmSheet('Sign out?', 'Your festivals and history stay on this device. Sign back in any time to keep backing up.', 'Sign Out', async () => {
      await sync.signOut();
      toast('Signed out.');
    });
  });
  $('#a-del', sheet).addEventListener('click', () => deleteSheet(st.email));
  $('#a-copy', sheet).addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(st.uid); toast('User ID copied.'); } catch (e) { toast("Couldn't copy. Select it instead."); }
  });
}

// Deletes the account and its backup. Firebase needs the password again for this.
function deleteSheet(email) {
  swapSheet({
    title: 'Delete your account?',
    body: `
      <p class="sheet-text">Deletes <b>${esc(email)}</b> and everything backed up to it. This can't be undone. Your festivals and history stay on this device.</p>
      ${field('a-pass', 'Password', 'password', 'current-password')}
      <p class="sheet-error" hidden></p>`,
    actions: [
      { label: 'Cancel', kind: 'ghost', onClick: closeSheet },
      {
        label: 'Delete Account', kind: 'danger', id: 'a-go', onClick: async (s) => {
          const pass = $('#a-pass', s).value;
          if (!pass) return showError(s, 'Enter your password.');
          showError(s, '');
          busy(s, 'a-go', true, 'Deleting…');
          try {
            await sync.deleteAccount(pass);
            closeSheet();
            toast('Account deleted.');
          } catch (e) {
            busy(s, 'a-go', false);
            const code = (e && e.code) || '';
            showError(s, /invalid-credential|wrong-password/.test(code) ? 'Wrong password.' : cloud.errorText(e));
          }
        },
      },
    ],
  });
}

// Signing in on a device that already has its own data, for an account that also has data.
export function chooseSideSheet(remote, done) {
  let when = '';
  try { when = remote.clientUpdatedAt ? new Date(remote.clientUpdatedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : ''; } catch (e) { /* ignore */ }
  let picked = false;
  const pick = (choice) => { picked = true; closeSheet(); done(choice); };
  openSheet({
    title: 'Which data should we keep?',
    body: `
      <p class="sheet-text">This device and your account both have Roll Credits data.</p>
      <div class="settings-list card acct-list">
        <button type="button" class="row-btn" id="c-combine"><span>Combine Both</span><small>Keeps the festivals and history from each</small></button>
        <button type="button" class="row-btn" id="c-account"><span>Use My Account's Data</span><small>Replaces what's on this device${when ? ` · last backed up ${esc(when)}` : ''}</small></button>
        <button type="button" class="row-btn" id="c-device"><span>Use This Device's Data</span><small>Replaces what's in your account</small></button>
      </div>
`,
    actions: [],
    onClose: () => { if (!picked) setTimeout(() => chooseSideSheet(remote, done), 260); },
  });
  $('#c-combine').addEventListener('click', () => pick('combine'));
  $('#c-account').addEventListener('click', () => pick('account'));
  $('#c-device').addEventListener('click', () => swapSheet({
    title: "Replace your account's data?",
    body: '<p class="sheet-text">Your account\'s festivals and history get replaced with what\'s on this device.</p>',
    actions: [
      { label: 'Back', kind: 'ghost', onClick: () => chooseSideSheet(remote, done) },
      { label: 'Replace', kind: 'danger', onClick: () => { picked = true; closeSheet(); done('device'); } },
    ],
    onClose: () => { if (!picked) setTimeout(() => chooseSideSheet(remote, done), 260); },
  }));
}

// ---------- Admin screen ----------

export { renderAdmin };

export function initAccount() {
  sync.onStatus(() => {
    if (!$('#screen-settings').hidden) renderAccountSection();
    if (!$('#screen-admin').hidden && !sync.isAdmin()) renderAdmin();
  });
  $('#admin-done').addEventListener('click', adminBack);
}
