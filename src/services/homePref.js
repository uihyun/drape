// Home-screen preference — which surface the app opens on for a logged-in user.
// Stored in localStorage (NOT the profile doc) because the cold-start router has
// to choose the first screen synchronously, before the profile doc loads over
// the network — same reason the locale lives in localStorage (see useLocale's
// currentLang). Per-device; account-level sync can be layered on later.
//
//   'profile' → personal hub (closet / OOTD / try-on management)
//   'trends'  → the weekly Trends issue
//   null      → first run, never chosen → default to PROFILE. GA (2026-07):
//               closet/try-on engagement dwarfs discovery ~40:1, and onboarding
//               skippers live on the default — the closet is the product.
//
// Legacy 'feed' migrates to 'trends' on read. The feed lost its tab in 2.1.0
// (it stays reachable by URL), so honoring the stored value would cold-start
// those users onto a surface with no way back into the nav.

const HOME_KEY = 'drape_home';

export function getHomePref() {
  try {
    const v = localStorage.getItem(HOME_KEY);
    if (v === 'feed') return 'trends';
    return v === 'profile' || v === 'trends' ? v : null;
  } catch {
    return null;
  }
}

export function setHomePref(v) {
  if (v !== 'profile' && v !== 'trends') return;
  try { localStorage.setItem(HOME_KEY, v); } catch { /* ignore */ }
}

// Route for the cold-start landing. First run (no choice yet) → profile.
export function getHomeRoute() {
  return getHomePref() === 'trends' ? '/trends' : '/profile';
}

// One-time UI flags (the onboarding nudges). Same persistence idea as SwipeHint.
export function hintSeen(key) {
  try { return localStorage.getItem(key) === '1'; } catch { return true; }
}
export function markHintSeen(key) {
  try { localStorage.setItem(key, '1'); } catch { /* ignore */ }
}

// First-run nudge flag, still used by the (now URL-only) feed page.
export const HINT_FEED_INTRO = 'drape_seen_feed_intro_v1';
