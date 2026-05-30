// Shared tag-filter model for "looks" (try-ons + outfits + boards).
// Closet-style faceted filtering with NO free-text search — the whole app
// filters by the same tag vocabulary.
//
// Looks don't carry denormalized tag arrays; we derive them on the fly
// from the embedded analysis pieces (`pieces` on OOTDs, `detectedItems`
// on analyzed looks) plus the editorial `style` breakdown. Only the
// dimensions that actually exist on a piece are offered — seasons/fits
// live on closet items, not on looks, so they're intentionally absent
// here (the closet has its own full filter).
import {
  CATEGORIES, COLORS, STYLES,
} from '../services/taxonomy.js';

export const LOOK_FILTER_DIMS = [
  { key: 'styles',     labelKey: 'filterStyles',   options: STYLES },
  { key: 'categories', labelKey: 'filterCategory', options: CATEGORIES },
  { key: 'colors',     labelKey: 'filterColors',   options: COLORS },
];

export function emptyLookFilters() {
  return { styles: [], categories: [], colors: [] };
}

export function countLookFilters(f) {
  return Object.values(f).reduce((n, arr) => n + (arr?.length || 0), 0);
}

// Pull the taggable values off a look's analysis pieces. A piece carries
// { category, subcategory, colors[], styles[], brand } (see itemMatch.js);
// OOTDs expose them as `pieces`, analyzed looks as `detectedItems`.
function lookFilterArrays(look) {
  const pieces = Array.isArray(look.pieces) ? look.pieces
    : Array.isArray(look.detectedItems) ? look.detectedItems
    : [];
  const collect = (key) => pieces.flatMap(p => {
    const v = p?.[key];
    if (Array.isArray(v)) return v;
    return v != null && v !== '' ? [v] : [];
  });
  const styleLabels = Array.isArray(look.style)
    ? look.style.map(s => s?.label).filter(Boolean)
    : [];
  return {
    styles: [...new Set([...styleLabels, ...collect('styles')])],
    categories: [...new Set(collect('category'))],
    colors: [...new Set(collect('colors'))],
  };
}

// Does a look match the active filters? Empty dimension = no constraint.
// OR within a dimension, AND across dimensions.
export function lookMatches(look, filters) {
  const arrays = lookFilterArrays(look);
  for (const dim of Object.keys(filters)) {
    const want = filters[dim];
    if (!want?.length) continue;
    const have = new Set(arrays[dim] || []);
    if (!want.some(v => have.has(v))) return false;
  }
  return true;
}

// Board variant: a board has no analysis of its own, but it pins closet
// items (stickers[].itemId). Build the same tag arrays from the hydrated
// items and reuse the look matcher. `itemsById` maps itemId -> item doc.
export function boardMatches(board, itemsById, filters) {
  if (countLookFilters(filters) === 0) return true;
  const ids = Array.from(new Set((board?.stickers || []).map(s => s.itemId).filter(Boolean)));
  const styles = new Set();
  const categories = new Set();
  const colors = new Set();
  for (const id of ids) {
    const tags = itemsById?.[id]?.tags;
    if (!tags) continue;
    if (tags.category) categories.add(tags.category);
    (tags.colors || []).forEach(c => colors.add(c));
    (tags.styles || []).forEach(s => styles.add(s));
  }
  const have = { styles, categories, colors };
  for (const dim of Object.keys(filters)) {
    const want = filters[dim];
    if (!want?.length) continue;
    if (!want.some(v => have[dim]?.has(v))) return false;
  }
  return true;
}
