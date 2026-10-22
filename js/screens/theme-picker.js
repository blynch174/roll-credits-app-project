// Settings → Themes: one look for the whole app, grouped. Each card is a small live preview (same size for all).

import * as store from '../store.js';
import { THEME_GROUPS, themeStyle, applyTheme, loadThemeFonts } from '../themes.js';
import { $, $$, esc, nav } from '../ui.js';

export function renderThemePicker() {
  const cur = store.themeId();
  loadThemeFonts();
  $('#themes').innerHTML = THEME_GROUPS.map((g, i) => `
    <h2 class="section-title${i === 0 ? ' first' : ''}">${esc(g.name)}</h2>
    <div class="theme-grid">
      ${g.themes.map((t) => `
        <button type="button" class="theme-card ${t.id === cur ? 'on' : ''}" data-theme-id="${t.id}" style="${themeStyle(t)}" aria-pressed="${t.id === cur}">
          <span class="tc-stage" aria-hidden="true">
            <span class="tc-brand">Roll Credits</span>
            <span class="tc-mini"><i></i><b><span></span><span></span></b></span>
          </span>
          <span class="tc-label">
            <span class="tc-name">${esc(t.name)}</span>
            <span class="tc-desc">${esc(t.desc)}</span>
          </span>
        </button>`).join('')}
    </div>`).join('');
  $$('#themes .theme-card').forEach((b) => b.addEventListener('click', () => {
    store.setSetting('theme', b.dataset.themeId);
    applyTheme(b.dataset.themeId);
    renderThemePicker();
  }));
}

export function initThemePicker() {
  $('#themes-done').addEventListener('click', () => nav.go('settings'));
}
