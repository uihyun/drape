import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Link, useLocation, useParams, useNavigate } from 'react-router-dom';
import { auth, analytics, logEvent, setUserId, setUserProp, logScreen } from './firebase.js';
import { onAuthStateChanged } from 'firebase/auth';
import { AuthService } from './services/auth-service.js';
import { PushService } from './services/push-service.js';
import { getHomeRoute, getHomePref } from './services/homePref.js';
import { ProfileService } from './services/profile-service.js';
import { useLocale, currentLang } from './hooks/useLocale.jsx';

import { MobileHeader } from './components/MobileHeader.jsx';
import { MobileTabBar } from './components/MobileTabBar.jsx';
import { Onboarding } from './components/Onboarding.jsx';
import { SignInModal } from './components/SignInModal.jsx';
import { JsSplash } from './components/JsSplash.jsx';
import { warmUp } from './services/warmup.js';
import { initAppConfig } from './services/appConfig.js';

// Route pages are lazy-loaded so the cold-start bundle is just the shell +
// Firebase + the first screen's chunk, not all ~25 pages parsed up front (that
// parse cost on a cold WKWebView was the main-thread jank after the splash
// lifted). Vite statically analyzes the literal import() in each thunk and
// emits a per-page chunk; the named export is unwrapped to { default }.
// (Closet/Calendar/OutfitList/BoardList/TryOnHistory aren't routed here — they
// render embedded inside Profile, which imports them itself, so they ride in
// Profile's chunk.)
// A lazy chunk can 404 when the tab was opened on an OLDER build and we've since
// deployed (Vite's hashed filenames change). The dynamic import then fails with
// "Failed to fetch dynamically imported module" and the route renders nothing.
// Recover by reloading ONCE (the fresh index.html points at the new chunks);
// a sessionStorage guard prevents a reload loop on a genuinely broken chunk.
// The flag is cleared on a successful app mount (App effect), so a later deploy
// in the same session can recover again.
const RELOAD_KEY = 'drape_chunk_reload';
const page = (loader, name) => lazy(() =>
  loader()
    .then(m => ({ default: m[name] }))
    .catch((err) => {
      try {
        if (!sessionStorage.getItem(RELOAD_KEY)) {
          sessionStorage.setItem(RELOAD_KEY, '1');
          window.location.reload();
          return new Promise(() => {}); // hang until the reload takes over
        }
      } catch { /* storage blocked — fall through to the real error */ }
      throw err;
    })
);

const AddItem = page(() => import('./pages/AddItem.jsx'), 'AddItem');
const ItemDetail = page(() => import('./pages/ItemDetail.jsx'), 'ItemDetail');
const OutfitBuilder = page(() => import('./pages/OutfitBuilder.jsx'), 'OutfitBuilder');
const OutfitDetail = page(() => import('./pages/OutfitDetail.jsx'), 'OutfitDetail');
const OutfitLink = page(() => import('./pages/OutfitLink.jsx'), 'OutfitLink');
const OutfitShare = page(() => import('./pages/OutfitShare.jsx'), 'OutfitShare');
const Profile = page(() => import('./pages/Profile.jsx'), 'Profile');
const PublicProfile = page(() => import('./pages/PublicProfile.jsx'), 'PublicProfile');
const Welcome = page(() => import('./pages/Welcome.jsx'), 'Welcome');
const Landing = page(() => import('./pages/Landing.jsx'), 'Landing');
const BoardEditor = page(() => import('./pages/BoardEditor.jsx'), 'BoardEditor');
const BoardDetail = page(() => import('./pages/BoardDetail.jsx'), 'BoardDetail');
// /b/:boardId removed — canonical board URL is /boards/:boardId (detail);
// editor is /boards/:boardId/edit (matches /boards/new).
const AnalyzePhoto = page(() => import('./pages/AnalyzePhoto.jsx'), 'AnalyzePhoto');
const TryOn = page(() => import('./pages/TryOn.jsx'), 'TryOn');
const GenerationDetail = page(() => import('./pages/GenerationDetail.jsx'), 'GenerationDetail');
const Feed = page(() => import('./pages/Feed.jsx'), 'Feed');
const Marketplace = page(() => import('./pages/Marketplace.jsx'), 'Marketplace');
const Inbox = page(() => import('./pages/Inbox.jsx'), 'Inbox');
const Notifications = page(() => import('./pages/Notifications.jsx'), 'Notifications');
const Thread = page(() => import('./pages/Thread.jsx'), 'Thread');
const Settings = page(() => import('./pages/Settings.jsx'), 'Settings');
const Privacy = page(() => import('./pages/Privacy.jsx'), 'Privacy');
const Terms = page(() => import('./pages/Terms.jsx'), 'Terms');
const Support = page(() => import('./pages/Support.jsx'), 'Support');
const Admin = page(() => import('./pages/Admin.jsx'), 'Admin');

