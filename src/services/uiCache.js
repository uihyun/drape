// Shared module-level caches for instant paint across mounts. Lives here (not
// inside a page) so the splash warm-up (services/warmup.js) can prime the same
// Map instances the pages read from on first render.

// Feed pages — keyed by `${kind}|${sort}|${scope}` (Feed.jsx).
export const feedCache = new Map();
export const feedKey = (kind, sort, scope) => `${kind}|${sort}|${scope}`;

// Remove one id from EVERY cached feed page (all tabs, uniformly). Called when a
// detail page discovers the post was deleted/unavailable (a tombstone), so
// going back shows a list without the dead entry instead of stranding the user
// on a ghost. Not tied to the viewer's own mutations — only to confirmed
// deletions — so it stays consistent across ootds/boards/market.
export function dropFromFeedCaches(id) {
  for (const [k, entry] of feedCache.entries()) {
    if (Array.isArray(entry)) {
      feedCache.set(k, entry.filter(it => it.id !== id));
    } else if (entry && Array.isArray(entry.items)) {
      feedCache.set(k, { ...entry, items: entry.items.filter(it => it.id !== id) });
    }
  }
}

// Outfit lists — keyed by `${uid}|${tab}` (OutfitList.jsx).
export const olCache = new Map();
export const olKey = (uid, tab) => `${uid}|${tab}`;

// Warm snapshots taken during splash for the live-subscribed surfaces, so the
// page paints instantly then attaches its own onSnapshot for live updates.
export const calendarWarm = new Map(); // `${uid}|${YYYY-MM}` -> { [date]: ootd[] }
export const closetWarm = new Map();   // `${uid}` -> item[]

// Last stylist recommendation, kept across unmounts so tapping an item and
// coming back doesn't throw the picks away (they cost a free slot or a fit
// to produce — losing them on a detour is the worst possible outcome).
// Keyed `${uid}:${persona}` — a stylist's picks belong to that stylist, so
// switching personas must not show the previous one's work (and coming back
// should still find it).
export const stylistWarm = new Map();

// Keyed `${outfitId}:${persona}` — a verdict belongs to the stylist who gave
// it, so switching personas asks again (which is the point: a different
// stylist should reach a different call).
//
// Unlike the caches above this one is PERSISTED. The others are speed: losing
// them costs a reload. Losing a verdict costs the user a button press to see
// an answer they already have, which reads as the app forgetting. Small enough
// to keep — a few hundred bytes each, capped at VERDICT_KEEP by insertion
// order, oldest dropped first.
const VERDICT_STORE = 'drape_verdicts_v1';
const VERDICT_KEEP = 40;

function loadVerdicts() {
  try {
    const raw = JSON.parse(localStorage.getItem(VERDICT_STORE) || '{}');
    return new Map(Object.entries(raw));
  } catch { return new Map(); }
}

export const verdictWarm = loadVerdicts();

export function rememberVerdict(key, value) {
  verdictWarm.set(key, value);
  try {
    // Map preserves insertion order, so trimming from the front drops the
    // oldest. Re-setting an existing key does not move it, which is fine:
    // re-reads are free, only first asks matter.
    const entries = [...verdictWarm.entries()].slice(-VERDICT_KEEP);
    verdictWarm.clear();
    for (const [k, v] of entries) verdictWarm.set(k, v);
    localStorage.setItem(VERDICT_STORE, JSON.stringify(Object.fromEntries(entries)));
  } catch { /* private mode / quota — the in-memory Map still works */ }
}
