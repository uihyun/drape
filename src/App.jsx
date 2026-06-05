import { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Link, useLocation, useParams } from 'react-router-dom';
import { auth } from './firebase.js';
import { onAuthStateChanged } from 'firebase/auth';
import { AuthService } from './services/auth-service.js';
import { PushService } from './services/push-service.js';
import { useLocale } from './hooks/useLocale.jsx';

import { MobileHeader } from './components/MobileHeader.jsx';
import { MobileTabBar } from './components/MobileTabBar.jsx';
import { Onboarding } from './components/Onboarding.jsx';
import { SignInModal } from './components/SignInModal.jsx';
import { JsSplash } from './components/JsSplash.jsx';
import { warmUp } from './services/warmup.js';

import { Closet } from './pages/Closet.jsx';
import { AddItem } from './pages/AddItem.jsx';
import { ItemDetail } from './pages/ItemDetail.jsx';
import { OutfitList } from './pages/OutfitList.jsx';
import { OutfitBuilder } from './pages/OutfitBuilder.jsx';
import { OutfitDetail } from './pages/OutfitDetail.jsx';
import { OutfitLink } from './pages/OutfitLink.jsx';
import { OutfitShare } from './pages/OutfitShare.jsx';
import { Calendar } from './pages/Calendar.jsx';
import { Profile } from './pages/Profile.jsx';
import { PublicProfile } from './pages/PublicProfile.jsx';
import { Welcome } from './pages/Welcome.jsx';
import { Landing } from './pages/Landing.jsx';
import { BoardList } from './pages/BoardList.jsx';
import { BoardEditor } from './pages/BoardEditor.jsx';
import { BoardDetail } from './pages/BoardDetail.jsx';
// /b/:boardId removed — canonical board URL is /boards/:boardId (detail);
// editor is /boards/:boardId/edit (matches /boards/new).
import { AnalyzePhoto } from './pages/AnalyzePhoto.jsx';
import { TryOnHistory } from './pages/TryOnHistory.jsx';
// OotdDetail removed — /ootd/:id now redirects to the unified /o/:id.
function OotdRedirect() {
  const { outfitId } = useParams();
  return <Navigate to={`/o/${outfitId}`} replace />;
}
import { TryOn } from './pages/TryOn.jsx';
import { GenerationDetail } from './pages/GenerationDetail.jsx';
import { Feed } from './pages/Feed.jsx';
import { Marketplace } from './pages/Marketplace.jsx';
import { Inbox } from './pages/Inbox.jsx';
import { Thread } from './pages/Thread.jsx';
import { Settings } from './pages/Settings.jsx';
import { Privacy } from './pages/Privacy.jsx';
import { Terms } from './pages/Terms.jsx';
import { Support } from './pages/Support.jsx';

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

function AppShell({ user, authReady, handleSignIn, handleSignOut }) {
  const location = useLocation();

  // Reset scroll to the top on every route change. React Router keeps the
  // window scroll offset across navigations, so jumping from a scrolled
  // Calendar to Try-on (or any page → any page) used to land mid-screen.
  // Keyed on pathname only — query-param changes (sheets, tabs that use
  // ?param) shouldn't yank the scroll. Covers window + the main scroll
  // container in case either is the scroller on a given platform.
  useEffect(() => {
    window.scrollTo(0, 0);
    document.scrollingElement?.scrollTo?.(0, 0);
    document.querySelector('.main')?.scrollTo?.(0, 0);
  }, [location.pathname]);

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
  const rootTarget = isMarketingHost ? '/landing' : (isLoggedIn ? '/feed' : '/welcome');

  return (
    <div className={`app${isFullBleed ? ' app-full-bleed' : ''}${isBare ? ' app-bare' : ''}`}>
      {!noChrome && <MobileHeader />}

      <main className="main">
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
          <Route path="/messages/:threadId" element={<Thread user={user} />} />
          {/* Unified: an OOTD is just a dated outfit. Old /ootd/:id links
              redirect to the canonical outfit detail. */}
          <Route path="/ootd/:outfitId" element={<OotdRedirect />} />

          <Route path="/analyze" element={<AnalyzePhoto user={user} onSignIn={handleSignIn} />} />

          <Route path="/boards/new" element={<BoardEditor user={user} onSignIn={handleSignIn} />} />
          <Route path="/boards/:boardId/edit" element={<BoardEditor user={user} onSignIn={handleSignIn} />} />
          <Route path="/boards/:boardId" element={<BoardDetail user={user} onSignIn={handleSignIn} />} />

          <Route path="/settings" element={<Settings user={user} onSignIn={handleSignIn} onSignOut={handleSignOut} />} />

          <Route path="/privacy" element={<Privacy />} />
          <Route path="/terms" element={<Terms />} />
          <Route path="/support" element={<Support />} />

          <Route path="*" element={<NotFound />} />
        </Routes>
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
