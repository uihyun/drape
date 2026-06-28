// Home-screen preference — which surface the app opens on for a logged-in user.
// Stored in localStorage (NOT the profile doc) because the cold-start router has
// to choose the first screen synchronously, before the profile doc loads over
// the network — same reason the locale lives in localStorage (see useLocale's
// currentLang). Per-device; account-level sync can be layered on later.
//
//   'profile' → personal hub (closet / OOTD / try-on management)
//   'feed'    → discovery feed (others' OOTDs, boards, marketplace)
//   null      → first run, never chosen → default to feed (with a nudge)

const HOME_KEY = 'drape_home';

export function getHomePref() {
  try {
    const v = localStorage.getItem(HOME_KEY);
    return v === 'profile' || v === 'feed' ? v : null;
  } catch {
    return null;
  }
}

export function setHomePref(v) {
  if (v !== 'profile' && v !== 'feed') return;
  try { localStorage.setItem(HOME_KEY, v); } catch { /* ignore */ }
}

// Route for the cold-start landing. First run (no choice yet) → feed, as before.
export function getHomeRoute() {
  return getHomePref() === 'profile' ? '/profile' : '/feed';
}

// One-time UI flags (the onboarding nudges). Same persistence idea as SwipeHint.
export function hintSeen(key) {
  try { return localStorage.getItem(key) === '1'; } catch { return true; }
}
export function markHintSeen(key) {
  try { localStorage.setItem(key, '1'); } catch { /* ignore */ }
}

// Keys for the two nudges in the onboarding flow.
export const HINT_FEED_INTRO = 'drape_seen_feed_intro_v1';
export const HINT_PROFILE_HOME = 'drape_seen_home_hint_v1';
