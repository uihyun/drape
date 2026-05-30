// === Drape clothing tag taxonomy =======================================
// Three orthogonal axes plus a small set of structural attributes. The
// closed vocabulary is the asset — it powers auto-tag (Gemini structured
// output), search/filter, recommendations, and feed exploration.
//
// Keep keys stable; localize via locales/{en,ko}.js `taxonomy.*`. Adding a
// new value here without adding both translations will fall back to the
// raw key in the UI.

// Top-level category. Outer/topwear/bottoms/dress/footwear/bag/accessory.
// Mirrors how a person mentally pulls an outfit together.
export const CATEGORIES = [
  'outerwear',   // coat, jacket, blazer, cardigan, vest
  'top',         // t-shirt, shirt, sweater, hoodie, blouse, knit
  'bottom',      // jeans, pants, skirt, shorts, leggings
  'dress',       // dress, jumpsuit (one-piece silhouettes)
  'footwear',    // sneakers, boots, heels, loafers, sandals
  'bag',         // tote, crossbody, backpack, clutch, shoulder
  'accessory',   // hat, scarf, belt, jewelry, sunglasses, watch
  'innerwear',   // base layers, lingerie — usually hidden from public feed
  'other',
];

// Fine-grained subcategory — optional. Hint for the model + filter chips.
// Keep narrow; expand as the user base reveals what's missing.
export const SUBCATEGORIES = {
  outerwear: ['coat', 'jacket', 'blazer', 'cardigan', 'vest', 'puffer', 'trench'],
  top:       ['t-shirt', 'shirt', 'sweater', 'hoodie', 'blouse', 'knit', 'tank'],
  bottom:    ['jeans', 'pants', 'skirt', 'shorts', 'leggings', 'sweatpants'],
  dress:     ['dress', 'jumpsuit', 'romper'],
  footwear:  ['sneakers', 'boots', 'heels', 'loafers', 'sandals', 'flats'],
  bag:       ['tote', 'crossbody', 'backpack', 'clutch', 'shoulder', 'duffel'],
  accessory: ['hat', 'scarf', 'belt', 'jewelry', 'sunglasses', 'watch', 'tie', 'gloves'],
  innerwear: ['bra', 'underwear', 'baselayer', 'socks', 'tights'],
  other:     [],
};

// Color palette — perceptual buckets, not hex. The vision model picks the
// closest bucket; the UI shows the bucket name + a swatch (defined in CSS).
export const COLORS = [
  'black', 'white', 'gray', 'beige', 'brown',
  'navy', 'blue', 'lightblue',
  'green', 'olive',
  'red', 'pink',
  'orange', 'yellow',
  'purple',
  'patterned', 'multicolor',
];

// Hex previews for the swatch chips. Approximate; refine as needed.
export const COLOR_HEX = {
  black:     '#0E0E10',
  white:     '#FAFAFA',
  gray:      '#9A9AA3',
  beige:     '#D9C9B0',
  brown:     '#6E4A2F',
  navy:      '#1F2A52',
  blue:      '#3A6EE5',
  lightblue: '#9AC4F8',
  green:     '#3F8C5C',
  olive:     '#6B6E3C',
  red:       '#D8333A',
  pink:      '#EFB1C2',
  orange:    '#E68A3A',
  yellow:    '#F3D14C',
  purple:    '#7E58C2',
  patterned: 'linear-gradient(135deg,#0E0E10 0 33%,#FAFAFA 33% 66%,#5B5BD6 66%)',
  multicolor:'linear-gradient(90deg,#D8333A,#F3D14C,#3F8C5C,#3A6EE5,#7E58C2)',
};

// Seasonal applicability. An item can match multiple seasons (e.g. a thin
// trench works spring + fall) so the field on Item is `seasons: []`.
export const SEASONS = ['spring', 'summer', 'fall', 'winter'];

// Style labels — adapted from Lekondo's "ontology" angle but kept small to
// start. Add new ones from real user data, not speculatively.
export const STYLES = [
  'minimal',
  'classic',
  'street',
  'casual',
  'preppy',
  'sporty',
  'workwear',
  'romantic',
  'y2k',
  'gorpcore',
  'avant-garde',
];

// Fit + length structural attributes that affect how try-on composites the
// item. The model picks one of each (or 'unknown').
export const FITS = ['slim', 'regular', 'oversized', 'tailored'];
export const LENGTHS = {
  top:     ['cropped', 'regular', 'long', 'tunic'],
  bottom:  ['short', 'knee', 'midi', 'full'],
  dress:   ['mini', 'midi', 'maxi'],
  outerwear: ['cropped', 'regular', 'long'],
};

export const TAXONOMY = {
  categories: CATEGORIES,
  subcategories: SUBCATEGORIES,
  colors: COLORS,
  colorHex: COLOR_HEX,
  seasons: SEASONS,
  styles: STYLES,
  fits: FITS,
  lengths: LENGTHS,
};

// Display label for an item's category — prefers the fine-grained
// subcategory ("Shirt") over the broad category ("Top") so cards/labels
// read specifically. Falls back: localized subcategory → capitalized raw
// subcategory → localized category. `t` is the locale lookup.
export function categoryLabel(tags, t) {
  const cat = tags?.category;
  const sub = tags?.subcategory;
  if (sub) {
    const localized = t(`taxonomy.subcategories.${sub}`);
    if (localized && localized !== `taxonomy.subcategories.${sub}`) return localized;
    return sub.charAt(0).toUpperCase() + sub.slice(1);
  }
  return cat ? t(`taxonomy.categories.${cat}`) : '';
}

export default TAXONOMY;
