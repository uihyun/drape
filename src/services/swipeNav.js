// Shared plumbing for "swipe between detail pages". A list hands the detail
// page its ordered sibling ids + the tapped index via react-router state, so
// the detail knows what previous/next mean without guessing which surface it
// came from — the same outfit opens from the feed, profile, calendar, etc.,
// each with its own ordering.

export const SWIPE_ROUTES = {
  outfit: (id) => `/o/${id}`,
  board: (id) => `/boards/${id}`,
  item: (id) => `/i/${id}`,
  tryon: (id) => `/tryon/${id}`,
};

// Build the `state` object for a card <Link>. Returns undefined when the list
// is too short to swipe (single item) or the inputs are bad, so the Link just
// carries no state and the detail behaves like a normal standalone page.
export function buildSwipeState(ids, index, type) {
  if (!Array.isArray(ids) || ids.length < 2) return undefined;
  if (typeof index !== 'number' || index < 0 || index >= ids.length) return undefined;
  if (!SWIPE_ROUTES[type]) return undefined;
  return { swipe: { ids, i: index, type } };
}
