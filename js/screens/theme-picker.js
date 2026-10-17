// Settings → Themes: one color theme for the whole app, grouped (Classic, Seasonal, Common, Developer picks).

import * as store from '../store.js';
import { THEME_GROUPS, themeStyle, applyTheme } from '../themes.js';
import { $, $$, esc, nav } from '../ui.js';

export function renderThemePicker() {
  const cur = store.themeId();
  $('#themes').innerHTML = THEME_GROUPS.map((g, i) => `
    <h2 class="section-title${i === 0 ? ' first' : ''}">${esc(g.name)}</h2>
    <p class="hint theme-group-desc">${esc(g.desc)}</p>
    <div class="theme-grid">
      ${g.themes.map((t) => `
        <button type="button" class="theme-card ${t.id === cur ? 'on' : ''}" data-theme-id="${t.id}" style="${themeStyle(t)}" aria-pressed="${t.id === cur}">
          <span class="tc-swatch"><i></i><i></i><i></i></span>
          <span class="tc-name">${esc(t.name)}</span>
          <span class="tc-desc">${esc(t.desc)}</span>
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