// OotdDetail removed — /ootd/:id now redirects to the unified /o/:id.
function OotdRedirect() {
  const { outfitId } = useParams();
  return <Navigate to={`/o/${outfitId}`} replace />;
}

import './styles/main.css';
import './styles/drape.css';

export default function App() {
  const [user, setUser] = useState(null);
  const [authReady, setAuthReady] = useState(false);
  const [signInModalOpen, setSignInModalOpen] = useState(false);
  const [warmReady, setWarmReady] = useState(false);

  // Native chrome: hide the iOS keyboard's prev/next/Done accessory bar — it's
  // dead space above the keyboard for a single-line composer.
  useEffect(() => {
    // Register the push-tap handler early so a cold-start tap deep-links to the
    // right thread (before auth/ensureRegistered runs).
    PushService.initTapHandler();
    // App mounted OK → reset the chunk-reload guard so a future deploy can
    // recover a stale lazy chunk again later in this session.
    try { sessionStorage.removeItem(RELOAD_KEY); } catch { /* ignore */ }
    // Best-effort: pull server-tunable knobs (e.g. feed TTL). Never blocks.
    initAppConfig();
    (async () => {
      try {
        const { Capacitor } = await import('@capacitor/core');
        if (!Capacitor.isNativePlatform()) return;
        const { Keyboard } = await import('@capacitor/keyboard');
        await Keyboard.setAccessoryBarVisible({ isVisible: false });
      } catch { /* web / plugin missing — no-op */ }
    })();
  }, []);

  useEffect(() => {
    return onAuthStateChanged(auth, async (u) => {
      setUser(u || null);
      setAuthReady(true);
      if (u && !u.isAnonymous) {
        // Close the sign-in sheet the instant auth is confirmed — the
        // profile bootstrap (auth-service) and warm-up run in the background.
        setSignInModalOpen(false);
        // No-op on web; on iOS/Android registers for FCM and persists
        // the token to /users/{uid}/fcmTokens/{token} for the
        // sendNewMessagePush function to fan out to.
        PushService.ensureRegistered();
      }
    });
  }, []);

  // Splash warm-up: once auth is known, prefetch the first screens into the
  // shared caches; the animated splash lifts when this resolves (warmUp is
  // async + once-per-cold-start, so finally() always runs and can't hang the
  // splash beyond its own hard cap).
  useEffect(() => {
    if (!authReady) return undefined;
    let alive = true;
    warmUp(user).finally(() => { if (alive) setWarmReady(true); });
    return () => { alive = false; };
  }, [authReady, user?.uid]);

  // Capture the user's timezone + language (once per session) so the scheduled
  // reminder push fires at their local evening, in their language. Cheap merge;
  // guarded so it doesn't write on every render/launch.
  useEffect(() => {
    if (!authReady || !user || user.isAnonymous) return;
    const key = `drape:reminderCtx:${user.uid}`;
    try { if (sessionStorage.getItem(key)) return; } catch { /* ignore */ }
    let tz = '';
    try { tz = Intl.DateTimeFormat().resolvedOptions().timeZone || ''; } catch { /* ignore */ }
    ProfileService.syncReminderContext(tz, currentLang())
      .then(() => { try { sessionStorage.setItem(key, '1'); } catch { /* ignore */ } })
      .catch(err => console.warn('reminder ctx sync failed:', err?.message));
  }, [authReady, user?.uid]);

  // Animated cold-start splash — skip on the marketing host (drape.nyc) so the
  // landing page isn't gated behind it.
  const showSplash = typeof window === 'undefined'
    || !/(^|\.)drape\.nyc$/i.test(window.location.hostname);

  // In-app "Sign in" CTAs open the provider chooser modal (Google +
  // Apple). The first-run Welcome page still calls each provider
  // directly so its layout can stay full-bleed.
  const handleSignIn = () => setSignInModalOpen(true);

  const handleSignOut = async () => {
    try {
      await PushService.unregister(auth.currentUser?.uid);
    } catch (e) { console.warn('push unregister failed', e?.message); }
    try { await AuthService.signOut(); }
    catch (e) { console.warn('signout failed', e?.message); }
  };

  return (
    <BrowserRouter>
      <AppShell
        user={user}
        authReady={authReady}
        handleSignIn={handleSignIn}
        handleSignOut={handleSignOut}
      />
      <SignInModal
        open={signInModalOpen}
        onClose={() => setSignInModalOpen(false)}
      />
      {showSplash && <JsSplash ready={warmReady} />}
    </BrowserRouter>
  );
}

