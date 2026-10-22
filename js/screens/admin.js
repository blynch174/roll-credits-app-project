// Admin Tools: a small menu (Festival Manager, Movie Manager, View Users) with a page for each.
// The ‹ Back link walks up one level; from the menu it returns to Settings.

import * as sync from '../sync.js';
import * as cloud from '../cloud.js';
import { $, $$, esc, nav } from '../ui.js';
import { renderOfficialSection } from './admin-official.js';
import { renderMovies, moviesTitle, moviesParent, pendingCount } from './admin-movies.js';

let view = 'home'; // home | festivals | users | movies | movies:pending | movies:approved | movies:rejected | movies:add

const TITLES = { home: 'Admin Tools', festivals: 'Festival Manager', users: 'View Users' };

export function resetAdmin() {
  view = 'home';
}

export function adminGo(v) {
  view = v;
  renderAdmin();
  window.scrollTo(0, 0);
}

export function adminBack() {
  if (view === 'home') return nav.go('settings');
  adminGo(view.startsWith('movies:') ? moviesParent() : 'home');
}

export function renderAdmin() {
  const root = $('#admin');
  const title = $('#admin-title');
  if (!sync.isAdmin()) {
    title.textContent = 'Admin Tools';
    root.innerHTML = '<p class="sheet-text">Admin tools are only for admins.</p>';
    return;
  }
  $('#admin-done').textContent = view === 'home' ? '‹ Done' : '‹ Back';
  title.textContent = view.startsWith('movies') ? moviesTitle(view) : TITLES[view] || 'Admin Tools';
  if (view === 'festivals') {
    root.innerHTML = '<div id="official-admin"></div>';
    return renderOfficialSection();
  }
  if (view === 'users') return renderUsers(root);
  if (view.startsWith('movies')) return renderMovies(root, view, adminGo);
  root.innerHTML = `
    <div class="card settings-list admin-menu">
      <button type="button" class="row-btn" data-go="festivals"><span>Festival Manager</span></button>
      <button type="button" class="row-btn" data-go="movies"><span>Movie Manager</span><small id="am-pending" hidden></small></button>
      <button type="button" class="row-btn" data-go="users"><span>View Users</span></button>
    </div>
    <h2 class="section-title">Admins</h2>
    <div class="card admin-soon"><p class="sheet-text">Admins are added in the Firebase console (see FIREBASE_SETUP.md, step 6).</p></div>`;
  $$('[data-go]', root).forEach((b) => b.addEventListener('click', () => adminGo(b.dataset.go)));
  pendingCount().then((n) => {
    const el = $('#am-pending');
    if (el && n) { el.textContent = `${n} pending`; el.hidden = false; }
  });
}

// ---------- View Users ----------

function when(ms) {
  if (!ms) return 'never';
  const d = Math.floor((Date.now() - ms) / 86400000);
  if (d <= 0) return 'today';
  if (d === 1) return 'yesterday';
  if (d < 30) return `${d} days ago`;
  return new Date(ms).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

async function renderUsers(root) {
  root.innerHTML = '<p class="hint">Loading…</p>';
  let people;
  try {
    people = await cloud.listPresence();
  } catch (e) {
    root.innerHTML = `<p class="hint">${esc(cloud.errorText(e))}</p>`;
    return;
  }
  if (view !== 'users') return;
  people.sort((a, b) => (b.lastSeen || 0) - (a.lastSeen || 0));
  const week = people.filter((p) => Date.now() - (p.lastSeen || 0) < 7 * 86400000).length;
  const month = people.filter((p) => Date.now() - (p.lastSeen || 0) < 30 * 86400000).length;
  root.innerHTML = `
    <div class="user-stats">
      <div class="card"><b>${people.length}</b><small>Accounts</small></div>
      <div class="card"><b>${week}</b><small>Active this week</small></div>
      <div class="card"><b>${month}</b><small>Active this month</small></div>
    </div>
    ${people.length ? `<ul class="user-list">${people.map((p) => `
      <li class="card user-row${Date.now() - (p.lastSeen || 0) < 30 * 86400000 ? '' : ' idle'}">
        <span class="ur-email">${esc(p.email || '(no email)')}</span>
        <span class="ur-sub">Last opened ${esc(when(p.lastSeen))} · ${esc(p.platform || '?')} · v${esc(p.appVersion || '?')}</span>
        <span class="ur-sub">${Number(p.watched) || 0} watched · ${Number(p.festivals) || 0} festivals · joined ${esc(when(p.firstSeen))}</span>
      </li>`).join('')}</ul>` : '<p class="hint">Nobody yet.</p>'}`;
}
