import { describe, it, expect } from 'vitest';
import {
  classify, dayKey, buildTrends, summarizeBuckets, bump, emptyTrends,
} from '../functions/admin-helpers.js';

describe('classify — real / seed / dev buckets', () => {
  it('dev uids are dev regardless of email', () => {
    expect(classify('6cFtHe7gFmSRJA22JDqvE2ZTGJn1', { email: 'x@extras-seed.example.com' })).toBe('dev');
  });
  it('seed by email suffix', () => {
    expect(classify('someuid', { email: 'amy.abc123@extras-seed.example.com' })).toBe('seed');
  });
  it('seed by src flag', () => {
    expect(classify('someuid', { src: 'seed' })).toBe('seed');
  });
  it('everyone else is real', () => {
    expect(classify('organicUid', { email: 'real@gmail.com' })).toBe('real');
    expect(classify('organicUid', {})).toBe('real'); // no email/src (e.g. missing profile)
  });
});

describe('dayKey — Timestamp / ISO / RFC-1123 / junk', () => {
  it('Firestore Timestamp (has toDate)', () => {
    const ts = { toDate: () => new Date('2026-06-30T12:34:56Z') };
    expect(dayKey(ts)).toBe('2026-06-30');
  });
  it('ISO string', () => {
    expect(dayKey('2026-06-30T12:34:56.000Z')).toBe('2026-06-30');
  });
  it('Auth RFC-1123 creationTime string (the bug that regressed)', () => {
    // Firebase Auth returns metadata.creationTime in this format, NOT ISO.
    expect(dayKey('Wed, 30 Jun 2026 12:34:56 GMT')).toBe('2026-06-30');
  });
  it('null / undefined / empty → null', () => {
    expect(dayKey(null)).toBeNull();
    expect(dayKey(undefined)).toBeNull();
    expect(dayKey('')).toBeNull();
  });
  it('unparseable string → null (not a garbage slice)', () => {
    expect(dayKey('not a date')).toBeNull();
  });
});

describe('bump / emptyTrends', () => {
  it('bump increments only for truthy keys', () => {
    const m = {};
    bump(m, '2026-06-30'); bump(m, '2026-06-30'); bump(m, null); bump(m, '');
    expect(m).toEqual({ '2026-06-30': 2 });
  });
  it('emptyTrends has the five metric maps', () => {
    expect(Object.keys(emptyTrends()).sort()).toEqual(['boards', 'items', 'ootds', 'signups', 'tryons']);
  });
});

describe('buildTrends — aligned, gap-filled daily series', () => {
  it('empty maps → empty series per metric', () => {
    const out = buildTrends({ signups: {}, items: {} });
    expect(out).toEqual({ signups: [], items: [] });
  });
  it('all metrics share one date axis (same length + same days)', () => {
    const out = buildTrends({ signups: { '2026-06-28': 2 }, items: { '2026-06-30': 5 } });
    expect(out.signups.length).toBe(out.items.length);
    expect(out.signups.map((p) => p.day)).toEqual(out.items.map((p) => p.day));
  });
  it('axis starts at the earliest data day and gap-fills missing days with 0', () => {
    const out = buildTrends({ signups: { '2026-06-28': 2 } });
    expect(out.signups[0]).toEqual({ day: '2026-06-28', count: 2 });
    // day after the earliest, before today → filled with 0
    expect(out.signups[1]).toEqual({ day: '2026-06-29', count: 0 });
    expect(out.signups.every((p) => typeof p.count === 'number')).toBe(true);
  });
  it('counts land on their correct day', () => {
    const out = buildTrends({ items: { '2026-06-28': 3, '2026-06-29': 7 } });
    const byDay = Object.fromEntries(out.items.map((p) => [p.day, p.count]));
    expect(byDay['2026-06-28']).toBe(3);
    expect(byDay['2026-06-29']).toBe(7);
  });
});

describe('summarizeBuckets — per-bucket account/active/action totals', () => {
  const data = {
    u: { a: { items: 3, ootd: 0, ootdPriv: 0, board: 0, tryon: 2 }, b: { items: 0, ootd: 1, ootdPriv: 0, board: 0, tryon: 0 } },
    buckets: { real: ['a', 'b', 'c'], seed: [], dev: [] },
  };
  const out = summarizeBuckets(data);
  it('accounts = bucket size, active = uids with any action doc', () => {
    expect(out.real.accounts).toBe(3);       // a, b, c
    expect(out.real.active).toBe(2);         // c has no u[] entry
  });
  it('per-action users + totals', () => {
    expect(out.real.items).toEqual({ users: 1, total: 3 }); // only a has items
    expect(out.real.tryon).toEqual({ users: 1, total: 2 });
    expect(out.real.ootd).toEqual({ users: 1, total: 1 });
  });
  it('empty bucket → zeros', () => {
    expect(out.seed.accounts).toBe(0);
    expect(out.seed.items).toEqual({ users: 0, total: 0 });
  });
});
