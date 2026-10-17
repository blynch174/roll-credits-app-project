// Account: the Account section in Settings, the sign-in / create account sheets, and the Admin screen.
// Accounts are optional. Without one, nothing changes: data stays on the device.

import * as sync from '../sync.js';
import * as cloud from '../cloud.js';
import { INVITE_CONTACT } from '../firebase-config.js';
import { $, $$, esc, toast, nav, openSheet, swapSheet, closeSheet, confirmSheet } from '../ui.js';
import { renderOfficialSection } from './admin-official.js';

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
    case 'notInvited': return 'Not on the invite list yet';
    case 'unverified': return 'Verify your email to turn on backup';
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
  const warn = ['notInvited', 'unverified', 'error'].includes(st.status);
  $('#account-card').innerHTML = `
    <button type="button" class="row-btn account-row" id="btn-account">
      <span>${signedIn ? esc(st.email) : 'Sign in or create an account'}</span>
      <small class="${warn ? 'warn' : ''}">${esc(statusText(st))}</small>
    </button>
    ${st.admin ? `<button type="button" class="row-btn" id="btn-admin">
      <span>Admin tools</span></button>` : ''}`;
  $('#btn-account').addEventListener('click', () => (sync.isSignedIn() ? accountSheet() : signInSheet()));
  const ab = $('#btn-admin');
  if (ab) ab.addEventListener('click', () => nav.go('admin'));
}

// ---------- Sheets ----------

const field = (id, label, type, auto, value = '') => `
  <label class="field"><span class="label">${label}</span>
    <input id="${id}" type="${type}" autocomplete="${auto}" autocapitalize="off" spellcheck="false" value="${esc(value)}"></label>`;

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
      <p class="sheet-text">Roll Credits is invite-only for now. Use the email you were invited with.</p>
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
    swapSheet({
      title: 'Check your email',
      body: `<p class="sheet-text">We sent a link to <b>${esc(email)}</b>. Tap it to confirm your email, then come back and tap <b>I've confirmed it</b>. Check spam if it's not there in a minute.</p>`,
      actions: [
        { label: 'Later', kind: 'ghost', onClick: closeSheet },
        { label: "I've Confirmed it", kind: 'primary', id: 'a-ver', onClick: (s) => checkVerified(s) },
      ],
    });
  } catch (e) {
    busy(sheet, 'a-go', false);
    showError(sheet, cloud.errorText(e));
  }
}

async function checkVerified(sheet) {
  busy(sheet, 'a-ver', true, 'Checking…');
  try {
    await sync.refreshVerification();
  } catch (e) { /* status shows the problem */ }
  busy(sheet, 'a-ver', false);
  const st = sync.getStatus().status;
  if (st === 'unverified') return toast("Not confirmed yet. Tap the link in the email first.");
  closeSheet();
  if (st === 'notInvited') toast(`Confirmed. ${INVITE_CONTACT} still needs to add you to the invite list.`);
  else toast('Email confirmed. Your data is backing up.');
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
  let note = '';
  const actions = [];
  if (st.status === 'notInvited') {
    note = `<p class="sheet-text">Roll Credits is invite-only while it's being tested. Ask ${esc(INVITE_CONTACT)} to add <b>${esc(st.email)}</b> to the invite list, then tap Check again. Until then your data stays on this device only.</p>`;
    actions.push({ label: 'Check Again', kind: 'primary', id: 'a-go', onClick: (s) => recheck(s) });
  } else if (st.status === 'unverified') {
    note = `<p class="sheet-text">Tap the link we emailed to <b>${esc(st.email)}</b>, then come back and tap I've confirmed it.</p>
      <div class="sheet-links"><button type="button" class="link" id="a-resend">Resend the Email</button></div>`;
    actions.push({ label: "I've Confirmed it", kind: 'primary', id: 'a-ver', onClick: (s) => checkVerified(s) });
  } else {
    actions.push({
      label: 'Back Up Now', kind: 'primary', id: 'a-go', onClick: async (s) => {
        busy(s, 'a-go', true, 'Backing up…');
        await sync.syncNow();
        closeSheet();
        const now = sync.getStatus().status;
        toast(now === 'synced' ? 'Backed up.' : statusText(sync.getStatus()));
      },
    });
  }
  const sheet = openSheet({
    title: 'Your account',
    body: `
      <div class="acct-head"><b>${esc(st.email)}</b><small>${esc(statusText(st))}</small></div>
      ${note}
      <div class="settings-list card acct-list">
        <button type="button" class="row-btn" id="a-pw"><span>Change Password</span></button>
        <button type="button" class="row-btn danger" id="a-out"><span>Sign Out</span></button>
      </div>
      <p class="fine acct-uid">User ID <code>${esc(st.uid)}</code> <button type="button" class="link" id="a-copy">Copy</button></p>`,
    actions: [{ label: 'Close', kind: 'ghost', onClick: closeSheet }, ...actions],
  });
  const resend = $('#a-resend', sheet);
  if (resend) resend.addEventListener('click', async () => {
    try { await sync.resendVerification(); toast('Sent. Check your email.'); } catch (e) { toast(cloud.errorText(e)); }
  });
  $('#a-pw', sheet).addEventListener('click', async () => {
    try { await sync.sendReset(st.email); toast(`Password link sent to ${st.email}.`); } catch (e) { toast(cloud.errorText(e)); }
  });
  $('#a-out', sheet).addEventListener('click', () => {
    confirmSheet('Sign out?', 'Your festivals and history stay on this device. Sign back in any time to keep backing up.', 'Sign out', async () => {
      await sync.signOut();
      toast('Signed out.');
    });
  });
  $('#a-copy', sheet).addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(st.uid); toast('User ID copied.'); } catch (e) { toast("Couldn't copy. Select it instead."); }
  });
}

