// Device-local UI preferences — persistent (no TTL, unlike filterStore) and
// kept off the server because they're per-device display choices, not account
// data. Persisted in localStorage; a custom event lets an already-mounted
// screen react to a change made on another screen without a remount.

const PREFIX = 'drape_pref_';
const EVT = 'drape:pref-change';

export function getPref(key, fallback) {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    return raw == null ? fallback : JSON.parse(raw);
  } catch {
    return fallback;
  }
}

export function setPref(key, value) {
  try { localStorage.setItem(PREFIX + key, JSON.stringify(value)); } catch { /* private mode */ }
  try { window.dispatchEvent(new CustomEvent(EVT, { detail: { key, value } })); } catch { /* SSR */ }
}

/** React to changes of a single pref key. Returns an unsubscribe fn. */
export function onPrefChange(key, cb) {
  const h = (e) => { if (e.detail?.key === key) cb(e.detail.value); };
  window.addEventListener(EVT, h);
  return () => window.removeEventListener(EVT, h);
}

// Calendar day-cell image: show the full OOTD photo (with background) instead
// of the segmented cutout. Default false = cutout (figure on the card).
export const PREF_CALENDAR_BG = 'calendarShowBackground';
