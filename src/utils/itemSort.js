import { CATEGORIES, COLOR_HEX } from '../services/taxonomy.js';

// ── Sorting (owner request 2026-09-15) ─────────────────────────────────
// Default stays "newest added" (the subscription order). Brightness sorts
// use the item's first tagged color mapped through the swatch hexes —
// untagged items sink to the end in both directions.
export const SORT_OPTIONS = [
  { value: 'newest', labelKey: 'sortNewest' },
  { value: 'oldest', labelKey: 'sortOldest' },
  { value: 'bright', labelKey: 'sortBright' },
  { value: 'dark', labelKey: 'sortDark' },
  { value: 'category', labelKey: 'sortCategory' },
  { value: 'mostWorn', labelKey: 'sortMostWorn' },
  { value: 'leastWorn', labelKey: 'sortLeastWorn' },
];

function luminance(item) {
  const hex = COLOR_HEX[item.tags?.colors?.[0]];
  if (!hex) return null;
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

const ts = (v) => (v?.toMillis ? v.toMillis() : 0);

export function sortItems(list, mode) {
  const arr = [...list];
  switch (mode) {
    case 'oldest':
      return arr.sort((a, b) => ts(a.createdAt) - ts(b.createdAt));
    case 'bright':
      return arr.sort((a, b) => (luminance(b) ?? -1) - (luminance(a) ?? -1));
    case 'dark':
      return arr.sort((a, b) => (luminance(a) ?? 1e9) - (luminance(b) ?? 1e9));
    case 'category':
      return arr.sort((a, b) => {
        const ai = CATEGORIES.indexOf(a.tags?.category);
        const bi = CATEGORIES.indexOf(b.tags?.category);
        if (ai !== bi) return (ai < 0 ? 99 : ai) - (bi < 0 ? 99 : bi);
        return ts(b.createdAt) - ts(a.createdAt);
      });
    case 'mostWorn':
      return arr.sort((a, b) => (b.wornCount || 0) - (a.wornCount || 0)
        || (b.lastWornAt || '').localeCompare(a.lastWornAt || ''));
    case 'leastWorn': // the "rediscover forgotten pieces" order
      return arr.sort((a, b) => (a.wornCount || 0) - (b.wornCount || 0)
        || (a.lastWornAt || '').localeCompare(b.lastWornAt || ''));
    default:
      return arr; // 'newest' — subscription already orders createdAt desc
  }
}
