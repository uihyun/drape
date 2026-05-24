import { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Link, useLocation } from 'react-router-dom';
import { auth } from './firebase.js';
import { onAuthStateChanged } from 'firebase/auth';
import { AuthService } from './services/auth-service.js';
import { useCredits } from './services/credits-service.js';
import { useLocale } from './hooks/useLocale.jsx';

import { MobileHeader } from './components/MobileHeader.jsx';
import { MobileTabBar } from './components/MobileTabBar.jsx';
import { Onboarding } from './components/Onboarding.jsx';
import { CreditModal } from './components/CreditModal.jsx';

import { Closet } from './pages/Closet.jsx';
import { AddItem } from './pages/AddItem.jsx';
import { ItemDetail } from './pages/ItemDetail.jsx';
import { OutfitList } from './pages/OutfitList.jsx';
import { OutfitBuilder } from './pages/OutfitBuilder.jsx';
import { OutfitDetail } from './pages/OutfitDetail.jsx';
import { OutfitShare } from './pages/OutfitShare.jsx';
import { Calendar } from './pages/Calendar.jsx';
import { Profile } from './pages/Profile.jsx';
import { PublicProfile } from './pages/PublicProfile.jsx';
import { Welcome } from './pages/Welcome.jsx';
import { BoardList } from './pages/BoardList.jsx';
import { BoardEditor } from './pages/BoardEditor.jsx';
import { AnalyzePhoto } from './pages/AnalyzePhoto.jsx';
import { TryOnHistory } from './pages/TryOnHistory.jsx';
import { OotdDetail } from './pages/OotdDetail.jsx';
import { TryOn } from './pages/TryOn.jsx';
import { GenerationDetail } from './pages/GenerationDetail.jsx';
import { Feed } from './pages/Feed.jsx';
import { Settings } from './pages/Settings.jsx';
import { Privacy } from './pages/Privacy.jsx';
import { Terms } from './pages/Terms.jsx';
import { Support } from './pages/Support.jsx';

import './styles/main.css';
import './styles/drape.css';

export default function App() {
  const [user, setUser] = useState(null);
  const [authReady, setAuthReady] = useState(false);
  const [creditModalOpen, setCreditModalOpen] = useState(false);
  const credits = useCredits(user);

  useEffect(() => {
    return onAuthStateChanged(auth, async (u) => {
      setUser(u || null);
      setAuthReady(true);
      if (u && !u.isAnonymous) {
        try { await AuthService.initializeIfNeeded?.(u); } catch (e) { console.warn('init failed', e?.message); }
      }
    });
  }, []);

  const handleSignIn = async () => {
    try { await AuthService.signInWithGoogle(); }
    catch (e) { console.warn('signin failed', e?.message); }
  };

  const handleSignOut = async () => {
    try { await AuthService.signOut(); }
    catch (e) { console.warn('signout failed', e?.message); }
  };

  return (
    <BrowserRouter>
      <AppShell
        user={user}
        authReady={authReady}
        credits={credits}
        creditModalOpen={creditModalOpen}
        setCreditModalOpen={setCreditModalOpen}
        handleSignIn={handleSignIn}
        handleSignOut={handleSignOut}
      />
    </BrowserRouter>
  );
}

// Routes that render edge-to-edge with no global chrome (own header,
// own background). The Welcome / sign-in page is the canonical example.
const FULL_BLEED = [/^\/welcome$/];

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
];

function AppShell({ user, authReady, credits, creditModalOpen, setCreditModalOpen, handleSignIn, handleSignOut }) {
  const location = useLocation();
  const isFullBleed = FULL_BLEED.some(re => re.test(location.pathname));
  const hideNav = isFullBleed || HIDE_NAV.some(re => re.test(location.pathname));
  // Pick the right "home" for `/` based on auth: signed-in users land on
  // their profile; anonymous/new users see the welcome screen.
  const isLoggedIn = user && !user.isAnonymous;
  const rootTarget = isLoggedIn ? '/profile' : '/welcome';

  return (
    <div className={`app${isFullBleed ? ' app-full-bleed' : ''}`}>
      {!isFullBleed && <MobileHeader />}

      <main className="main">
        <Routes>
          <Route path="/" element={authReady ? <Navigate to={rootTarget} replace /> : <div className="loading"><div className="spinner" /></div>} />
          <Route path="/welcome" element={<Welcome />} />
          <Route path="/profile" element={<Profile user={user} authReady={authReady} onSignIn={handleSignIn} />} />
          <Route path="/profile/:tab" element={<Profile user={user} authReady={authReady} onSignIn={handleSignIn} />} />
          <Route path="/u/:handle" element={<PublicProfile user={user} onSignIn={handleSignIn} />} />

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
          <Route path="/i/:itemId" element={<ItemDetail user={user} />} />

          <Route path="/outfits/new" element={<OutfitBuilder user={user} onSignIn={handleSignIn} />} />
          <Route path="/o/:outfitId" element={<OutfitDetail user={user} onSignIn={handleSignIn} />} />
          <Route path="/s/:outfitId" element={<OutfitShare user={user} onSignIn={handleSignIn} />} />

          <Route path="/tryon" element={<TryOn user={user} onSignIn={handleSignIn} onOpenCredits={() => setCreditModalOpen(true)} />} />
          <Route path="/tryon/:generationId" element={<GenerationDetail user={user} />} />

          <Route path="/feed" element={<Feed user={user} onSignIn={handleSignIn} />} />
          <Route path="/ootd/:ootdId" element={<OotdDetail user={user} />} />

          <Route path="/analyze" element={<AnalyzePhoto user={user} onSignIn={handleSignIn} />} />

          <Route path="/boards/new" element={<BoardEditor user={user} onSignIn={handleSignIn} />} />
          <Route path="/boards/:boardId" element={<BoardEditor user={user} onSignIn={handleSignIn} />} />

          <Route path="/settings" element={<Settings user={user} onSignIn={handleSignIn} onSignOut={handleSignOut} />} />

          <Route path="/privacy" element={<Privacy />} />
          <Route path="/terms" element={<Terms />} />
          <Route path="/support" element={<Support />} />

          <Route path="*" element={<NotFound />} />
        </Routes>
      </main>

      {!hideNav && <MobileTabBar user={user} />}

      {creditModalOpen && (
        <CreditModal
          user={user}
          credits={credits}
          onClose={() => setCreditModalOpen(false)}
          onSignIn={handleSignIn}
        />
      )}

      {/* Onboarding only after sign-in — never on top of /welcome. */}
      {isLoggedIn && !isFullBleed && <Onboarding />}
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
