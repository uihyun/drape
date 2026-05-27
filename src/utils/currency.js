// Marketplace currency comes from the *seller's* location, not the
// viewer's locale — a Tokyo seller's price is ¥-denominated regardless of
// who's browsing. We stamp the currency code onto the item at list time
// (see ItemService.updateItem) so future viewers don't need the seller's
// profile to format the price.

const COUNTRY_TO_CURRENCY = {
  KR: 'KRW',
  JP: 'JPY',
  US: 'USD',
  CA: 'USD', // simplification — CAD support when we onboard CA sellers
  GB: 'GBP',
  AU: 'USD',
  // EU countries → EUR. List the ones drape's city set covers.
  FR: 'EUR', DE: 'EUR', IT: 'EUR', ES: 'EUR', NL: 'EUR', BE: 'EUR',
  AT: 'EUR', IE: 'EUR', PT: 'EUR', GR: 'EUR', FI: 'EUR',
};

const CURRENCY_SYMBOL = {
  KRW: '₩',
  JPY: '¥',
  USD: '$',
  GBP: '£',
  EUR: '€',
};

export function currencyForCountry(country) {
  return COUNTRY_TO_CURRENCY[country] || 'KRW';
}

export function currencySymbol(code) {
  return CURRENCY_SYMBOL[code] || code || '₩';
}

// Format a numeric amount with the currency symbol. JPY/KRW are whole
// numbers; USD/EUR/GBP show 2 decimals when the amount isn't a clean
// integer. Locale formatting kept simple — no grouping locale switch.
export function formatPrice(amount, currency) {
  if (amount == null || amount === '' || Number.isNaN(Number(amount))) return '';
  const n = Number(amount);
  const sym = currencySymbol(currency);
  if (currency === 'KRW' || currency === 'JPY') {
    return `${sym}${Math.round(n).toLocaleString()}`;
  }
  return `${sym}${n.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}
