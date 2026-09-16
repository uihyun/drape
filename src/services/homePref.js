// Home-screen preference — which surface the app opens on for a logged-in user.
// Stored in localStorage (NOT the profile doc) because the cold-start router has
// to choose the first screen synchronously, before the profile doc loads over
// the network — same reason the locale lives in localStorage (see useLocale's
// currentLang). Per-device; account-level sync can be layered on later.
//
//   'profile' → personal hub (closet / OOTD / try-on management)
//   'trends'  → the weekly Trends issue
//   null      → never chosen → depends on whether the closet has anything in
//               it. A brand-new account opening onto an EMPTY closet is the
//               first frame of the activation leak (2026-09: 29 signups / 30d,
//               7 ever added an item); Trends always has content because we
//               curate it. Once they own a piece the closet is the better
//               landing, and that flip lands exactly when they'd want it.
//               A fixed default can't do both: 'trends' would move established
//               users off their closet for no reason, 'profile' greets every
//               newcomer with an empty grid.
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

// Closet size, cached by Profile on every visit. Read here because the
// cold-start router has to decide synchronously, before any query resolves.
// Unknown (never visited) counts as empty — that's the new-account case.
export function closetHasItems(uid) {
  if (!uid) return false;
  try { return Number(localStorage.getItem(`drape:itemCount:${uid}`)) > 0; } catch { return false; }
}

// Route for the cold-start landing. An explicit choice always wins; otherwise
// see the note above on why the default follows the closet.
export function getHomeRoute(uid) {
  const pref = getHomePref();
  if (pref) return pref === 'trends' ? '/trends' : '/profile';
  return closetHasItems(uid) ? '/profile' : '/trends';
}

// One-time nudge shown the first time the default flips to the closet, so the
// change doesn't read as the app losing the user's place.
export const HINT_HOME_FLIP = 'drape_seen_home_flip_v1';

// One-time UI flags (the onboarding nudges). Same persistence idea as SwipeHint.
export function hintSeen(key) {
  try { return localStorage.getItem(key) === '1'; } catch { return true; }
}
export function markHintSeen(key) {
  try { localStorage.setItem(key, '1'); } catch { /* ignore */ }
}

// First-run nudge flag, still used by the (now URL-only) feed page.
export const HINT_FEED_INTRO = 'drape_seen_feed_intro_v1';
