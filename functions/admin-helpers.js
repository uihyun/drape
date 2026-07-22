// Pure helpers for the admin analytics aggregation — no firebase-admin /
// firebase-functions deps, so they're unit-testable in isolation (see
// tests/admin-helpers.test.js). functions/admin.js requires these.

// Bucket classification — keep identical to scripts/db-stats.cjs:31-45 so the
// admin page and the local script never disagree on who counts as "real".
const DEV = new Set([
  'uGbBCTlG1HZipGVHJ1K9TqEbR1L2', // amy   — dev showcase (landing mockups)
  'DJ4BHbgBGjXNtv2cuIvbCqFXaDt2', // aake  — dev test
  '6cFtHe7gFmSRJA22JDqvE2ZTGJn1', // Uihyun Kim — developer
]);
const SEED_EMAIL = '@extras-seed.example.com';
const ACTIONS = ['items', 'ootd', 'ootdPriv', 'board', 'tryon'];

function classify(uid, { email = '', src = '' } = {}) {
  if (DEV.has(uid)) return 'dev';
  if (email.endsWith(SEED_EMAIL) || src === 'seed') return 'seed';
  return 'real';
}

// YYYY-MM-DD from a Firestore Timestamp OR a date string. Auth's creationTime
// is RFC-1123 ("Wed, 05 Jul 2026 12:34:56 GMT"), not ISO — parse it through
// Date rather than slicing, so the fallback doesn't yield garbage like "Wed, 05 Ju".
function dayKey(v) {
  if (!v) return null;
  if (typeof v.toDate === 'function') return v.toDate().toISOString().slice(0, 10);
  if (typeof v === 'string') {
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
  }
  return null;
}

function emptyTrends() {
  return { signups: {}, items: {}, tryons: {}, ootds: {}, boards: {} };
}
function bump(map, key) { if (key) map[key] = (map[key] || 0) + 1; }

// Build gap-filled daily series for every metric over ONE shared date axis
// (earliest data day → today, capped at 800 days). Shared axis so the client
// can slice all four charts to the same picked range and they stay aligned.
function buildTrends(maps) {
  const keys = Object.keys(maps);
  const allDays = new Set();
  keys.forEach((k) => Object.keys(maps[k]).forEach((d) => allDays.add(d)));
  if (allDays.size === 0) return Object.fromEntries(keys.map((k) => [k, []]));

  const today = new Date().toISOString().slice(0, 10);
  const sorted = [...allDays].sort();
  let start = sorted[0];
  const cap = new Date(today + 'T00:00:00Z');
  cap.setUTCDate(cap.getUTCDate() - 800);
  if (start < cap.toISOString().slice(0, 10)) start = cap.toISOString().slice(0, 10);

  const axis = [];
  const d = new Date(start + 'T00:00:00Z');
  const end = new Date(today + 'T00:00:00Z');
  while (d <= end) {
    axis.push(d.toISOString().slice(0, 10));
    d.setUTCDate(d.getUTCDate() + 1);
  }
  const out = {};
  for (const k of keys) out[k] = axis.map((day) => ({ day, count: maps[k][day] || 0 }));
  return out;
}

function summarizeBuckets({ u, buckets }) {
  const out = {};
  for (const [label, uids] of Object.entries(buckets)) {
    const per = {};
    for (const k of ACTIONS) {
      const who = uids.filter((uid) => (u[uid]?.[k] || 0) > 0);
      per[k] = { users: who.length, total: who.reduce((s, uid) => s + u[uid][k], 0) };
    }
    out[label] = { accounts: uids.length, active: uids.filter((uid) => u[uid]).length, ...per };
  }
  return out;
}

module.exports = { DEV, SEED_EMAIL, ACTIONS, classify, dayKey, emptyTrends, bump, buildTrends, summarizeBuckets };
