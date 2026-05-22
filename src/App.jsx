import { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Link } from 'react-router-dom';
import { auth } from './firebase.js';
import { onAuthStateChanged } from 'firebase/auth';
import { AuthService } from './services/auth-service.js';
import { useCredits } from './services/credits-service.js';
import { useLocale } from './hooks/useLocale.jsx';

import { Header } from './components/Header.jsx';
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
      <div className="app">
        <Header
          user={user}
          credits={credits}
          onSignIn={handleSignIn}
          onSignOut={handleSignOut}
          onOpenCredits={() => setCreditModalOpen(true)}
        />
        <MobileHeader
          user={user}
          credits={credits}
          onOpenCredits={() => setCreditModalOpen(true)}
        />

        <main className="main">
          <Routes>
            <Route path="/" element={<Navigate to="/closet" replace />} />
            <Route path="/closet" element={<Closet user={user} authReady={authReady} onSignIn={handleSignIn} />} />
            <Route path="/closet/add" element={<AddItem user={user} onSignIn={handleSignIn} />} />
            <Route path="/i/:itemId" element={<ItemDetail user={user} />} />

            <Route path="/outfits" element={<OutfitList user={user} onSignIn={handleSignIn} />} />
            <Route path="/outfits/new" element={<OutfitBuilder user={user} onSignIn={handleSignIn} />} />
            <Route path="/o/:outfitId" element={<OutfitDetail user={user} onSignIn={handleSignIn} />} />
            <Route path="/s/:outfitId" element={<OutfitShare user={user} onSignIn={handleSignIn} />} />

            <Route path="/calendar" element={<Calendar user={user} onSignIn={handleSignIn} />} />

            <Route path="/tryon" element={<TryOn user={user} onSignIn={handleSignIn} onOpenCredits={() => setCreditModalOpen(true)} />} />
            <Route path="/tryon/:generationId" element={<GenerationDetail user={user} />} />

            <Route path="/feed" element={<Feed user={user} onSignIn={handleSignIn} />} />

            <Route path="/settings" element={<Settings user={user} onSignIn={handleSignIn} onSignOut={handleSignOut} />} />

            <Route path="/privacy" element={<Privacy />} />
            <Route path="/terms" element={<Terms />} />
            <Route path="/support" element={<Support />} />

            <Route path="*" element={<NotFound />} />
          </Routes>
        </main>

        <MobileTabBar user={user} />

        {creditModalOpen && (
          <CreditModal
            user={user}
            credits={credits}
            onClose={() => setCreditModalOpen(false)}
            onSignIn={handleSignIn}
          />
        )}

        <Onboarding />
      </div>
    </BrowserRouter>
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
