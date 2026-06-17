// Shared module-level caches for instant paint across mounts. Lives here (not
// inside a page) so the splash warm-up (services/warmup.js) can prime the same
// Map instances the pages read from on first render.

// Feed pages — keyed by `${kind}|${sort}|${scope}` (Feed.jsx).
export const feedCache = new Map();
export const feedKey = (kind, sort, scope) => `${kind}|${sort}|${scope}`;

// Outfit lists — keyed by `${uid}|${tab}` (OutfitList.jsx).
export const olCache = new Map();
export const olKey = (uid, tab) => `${uid}|${tab}`;

// Warm snapshots taken during splash for the live-subscribed surfaces, so the
// page paints instantly then attaches its own onSnapshot for live updates.
export const calendarWarm = new Map(); // `${uid}|${YYYY-MM}` -> { [date]: ootd[] }
export const closetWarm = new Map();   // `${uid}` -> item[]
