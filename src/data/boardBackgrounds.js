// Board backdrop presets. A board doc stores `background: <key>`; the
// renderer (BoardThumbnail + editor canvas) maps the key to a CSS
// background value. Default 'paper' = the original soft surface.
//
// Keep these subtle — the clothes are the subject, the backdrop is mood.
export const BOARD_BACKGROUNDS = [
  { key: 'paper',    css: 'var(--surface-elevated)' },
  { key: 'white',    css: '#ffffff' },
  { key: 'cream',    css: '#f5f1e8' },
  { key: 'sand',     css: '#e7ddcd' },
  { key: 'sage',     css: '#dde5dc' },
  { key: 'sky',      css: '#dde7f0' },
  { key: 'blush',    css: '#f3e2e2' },
  { key: 'charcoal', css: '#2b2b2b' },
  { key: 'black',    css: '#111111' },
  // Textured / gradient
  { key: 'linen',    css: 'repeating-linear-gradient(45deg, #efe9dd 0 2px, #e8e1d2 2px 4px)' },
  { key: 'grid',     css: 'linear-gradient(#0000000d 1px, transparent 1px), linear-gradient(90deg, #0000000d 1px, transparent 1px) , #faf8f3', size: '16px 16px, 16px 16px, auto' },
  { key: 'sunset',   css: 'linear-gradient(160deg, #f6d9c4 0%, #e8c1cf 100%)' },
  { key: 'dusk',     css: 'linear-gradient(160deg, #c9d2e6 0%, #b8aec9 100%)' },
  // Flat-lay surfaces — soft mottled texture under the clothes (Instagram
  // amazonfashion vibe): fluffy rug, woven, light wood, marble.
  { key: 'rug',      css: 'radial-gradient(circle at 30% 20%, #ffffff 0%, transparent 45%), radial-gradient(circle at 70% 60%, #f3f0ea 0%, transparent 40%), radial-gradient(circle at 50% 90%, #ece7df 0%, transparent 50%), #efeae1', size: '120px 120px, 100px 100px, 140px 140px, auto' },
  { key: 'woven',    css: 'repeating-linear-gradient(45deg, #e6ddc9 0 6px, #ddd2ba 6px 12px), repeating-linear-gradient(-45deg, #0000000a 0 6px, transparent 6px 12px)', size: '12px 12px, 12px 12px' },
  { key: 'wood',     css: 'repeating-linear-gradient(90deg, #d8b78f 0 18px, #cda979 18px 22px, #d8b78f 22px 40px)' },
  { key: 'marble',   css: 'radial-gradient(circle at 20% 30%, #ffffff 0%, transparent 35%), radial-gradient(circle at 80% 70%, #eceef1 0%, transparent 40%), linear-gradient(135deg, #f6f7f9, #eef0f3)', size: '160px 160px, 140px 140px, auto' },
];

const BY_KEY = Object.fromEntries(BOARD_BACKGROUNDS.map(b => [b.key, b]));

/** Inline style object for a board background key. Falls back to 'paper'. */
export function boardBgStyle(key) {
  const b = BY_KEY[key] || BY_KEY.paper;
  const style = { background: b.css };
  if (b.size) style.backgroundSize = b.size;
  // Dark backdrops want light sticker shadows — expose a flag via a data attr
  // the caller can use if needed; keeping it simple here.
  return style;
}

export const DEFAULT_BOARD_BG = 'paper';

// Board canvas shapes. Width is always the container width; the ratio sets
// the height. Stored on the doc as `ratio` (key); default portrait 3:4.
export const BOARD_RATIOS = [
  { key: 'portrait',  css: '3 / 4' },
  { key: 'square',    css: '1 / 1' },
  { key: 'landscape', css: '4 / 3' },
];
const RATIO_BY_KEY = Object.fromEntries(BOARD_RATIOS.map(r => [r.key, r]));
export const DEFAULT_BOARD_RATIO = 'portrait';

/** CSS aspect-ratio for a board ratio key. Falls back to portrait. */
export function boardRatioCss(key) {
  return (RATIO_BY_KEY[key] || RATIO_BY_KEY.portrait).css;
}

/** Height-as-%-of-width for the padding-top aspect-box trick. WebKit mis-sizes
 *  `aspect-ratio` inside CSS multi-column (the board grid), rendering cards at a
 *  different height than Blink → uneven columns on iPhone but not Chrome. A
 *  padding-top percentage is honored identically by both engines in multicol. */
export function boardRatioPad(key) {
  const [w, h] = boardRatioCss(key).split('/').map(s => parseFloat(s));
  return `${(h / w) * 100}%`;
}