async function recheck(sheet) {
  busy(sheet, 'a-go', true, 'Checking…');
  await sync.checkAccess();
  closeSheet();
  const st = sync.getStatus().status;
  toast(st === 'notInvited' ? 'Still not on the invite list.' : 'You’re in. Your data is backing up.');
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
        <button type="button" class="row-btn" id="c-account"><span>Use My Account's Data</span><small>Replaces what's on this device${when ? ` · last backed up ${esc(when)}` : ''}</small></button>
        <button type="button" class="row-btn" id="c-device"><span>Use This Device's Data</span><small>Replaces what's in your account</small></button>
      </div>
      <p class="sheet-text">Whichever one you don't pick gets replaced.</p>`,
    actions: [],
    onClose: () => { if (!picked) setTimeout(() => chooseSideSheet(remote, done), 260); },
  });
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

let invites = null; // null = not loaded yet

export async function renderAdmin() {
  const root = $('#admin');
  if (!sync.isAdmin()) {
    root.innerHTML = '<p class="sheet-text">Admin tools are only for admins.</p>';
    return;
  }
  root.innerHTML = `
    <h2 class="section-title first">Invite list</h2>
    <form class="invite-add" id="invite-form" autocomplete="off">
      <input id="invite-email" type="email" placeholder="friend@example.com" autocapitalize="off" spellcheck="false" aria-label="Email to invite">
      <button type="submit" class="btn primary small" id="invite-go">Add</button>
    </form>
    <ul class="invite-list" id="invite-list"><li class="hint">Loading…</li></ul>

    <h2 class="section-title">Official festivals</h2>
    <div id="official-admin"></div>

    <h2 class="section-title">Admins</h2>
    <div class="card admin-soon"><p class="sheet-text">Admins are added in the Firebase console (see FIREBASE_SETUP.md, step 6).</p></div>`;
  $('#invite-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const input = $('#invite-email');
    const email = input.value.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return toast("That doesn't look like an email address.");
    if (invites && invites.some((i) => i.email === email)) return toast('Already on the list.');
    const btn = $('#invite-go');
    btn.disabled = true;
    try {
      await cloud.addInvite(email);
      input.value = '';
      toast(`Added ${email}.`);
      await loadInvites();
    } catch (err) {
      toast(cloud.errorText(err));
    }
    btn.disabled = false;
  });
  renderOfficialSection();
  await loadInvites();
}

async function loadInvites() {
  const list = $('#invite-list');
  if (!list) return;
  try {
    invites = await cloud.listInvites();
  } catch (e) {
    list.innerHTML = `<li class="hint">${esc(cloud.errorText(e))}</li>`;
    return;
  }
  if (!invites.length) {
    list.innerHTML = '<li class="hint">Nobody yet. Add an email above.</li>';
    return;
  }
  list.innerHTML = invites.map((i) => `
    <li class="invite-row">
      <span class="invite-email">${esc(i.email)}</span>
      <small>${i.addedAt ? 'Added ' + esc(new Date(i.addedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })) : ''}</small>
      <button type="button" class="btn ghost small" data-remove="${esc(i.email)}">Remove</button>
    </li>`).join('');
  $$('[data-remove]', list).forEach((b) => b.addEventListener('click', () => {
    const email = b.dataset.remove;
    confirmSheet(`Remove ${email}?`, 'They can still open the app, but their data stops backing up. What’s already backed up stays.', 'Remove', async () => {
      try {
        await cloud.removeInvite(email);
        toast(`Removed ${email}.`);
        loadInvites();
      } catch (e) {
        toast(cloud.errorText(e));
      }
    }, true);
  }));
}

export function initAccount() {
  sync.onStatus(() => {
    if (!$('#screen-settings').hidden) renderAccountSection();
    if (!$('#screen-admin').hidden && !sync.isAdmin()) renderAdmin();
  });
  $('#admin-done').addEventListener('click', () => nav.go('settings'));
}
