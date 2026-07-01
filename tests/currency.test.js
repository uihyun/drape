import { describe, it, expect } from 'vitest';
import { currencyForCountry, currencySymbol, formatPrice } from '../src/utils/currency.js';

describe('currencyForCountry', () => {
  it('maps known countries', () => {
    expect(currencyForCountry('KR')).toBe('KRW');
    expect(currencyForCountry('JP')).toBe('JPY');
    expect(currencyForCountry('US')).toBe('USD');
    expect(currencyForCountry('GB')).toBe('GBP');
    expect(currencyForCountry('FR')).toBe('EUR');
  });
  it('defaults to KRW for unknown / null', () => {
    expect(currencyForCountry('ZZ')).toBe('KRW');
    expect(currencyForCountry(null)).toBe('KRW');
    expect(currencyForCountry(undefined)).toBe('KRW');
  });
});

describe('currencySymbol', () => {
  it('known codes', () => {
    expect(currencySymbol('KRW')).toBe('₩');
    expect(currencySymbol('JPY')).toBe('¥');
    expect(currencySymbol('USD')).toBe('$');
    expect(currencySymbol('EUR')).toBe('€');
  });
  it('unknown code falls back to the code itself, empty → ₩', () => {
    expect(currencySymbol('XAU')).toBe('XAU');
    expect(currencySymbol('')).toBe('₩');
  });
});

describe('formatPrice', () => {
  it('KRW/JPY are whole numbers, rounded', () => {
    expect(formatPrice(12000, 'KRW')).toBe('₩12,000');
    expect(formatPrice(1999.7, 'JPY')).toBe('¥2,000');
  });
  it('USD/EUR show up to 2 decimals, no forced trailing zeros', () => {
    expect(formatPrice(20, 'USD')).toBe('$20');
    expect(formatPrice(19.9, 'USD')).toBe('$19.9');
    expect(formatPrice(19.99, 'EUR')).toBe('€19.99');
  });
  it('empty / null / NaN → empty string', () => {
    expect(formatPrice(null, 'USD')).toBe('');
    expect(formatPrice('', 'USD')).toBe('');
    expect(formatPrice('abc', 'USD')).toBe('');
  });
});
