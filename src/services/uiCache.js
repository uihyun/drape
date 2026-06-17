// Shared module-level caches for instant paint across mounts. Lives here (not
// inside a page) so the splash warm-up (services/warmup.js) can prime the same
// Map instances the pages read from on first render.

// Feed pages — keyed by `${kind}|${sort}|${scope}` (Feed.jsx).
export const feedCache = new Map();
export const feedKey = (kind, sort, scope) => `${kind}|${sort}|${scope}`;

// Drop cached market-feed pages so a listing change (list / unlist / delete)
// shows on the next Feed visit instead of restoring a stale page within the TTL
// (the bug: an item removed from sale lingered until the cache expired / app
// restart). Scoped to the `market|…` keys so the ootds/boards tabs aren't
// needlessly refetched.
export function invalidateMarketFeed() {
  for (const k of feedCache.keys()) {
    if (k.startsWith('market|')) feedCache.delete(k);
  }
}

// Outfit lists — keyed by `${uid}|${tab}` (OutfitList.jsx).
export const olCache = new Map();
export const olKey = (uid, tab) => `${uid}|${tab}`;

// Warm snapshots taken during splash for the live-subscribed surfaces, so the
// page paints instantly then attaches its own onSnapshot for live updates.
export const calendarWarm = new Map(); // `${uid}|${YYYY-MM}` -> { [date]: ootd[] }
export const closetWarm = new Map();   // `${uid}` -> item[]
