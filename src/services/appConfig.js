// Runtime-tunable app config, read once per session from Firestore `config/app`
// (public read, console-only write — see firestore.rules). Lets us adjust knobs
// like the feed cache TTL from the server WITHOUT shipping a new app build.
//
// SAFETY (deliberate): a missing doc, a denied/offline read, or a malformed /
// out-of-range value all fall back to the baked-in default and are clamped to
// sane bounds. So a bad value typed into the console can NEVER break an
// already-deployed client — the worst case is "uses the default".

import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase.js';

const DEFAULTS = { feedTtlMs: 60 * 1000 };               // 1 minute
const BOUNDS   = { feedTtlMs: [5 * 1000, 60 * 60 * 1000] }; // clamp 5s … 60min

let current = { ...DEFAULTS };
let started = false;

function sane(value, [min, max], fallback) {
  return (typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max)
    ? value
    : fallback;
}

// Fire-and-forget; safe to call more than once (only the first runs). Never
// throws — failure just leaves the defaults in place.
export async function initAppConfig() {
  if (started) return;
  started = true;
  try {
    const snap = await getDoc(doc(db, 'config', 'app'));
    if (snap.exists()) {
      const d = snap.data() || {};
      current = {
        feedTtlMs: sane(d.feedTtlMs, BOUNDS.feedTtlMs, DEFAULTS.feedTtlMs),
      };
    }
  } catch (e) {
    console.warn('appConfig load skipped (using defaults):', e?.message);
  }
}

export function getFeedTtlMs() {
  return current.feedTtlMs;
}
