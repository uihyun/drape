// Tag-based closet matching for the "outfit → pieces you own" surface.
// Given a detected piece (from functions/items.js detectItems — shape
// { category, subcategory, colors[], styles?, brand }) and a closet item
// (tags: { category, subcategory, colors[], styles[], brand }), score how
// similar they are 0..1. Category is a hard gate: a top never matches a
// shoe. The rest is weighted overlap so a same-category, same-color piece
// floats to the top while loose matches still appear.
//
// Pure + synchronous + zero-cost — no model call. This is Phase 1 of the
// wardrobe-match feature (see PROGRESS.md "FUTURE FEATURE"). External
// shop-idea cards are a separate later phase.

function jaccard(a, b) {
  const sa = new Set(a || []);
  const sb = new Set(b || []);
  if (sa.size === 0 && sb.size === 0) return 0;
  let inter = 0;
  for (const x of sa) if (sb.has(x)) inter++;
  const union = sa.size + sb.size - inter;
  return union === 0 ? 0 : inter / union;
}

/** Score one detected piece against one closet item. Returns 0 when the
 *  categories differ (hard gate), else 0..1. */
export function scoreMatch(piece, item) {
  const pCat = piece?.category || null;
  const iTags = item?.tags || {};
  const iCat = iTags.category || null;
  if (!pCat || !iCat || pCat !== iCat) return 0; // category gate

  const pSub = piece.subcategory || null;
  const iSub = iTags.subcategory || null;
  // Subcategory gate. When both sides know their subcategory and disagree,
  // it isn't a real match (a sash is not sunglasses). "accessory" lumps
  // wildly different objects under one category, so for accessories a
  // positive subcategory match is REQUIRED — better to show nothing than a
  // confidently wrong suggestion (e.g. sunglasses ↔ a black scarf).
  if (pSub && iSub && pSub !== iSub) return 0;
  if (pCat === 'accessory' && !(pSub && iSub && pSub === iSub)) return 0;

  let score = 0.35; // base for clearing the category gate
  if (pSub && iSub && pSub === iSub) {
    score += 0.25;
  }
  score += 0.30 * jaccard(piece.colors, iTags.colors);
  score += 0.15 * jaccard(piece.styles, iTags.styles);
  if (piece.brand && iTags.brand
    && piece.brand.trim().toLowerCase() === iTags.brand.trim().toLowerCase()) {
    score += 0.10;
  }
  return Math.min(1, score);
}

/** Rank closet items for a detected piece. Returns the best matches above
 *  `threshold`, sorted desc, capped at `limit`. Each entry: { item, score }. */
export function matchCloset(piece, closetItems, { threshold = 0.45, limit = 6 } = {}) {
  if (!piece || !Array.isArray(closetItems)) return [];
  return closetItems
    .map(item => ({ item, score: scoreMatch(piece, item) }))
    .filter(m => m.score >= threshold)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}
