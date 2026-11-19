// Small helpers used across the app. Nothing here touches the page or the saved data.

// ---------- Text ----------

// Escape anything a user typed before it goes into HTML.
const HTML_ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => HTML_ESCAPES[c]);

// A typed release year, or null if it isn't a plausible one.
export function cleanYear(value) {
  const y = parseInt(value, 10);
  return Number.isFinite(y) && y > 1800 && y < 3000 ? y : null;
}

// ---------- Dates ----------
// History dates are saved as ISO times. A day picked by hand is saved at noon local time, so it shows as the
// same day in any time zone the person is likely to be in.

const pad = (n) => String(n).padStart(2, '0');

// The local calendar day of a saved time, as 'YYYY-MM-DD'.
export function localDay(iso) {
  const d = new Date(iso);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export const today = () => localDay(new Date());

// 'YYYY-MM-DD' → an ISO time at noon that day (local time).
export const dayToISO = (day) => new Date(day + 'T12:00:00').toISOString();

// "Oct 31, 2026"
export const fmtDate = (iso) =>
  new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });

// "Oct 31"
export const shortDate = (ms) => new Date(ms).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

// "just now", "5 min ago", "3 hr ago", then the date.
export function ago(ms) {
  if (!ms) return '';
  const s = Math.round((Date.now() - ms) / 1000);
  if (s < 45) return 'just now';
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} hr ago`;
  return shortDate(ms);
}

// "today", "yesterday", "12 days ago", then the full date.
export function daysAgo(ms) {
  if (!ms) return 'never';
  const d = Math.floor((Date.now() - ms) / 86400000);
  if (d <= 0) return 'today';
  if (d === 1) return 'yesterday';
  if (d < 30) return `${d} days ago`;
  return fmtDate(ms);
}

// ---------- Device storage ----------
// localStorage can throw (private browsing, storage full), so these never do.

export function readJSON(key, fallback = null) {
  try {
    const v = JSON.parse(localStorage.getItem(key) || 'null');
    return v ?? fallback;
  } catch (e) {
    return fallback;
  }
}

export function writeJSON(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (e) {
    return false;
  }
}

// ---------- Motion ----------

export const reducedMotion = () =>
  !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
