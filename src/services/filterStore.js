// filterStore.js
//
// Keeps the active tag / facet filters for a list surface (closet, outfits,
// boards…) alive when the user leaves and comes back — open a detail, hop
// to another tab, even background the app — so they don't have to re-apply
// the same filter every time. A module-level Map covers in-session
// remounts instantly; sessionStorage mirrors it so a reload / native
// resume still restores. Anything older than TTL_MS is treated as stale
// and dropped, because a filter set days ago is almost never what the user
// still wants (the explicit ask: keep recent filters, forget old ones).

const TTL_MS = 30 * 60 * 1000; // 30 minutes
const PREFIX = 'drape_filter_';
const mem = new Map();

function fresh(entry) {
  return entry && typeof entry.at === 'number' && (Date.now() - entry.at) < TTL_MS;
}

/** Load saved filters for `key`, or `fallback` if none / stale. */
export function loadFilters(key, fallback) {
  const hit = mem.get(key);
  if (fresh(hit)) return hit.value;
  try {
    const raw = sessionStorage.getItem(PREFIX + key);
    if (raw) {
      const entry = JSON.parse(raw);
      if (fresh(entry)) { mem.set(key, entry); return entry.value; }
      sessionStorage.removeItem(PREFIX + key);
    }
  } catch { /* ignore */ }
  return fallback;
}

/** Persist filters for `key` with a freshness timestamp. */
export function saveFilters(key, value) {
  const entry = { at: Date.now(), value };
  mem.set(key, entry);
  try { sessionStorage.setItem(PREFIX + key, JSON.stringify(entry)); } catch { /* ignore */ }
}
