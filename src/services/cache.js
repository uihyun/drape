// In-memory query cache with TTL.
//
// Lives for the JS lifetime of the tab — reset on full page reload, not on
// navigation. Used to make page-to-page navigation feel instant: pages
// peek the cache first to render the previously-seen content immediately,
// then refresh in the background.
//
// Not a full replacement for react-query / SWR — just a thin shim where
// services explicitly opt in. Writes invalidate keys via `del`.

const store = new Map(); // key -> { value, expiresAt }
const DEFAULT_TTL_MS = 60 * 1000; // 1 minute — short enough to feel fresh, long enough to bridge most navigations.

export const QueryCache = {
  get(key) {
    const entry = store.get(key);
    if (!entry) return undefined;
    if (Date.now() > entry.expiresAt) {
      store.delete(key);
      return undefined;
    }
    return entry.value;
  },

  set(key, value, ttlMs = DEFAULT_TTL_MS) {
    store.set(key, { value, expiresAt: Date.now() + ttlMs });
  },

  del(key) {
    store.delete(key);
  },

  // Bulk-invalidate by prefix — useful when an update should bust multiple
  // related cache entries (e.g. all `design:abc:*` after a design update).
  delByPrefix(prefix) {
    for (const k of store.keys()) {
      if (typeof k === 'string' && k.startsWith(prefix)) store.delete(k);
    }
  },

  clear() {
    store.clear();
  },
};
