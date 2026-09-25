// === RateService =======================================================
// Native in-app review prompt (iOS SKStoreReviewController / Play In-App
// Review via @capacitor-community/in-app-review). Strategy: ask at a moment
// of earned delight — a try-on result, or a piece landing in the closet —
// only from someone who keeps coming back and has actually built something,
// never on a failure screen, web never (the OS sheet doesn't exist there).
//
// Gate (sized against real users, 24 Sep 2026): opened the app on 3+ distinct
// days AND (2+ try-ons seen OR 10+ closet items). Try-ons ≥3 alone reached 10
// people; ≥2 reaches 18, and 10 items is where closets tend to keep growing
// (20 users ≥10, 17 of them ≥20).
//
// Neither OS says whether the person rated, dismissed, or was even shown the
// sheet — so we can't skip people who already reviewed. Capping our own asks
// (twice ever, 90 days apart) is what stands in for that. The OS rate-limits
// on top (iOS ~3/365d), so requestReview() is always "may show".

import { isNativeApp } from './platform-service.js';

const ASKED_KEY = 'drape_rate_asked_at';
const ASK_COUNT_KEY = 'drape_rate_ask_count';
const DAYS_KEY = 'drape_rate_open_days';
const SEEN_KEY = 'drape_rate_ready_seen';
const COOLDOWN_MS = 90 * 24 * 60 * 60 * 1000;
const MAX_ASKS = 2;
const MIN_DAYS = 3;
const MIN_TRYONS = 2;
const MIN_ITEMS = 10;

function readJson(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key) || 'null') ?? fallback; } catch { return fallback; }
}
function writeJson(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* private mode / quota */ }
}
function readNum(key) {
  try { return Number(localStorage.getItem(key)) || 0; } catch { return 0; }
}

function localDay() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function recordOpenDay() {
  const days = readJson(DAYS_KEY, []);
  const today = localDay();
  if (days.includes(today)) return;
  // Only the count matters and it saturates well past MIN_DAYS.
  writeJson(DAYS_KEY, [...days, today].slice(-10));
}

/** Count distinct days the app was opened. A native app resumes from the
 *  background far more often than it cold-starts, so a mount-only count would
 *  miss most returning days — visibilitychange covers the resume. */
export function trackOpenDays() {
  recordOpenDay();
  const onVisible = () => { if (document.visibilityState === 'visible') recordOpenDay(); };
  document.addEventListener('visibilitychange', onVisible);
  return () => document.removeEventListener('visibilitychange', onVisible);
}

// Distinct ready try-ons this device has SEEN (viewing the result = the
// delight moment; server counts would also count ones never opened).
export function recordReadyTryon(genId) {
  const seen = new Set(readJson(SEEN_KEY, []));
  seen.add(genId);
  const arr = [...seen].slice(-20); // count saturates at 20
  writeJson(SEEN_KEY, arr);
  return arr.length;
}

/**
 * Call from a success surface. Pass whichever counts that surface knows;
 * the rest come from what this device has recorded. Fire-and-forget; all
 * failures are silent (a review ask must never break UX).
 */
export async function maybeAskForReview({ readyTryons, items = 0 } = {}) {
  if (!isNativeApp()) return;
  if (readJson(DAYS_KEY, []).length < MIN_DAYS) return;
  const tryons = readyTryons ?? readJson(SEEN_KEY, []).length;
  if (tryons < MIN_TRYONS && items < MIN_ITEMS) return;
  // A device asked under the old 90-day-only rule has a timestamp but no
  // count — that ask counts toward the two.
  const asks = readNum(ASK_COUNT_KEY) || (readNum(ASKED_KEY) ? 1 : 0);
  if (asks >= MAX_ASKS) return;
  if (Date.now() - readNum(ASKED_KEY) < COOLDOWN_MS) return;
  try {
    const { InAppReview } = await import('@capacitor-community/in-app-review');
    try {
      localStorage.setItem(ASKED_KEY, String(Date.now()));
      localStorage.setItem(ASK_COUNT_KEY, String(asks + 1));
    } catch { /* private mode */ }
    await InAppReview.requestReview();
  } catch (e) {
    console.warn('in-app review skipped:', e?.message);
  }
}