// Routes that render edge-to-edge with no global chrome (own header,
// own background) AND are locked to one screen (100dvh, no scroll). The
// Welcome / sign-in page is the canonical example.
const FULL_BLEED = [/^\/welcome$/];

// Chrome-less but NORMALLY SCROLLABLE routes — own header, no app nav, but
// taller than one screen (the marketing landing). Must NOT inherit the
// full-bleed 100dvh/overflow:hidden lock or their bottom gets clipped.
const BARE_SCROLL = [/^\/landing$/];

// Routes where the floating bottom nav would overlap a page-level CTA
// (Save outfit, Generate, Upload, etc.) or a full-screen viewer. The
// MobileHeader stays so the user can back out, but the floating pills
// are suppressed. ItemDetail and OutfitDetail are full-screen viewers
// with their own close affordance + dense edit/comment content that
// would be partially covered by the nav otherwise.
const HIDE_NAV = [
  /^\/outfits\/new$/,
  /^\/closet\/add$/,
  /^\/tryon$/,
  /^\/tryon\//,
  /^\/boards\/new$/,
  /^\/boards\/[^/]+$/,
  /^\/i\//,
  /^\/o\//,
  /^\/s\//,
  /^\/ootd\//,
  /^\/messages\/[^/]+$/,
];

// Take full control of scroll on navigation — otherwise the browser's own
// "auto" scroll restoration fights us (it scrolls on its own, and that scroll
// gets recorded under the wrong history entry, clobbering our saved offset).
if (typeof history !== 'undefined' && 'scrollRestoration' in history) {
  history.scrollRestoration = 'manual';
}

