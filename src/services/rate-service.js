// === RateService =======================================================
// Native in-app review prompt (iOS SKStoreReviewController / Play In-App
// Review via @capacitor-community/in-app-review). Strategy: ask at a moment
// of earned delight — after the user has a few successful try-ons — never
// on a failure screen, never twice in 90 days, web never (the OS sheet
// doesn't exist there). The OS itself also rate-limits (iOS ~3/365d), so
// requestReview() is always "may show", not "will show".

import { isNativeApp } from './platform-service.js';

const ASKED_KEY = 'drape_rate_asked_at';
const COOLDOWN_MS = 90 * 24 * 60 * 60 * 1000;
const MIN_READY_TRYONS = 3;

function lastAsked() {
  try { return Number(localStorage.getItem(ASKED_KEY)) || 0; } catch { return 0; }
}

// Distinct ready try-ons this device has SEEN (viewing the result = the
// delight moment; server counts would also count ones never opened).
const SEEN_KEY = 'drape_rate_ready_seen';
export function recordReadyTryon(genId) {
  try {
    const seen = new Set(JSON.parse(localStorage.getItem(SEEN_KEY) || '[]'));
    seen.add(genId);
    const arr = [...seen].slice(-20); // cap storage; count saturates at 20
    localStorage.setItem(SEEN_KEY, JSON.stringify(arr));
    return arr.length;
  } catch { return 0; }
}

/**
 * Call from a success surface with the user's current ready-try-on count.
 * Fire-and-forget; all failures are silent (a review ask must never break UX).
 */
export async function maybeAskForReview({ readyTryons = 0 } = {}) {
  if (!isNativeApp()) return;
  if (readyTryons < MIN_READY_TRYONS) return;
  if (Date.now() - lastAsked() < COOLDOWN_MS) return;
  try {
    const { InAppReview } = await import('@capacitor-community/in-app-review');
    try { localStorage.setItem(ASKED_KEY, String(Date.now())); } catch { /* private mode */ }
    await InAppReview.requestReview();
  } catch (e) {
    console.warn('in-app review skipped:', e?.message);
  }
}
