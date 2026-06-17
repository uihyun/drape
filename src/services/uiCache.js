// Shared module-level caches for instant paint across mounts. Lives here (not
// inside a page) so the splash warm-up (services/warmup.js) can prime the same
// Map instances the pages read from on first render.

// Feed pages — keyed by `${kind}|${sort}|${scope}` (Feed.jsx).
export const feedCache = new Map();
export const feedKey = (kind, sort, scope) => `${kind}|${sort}|${scope}`;

// Surgically drop one item from the cached market pages — used on unlist /
// delete so the card disappears WITHOUT a full refetch (no loading flash, no
// cascade). The page is restored from cache minus that item; only its slot
// reflows. Handles both the {items,…} page shape and the bare-array warm shape.
export function removeFromMarketFeed(itemId) {
  for (const [k, entry] of feedCache.entries()) {
    if (!k.startsWith('market|')) continue;
    if (Array.isArray(entry)) {
      feedCache.set(k, entry.filter(it => it.id !== itemId));
    } else if (entry && Array.isArray(entry.items)) {
      feedCache.set(k, { ...entry, items: entry.items.filter(it => it.id !== itemId) });
    }
  }
}

// Drop the whole cached market feed — used when an item is newly LISTED, where
// we can't surgically insert it at the right sorted position, so a one-time
// refetch on the next Feed visit is the simplest correct path. Listing-on is
// rare, so the refetch is acceptable; unlist/delete use removeFromMarketFeed.
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