// Per-history-entry scroll positions for Back/Forward restoration. The window
// is the real scroller here (`.main` has no overflow). Keyed by location.key.
const scrollPositions = new Map();
function getScrollY() {
  // The scroller varies (window vs document.scrollingElement vs .main on some
  // platforms); read all candidates and take whichever actually moved.
  return Math.max(
    window.scrollY || 0,
    document.scrollingElement?.scrollTop || 0,
    document.querySelector('.main')?.scrollTop || 0,
  );
}
// Scroll events fire async, so a programmatic scroll (our reset/restore) lands
// a moment later and — during a route change — can be recorded under the WRONG
// (outgoing) history entry, clobbering its saved offset with ~0. Suppress saves
// briefly around any scroll WE cause.
let suppressSaveUntil = 0;
function setScrollY(y) {
  suppressSaveUntil = Date.now() + 250;
  window.scrollTo(0, y);
  if (document.scrollingElement) document.scrollingElement.scrollTop = y;
  document.querySelector('.main')?.scrollTo?.(0, y);
}
// Restoring can race layout: a cached list paints fast but its height settles
// over a few frames (images, masonry). Re-apply until the page is tall enough
// to actually reach `y`, then stop.
function restoreScrollTo(y) {
  if (!y) { setScrollY(0); return; }
  // Restore can race layout (the cached list settles its height over a few
  // frames); re-apply until the page is tall enough to actually reach y.
  let n = 0;
  const tick = () => {
    setScrollY(y);
    if (getScrollY() < y - 2 && n++ < 30) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

// Map a pathname to a stable Analytics screen name (drop dynamic ids).
const SCREEN_ALIAS = { o: 'outfit', i: 'item', u: 'public_profile', s: 'outfit_share' };
function screenNameFor(pathname) {
  const seg = (pathname || '/').split('/').filter(Boolean);
  if (!seg.length) return 'home';
  if (seg[0] === 'profile') return seg[1] ? `profile_${seg[1]}` : 'profile';
  return SCREEN_ALIAS[seg[0]] || seg[0];
}

function AppShell({ user, authReady, handleSignIn, handleSignOut }) {
  const location = useLocation();
  const navigate = useNavigate();
  // Scroll position is remembered per VIEW = pathname + search, so every feed
  // tab (?kind=…) and profile sub-tab (?ot=, ?cv=) is its own independent bucket
  // (switching tabs never bleeds one list's scroll into another). Kept fresh in
  // a ref so the mount-once scroll listener always writes the view we're on —
  // not a stale closure of the one we just left.
  const viewKey = location.pathname + location.search;
  const viewKeyRef = useRef(viewKey);
  viewKeyRef.current = viewKey;

  // Analytics: screen-view (drives the Screens report + time-on-screen) on each
  // route change, and bind the signed-in uid once known.
  useEffect(() => { logScreen(screenNameFor(location.pathname)); }, [location.pathname]);
  useEffect(() => {
    if (!user?.uid) return;
    setUserId(analytics, user.uid);
    setUserProp('home_pref', getHomePref() || 'feed'); // for retention split by landing
  }, [user?.uid]);

  // Notification-tap deep link → open the target route via the router (no
  // reload). Covers DM, like, try-on, reminder. Warm taps arrive as the event;
  // a cold-start tap is drained once authed. `e.detail` is a full route string.
  useEffect(() => {
    const onOpen = (e) => {
      if (!e.detail) return;
      logEvent(analytics, 'notification_open', { route: e.detail });
      navigate(e.detail);
    };
    window.addEventListener('drape:open-route', onOpen);
    return () => window.removeEventListener('drape:open-route', onOpen);
  }, [navigate]);
  useEffect(() => {
    if (!authReady) return;
    const pending = PushService.consumePendingNav();
    // Cold start: replace the boot route so there's no stray history entry —
    // the target's back button then falls back to its natural parent.
    if (pending) { logEvent(analytics, 'notification_open', { route: pending }); navigate(pending, { replace: true }); }
  }, [authReady, navigate]);

  // Universal Link (iOS) / App Link (Android) deep link → route to the content
  // IN-APP. The OS opens the app for a tapped web.app content URL (associated-
  // domains / assetlinks); without this the app would just sit on home. Take the
  // URL path (/s /o /i /u /boards …) and navigate to it.
  useEffect(() => {
    let cleanup;
    (async () => {
      const { Capacitor } = await import('@capacitor/core');
      if (!Capacitor.isNativePlatform()) return;
      const { App: CapApp } = await import('@capacitor/app');
      const handle = await CapApp.addListener('appUrlOpen', ({ url }) => {
        try {
          const path = new URL(url).pathname;
          if (path && path !== '/') navigate(path);
        } catch { /* ignore malformed deep link */ }
      });
      cleanup = () => handle.remove();
    })();
    return () => { if (cleanup) cleanup(); };
  }, [navigate]);

  // Save the scroll offset continuously under the CURRENT view (via ref). Bound
  // once, so a navigation-time scroll (our reset, or the browser clamping when
  // the list shrinks) lands on the new view — never clobbering the one we left.
  // Capture phase catches scroll from whichever element is the scroller.
  useEffect(() => {
    const save = () => {
      if (Date.now() < suppressSaveUntil) return; // ignore scrolls we triggered
      scrollPositions.set(viewKeyRef.current, getScrollY());
      if (scrollPositions.size > 200) scrollPositions.delete(scrollPositions.keys().next().value);
    };
    document.addEventListener('scroll', save, { passive: true, capture: true });
    return () => document.removeEventListener('scroll', save, { capture: true });
  }, []);

  // On every view change, restore that view's remembered offset (a never-seen
  // view → 0 → top). This unifies Back/Forward, tab switches, and new pages: a
  // list you return to (by Back OR by re-tapping its tab) resumes its place.
  useEffect(() => {
    restoreScrollTo(scrollPositions.get(viewKey) || 0);
  }, [viewKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const isFullBleed = FULL_BLEED.some(re => re.test(location.pathname));
  const isBare = BARE_SCROLL.some(re => re.test(location.pathname));
  const noChrome = isFullBleed || isBare;
  const hideNav = noChrome || HIDE_NAV.some(re => re.test(location.pathname));
  // Home for `/`: signed-in users land on the discovery feed (the social
  // home, like every SNS app); anonymous/new users see the welcome screen.
  // Their own profile/closet/calendar live one tap away in the tab bar.
  const isLoggedIn = user && !user.isAnonymous;
  // The marketing domain (drape.nyc) shares this hosting site; when the app
  // loads at its root we send it to the landing page. Deep links like
  // drape.nyc/feed still resolve normally. So wiring the domain is just
  // "add drape.nyc as a Firebase custom domain" — no separate site needed.
  const isMarketingHost = typeof window !== 'undefined'
    && /(^|\.)drape\.nyc$/i.test(window.location.hostname);
  // Logged-in landing follows the user's home-screen preference (feed vs
  // profile); first run (no choice yet) defaults to feed. See services/homePref.
  const rootTarget = isMarketingHost ? '/landing' : (isLoggedIn ? getHomeRoute() : '/welcome');

  return (
    <div className={`app${isFullBleed ? ' app-full-bleed' : ''}${isBare ? ' app-bare' : ''}`}>
      {!noChrome && <MobileHeader />}

      {/* /admin is a desktop dashboard, not a "wide phone" — release the 540px cap there. */}
      <main className={location.pathname.startsWith('/admin') ? 'main main--wide' : 'main'}>
        <Suspense fallback={<div className="loading"><div className="spinner" /></div>}>
        <Routes>
          <Route path="/" element={authReady ? <Navigate to={rootTarget} replace /> : <div className="loading"><div className="spinner" /></div>} />
          <Route path="/welcome" element={isLoggedIn ? <Navigate to="/profile" replace /> : <Welcome />} />
          {/* Public marketing page — the drape.nyc domain points here. */}
          <Route path="/landing" element={<Landing />} />
          <Route path="/profile" element={<Profile user={user} authReady={authReady} onSignIn={handleSignIn} />} />
          <Route path="/profile/:tab" element={<Profile user={user} authReady={authReady} onSignIn={handleSignIn} />} />
          <Route path="/u/:handle" element={<PublicProfile user={user} onSignIn={handleSignIn} />} />
          {/* Handle-prefixed tab path so links like /u/uhz/boards are
              shareable and survive copy/paste. PublicProfile only renders
              the public outfits grid today; the tab segment is reserved
              for future expansion (public boards, calendar). */}
          <Route path="/u/:handle/:tab" element={<PublicProfile user={user} onSignIn={handleSignIn} />} />

          {/* Standalone /closet, /outfits, /calendar, /boards, /tryons
              redirect into the Profile tab — there's no reason to have a
              second home for the same list and the deep-link / back-nav
              behavior gets confusing otherwise. */}
          <Route path="/closet" element={<Navigate to="/profile/closet" replace />} />
          <Route path="/outfits" element={<Navigate to="/profile/outfits" replace />} />
          <Route path="/calendar" element={<Navigate to="/profile/calendar" replace />} />
          <Route path="/boards" element={<Navigate to="/profile/boards" replace />} />
          <Route path="/tryons" element={<Navigate to="/profile/tryon" replace />} />

          <Route path="/closet/add" element={<AddItem user={user} onSignIn={handleSignIn} />} />
          <Route path="/i/:itemId" element={<ItemDetail user={user} onSignIn={handleSignIn} />} />

          <Route path="/outfits/new" element={<OutfitBuilder user={user} onSignIn={handleSignIn} />} />
          <Route path="/o/:outfitId" element={<OutfitDetail user={user} onSignIn={handleSignIn} />} />
          <Route path="/o/:outfitId/link" element={<OutfitLink user={user} onSignIn={handleSignIn} />} />
          <Route path="/s/:outfitId" element={<OutfitShare user={user} onSignIn={handleSignIn} />} />

          <Route path="/tryon" element={<TryOn user={user} onSignIn={handleSignIn} />} />
          <Route path="/tryon/:generationId" element={<GenerationDetail user={user} />} />

          <Route path="/feed" element={<Feed user={user} onSignIn={handleSignIn} />} />
          <Route path="/market" element={<Marketplace />} />
          <Route path="/messages" element={<Inbox user={user} />} />
          <Route path="/notifications" element={<Notifications user={user} onSignIn={handleSignIn} />} />
          <Route path="/messages/:threadId" element={<Thread user={user} />} />
          {/* Unified: an OOTD is just a dated outfit. Old /ootd/:id links
              redirect to the canonical outfit detail. */}
          <Route path="/ootd/:outfitId" element={<OotdRedirect />} />

          <Route path="/analyze" element={<AnalyzePhoto user={user} onSignIn={handleSignIn} />} />

          <Route path="/boards/new" element={<BoardEditor user={user} onSignIn={handleSignIn} />} />
          <Route path="/boards/:boardId/edit" element={<BoardEditor user={user} onSignIn={handleSignIn} />} />
          <Route path="/boards/:boardId" element={<BoardDetail user={user} onSignIn={handleSignIn} />} />

          <Route path="/settings" element={<Settings user={user} onSignIn={handleSignIn} onSignOut={handleSignOut} />} />

          {/* Owner-only analytics. Guard is cosmetic — the real wall is the
              email check inside the admin callables (functions/admin.js).
              Wait for authReady so a direct hit on /admin doesn't redirect
              before onAuthStateChanged has populated `user`. */}
          <Route path="/admin" element={
            !authReady ? <div className="loading"><div className="spinner" /></div>
              : (isLoggedIn && user?.email === 'uihyunkei@gmail.com')
                ? <Admin user={user} />
                : <Navigate to="/profile" replace />
          } />

          <Route path="/privacy" element={<Privacy />} />
          <Route path="/terms" element={<Terms />} />
          <Route path="/support" element={<Support />} />

          <Route path="*" element={<NotFound />} />
        </Routes>
        </Suspense>
      </main>

      {!hideNav && <MobileTabBar user={user} />}

      {/* Onboarding only after sign-in — never on /welcome or /landing. */}
      {isLoggedIn && !noChrome && <Onboarding user={user} />}
    </div>
  );
}

function NotFound() {
  const { t } = useLocale();
  return (
    <div style={{ textAlign: 'center', padding: '4rem 1rem' }}>
      <h2>{t('notFoundTitle')}</h2>
      <p style={{ color: 'var(--text-secondary)', marginTop: '0.5rem' }}>{t('notFoundBody')}</p>
      <Link to="/closet" className="btn btn-primary" style={{ marginTop: '1rem' }}>
        {t('backToCloset')}
      </Link>
    </div>
  );
}
