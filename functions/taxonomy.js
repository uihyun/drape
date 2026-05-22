// Server-side mirror of src/services/taxonomy.js. Kept in sync manually —
// the function output schema for auto-tag uses these enums verbatim, so a
// client/server drift would silently produce invalid tag values.

const CATEGORIES = [
  'outerwear', 'top', 'bottom', 'dress', 'footwear',
  'bag', 'accessory', 'innerwear', 'other',
];

const SUBCATEGORIES = {
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

const COLORS = [
  'black', 'white', 'gray', 'beige', 'brown',
  'navy', 'blue', 'lightblue',
  'green', 'olive',
  'red', 'pink',
  'orange', 'yellow',
  'purple',
  'patterned', 'multicolor',
];

const SEASONS = ['spring', 'summer', 'fall', 'winter'];

const STYLES = [
  'minimal', 'classic', 'street', 'casual', 'preppy',
  'sporty', 'workwear', 'romantic', 'y2k', 'gorpcore', 'avant-garde',
];

const FITS = ['slim', 'regular', 'oversized', 'tailored'];

module.exports = {
  CATEGORIES,
  SUBCATEGORIES,
  COLORS,
  SEASONS,
  STYLES,
  FITS,
};
