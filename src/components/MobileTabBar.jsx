import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Home, User, Plus, X, Shirt, Sparkles, Layers, Grid3x3 } from 'lucide-react';
import { useLocale } from '../hooks/useLocale.jsx';

// Some Google profile photos throw CORS / 403 in third-party contexts.
// When the avatar fails we want a clean User icon, not a broken-image
// glyph. Track per-user so a transient failure doesn't permanently
// strike out a working URL across the session.
function Avatar({ user, size = 22 }) {
  const [failed, setFailed] = useState(false);
  if (user?.photoURL && !failed) {
    return (
      <img
        src={user.photoURL}
        alt=""
        referrerPolicy="no-referrer"
        onError={() => setFailed(true)}
      />
    );
  }
  return <User size={size} strokeWidth={1.6} />;
}

// Lekondo-style bottom nav: three separate white circular pills floating
// over the content (Home / + / Profile). Not a single bar — each button
// is its own circle with its own shadow, so the page peeks through the
// gaps between them. Home also routes to the profile (the app's main
// surface) — Feed is kept as a route but isn't a primary destination.
export function MobileTabBar({ user }) {
  const { t } = useLocale();
  const location = useLocation();
  const navigate = useNavigate();
  const [sheetOpen, setSheetOpen] = useState(false);

  const isLoggedIn = user && !user.isAnonymous;
  const onHome = location.pathname === '/' || location.pathname.startsWith('/feed');
  const onProfile = location.pathname.startsWith('/profile') || location.pathname.startsWith('/u/');

  const go = (path) => () => {
    setSheetOpen(false);
    navigate(isLoggedIn ? path : '/welcome');
  };

  return (
    <>
      <nav className="floating-nav" aria-label="primary">
        <Link
          to="/feed"
          className={`floating-nav-btn${onHome ? ' active' : ''}`}
          aria-label={t('navHome')}
        >
          <span className="floating-nav-icon">
            <Home size={22} strokeWidth={1.6} />
          </span>
          <span className="floating-nav-label">{t('navHome')}</span>
        </Link>

        <button
          type="button"
          className="floating-nav-btn floating-nav-btn--center"
          onClick={() => setSheetOpen(true)}
          aria-label={t('create')}
        >
          <span className="floating-nav-icon floating-nav-icon--center">
            <Plus size={28} strokeWidth={2.2} />
          </span>
        </button>

        <Link
          to="/profile"
          className={`floating-nav-btn${onProfile ? ' active' : ''}`}
          aria-label={t('navProfile')}
        >
          <span className="floating-nav-icon">
            <Avatar user={user} />
          </span>
          <span className="floating-nav-label">{t('navProfile')}</span>
        </Link>
      </nav>

      {sheetOpen && (
        <div className="create-sheet-overlay" onClick={() => setSheetOpen(false)}>
          <div className="create-sheet" onClick={e => e.stopPropagation()} role="dialog" aria-modal="true">
            <div className="create-sheet-handle" />
            <button type="button" className="create-sheet-close" onClick={() => setSheetOpen(false)} aria-label={t('close')}>
              <X size={18} />
            </button>
            <h3 className="create-sheet-title">{t('createSheetTitle')}</h3>
            <button type="button" className="create-sheet-row" onClick={go('/closet/add')}>
              <span className="create-sheet-icon"><Shirt size={20} strokeWidth={1.5} /></span>
              <span className="create-sheet-label">{t('createAddItem')}</span>
            </button>
            <button type="button" className="create-sheet-row" onClick={go('/outfits/new')}>
              <span className="create-sheet-icon"><Layers size={20} strokeWidth={1.5} /></span>
              <span className="create-sheet-label">{t('createNewOutfit')}</span>
            </button>
            <button type="button" className="create-sheet-row" onClick={go('/boards/new')}>
              <span className="create-sheet-icon"><Grid3x3 size={20} strokeWidth={1.5} /></span>
              <span className="create-sheet-label">{t('createBoard')}</span>
            </button>
            <button type="button" className="create-sheet-row" onClick={go('/tryon')}>
              <span className="create-sheet-icon"><Sparkles size={20} strokeWidth={1.5} /></span>
              <span className="create-sheet-label">{t('createTryOn')}</span>
            </button>
          </div>
        </div>
      )}
    </>
  );
}

export default MobileTabBar;
