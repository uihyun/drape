import { describe, it, expect } from 'vitest';
import { STUCK_TRYON_MS, tryonCreatedMs, effectiveTryonStatus } from '../src/utils/tryonStatus.js';

const NOW = Date.parse('2026-06-30T12:00:00Z');
const tsFor = (ms) => ({ toMillis: () => ms });        // Firestore Timestamp shape
const dateFor = (ms) => ({ toDate: () => new Date(ms) }); // alt Timestamp shape

describe('tryonCreatedMs — reads createdAt in any supported shape', () => {
  it('Timestamp.toMillis()', () => {
    expect(tryonCreatedMs({ createdAt: tsFor(NOW) })).toBe(NOW);
  });
  it('Timestamp.toDate()', () => {
    expect(tryonCreatedMs({ createdAt: dateFor(NOW) })).toBe(NOW);
  });
  it('ISO string', () => {
    expect(tryonCreatedMs({ createdAt: '2026-06-30T12:00:00.000Z' })).toBe(NOW);
  });
  it('missing createdAt → 0', () => {
    expect(tryonCreatedMs({})).toBe(0);
    expect(tryonCreatedMs(null)).toBe(0);
  });
});

describe('effectiveTryonStatus — long-pending reads as failed', () => {
  it('ready / failed pass through untouched', () => {
    expect(effectiveTryonStatus({ status: 'ready', createdAt: tsFor(0) }, NOW)).toBe('ready');
    expect(effectiveTryonStatus({ status: 'failed', createdAt: tsFor(0) }, NOW)).toBe('failed');
  });
  it('fresh pending (< 5 min) stays pending', () => {
    const created = NOW - (STUCK_TRYON_MS - 1000); // 4m59s ago
    expect(effectiveTryonStatus({ status: 'pending', createdAt: tsFor(created) }, NOW)).toBe('pending');
  });
  it('stale pending (> 5 min) becomes failed', () => {
    const created = NOW - (STUCK_TRYON_MS + 1000); // 5m01s ago
    expect(effectiveTryonStatus({ status: 'pending', createdAt: tsFor(created) }, NOW)).toBe('failed');
  });
  it('pending with no createdAt stays pending (never falsely marked stuck)', () => {
    expect(effectiveTryonStatus({ status: 'pending' }, NOW)).toBe('pending');
  });
  it('missing status → unknown', () => {
    expect(effectiveTryonStatus({}, NOW)).toBe('unknown');
    expect(effectiveTryonStatus(null, NOW)).toBe('unknown');
  });
});
