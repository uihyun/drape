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
