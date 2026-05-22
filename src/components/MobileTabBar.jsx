import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Home, User, Plus, X, Shirt, Sparkles, Layers } from 'lucide-react';
import { useLocale } from '../hooks/useLocale.jsx';

// Lekondo-style 3-slot tab bar: Home / floating + / Profile. The center
// `+` opens a sheet with the three "create" entry points (Add item, New
// outfit, Try-on) rather than living on the bar itself.
export function MobileTabBar({ user }) {
  const { t } = useLocale();
  const location = useLocation();
  const navigate = useNavigate();
  const [sheetOpen, setSheetOpen] = useState(false);

  const isLoggedIn = user && !user.isAnonymous;
  const onHome = location.pathname === '/' || location.pathname.startsWith('/feed');
  const onProfile = location.pathname.startsWith('/profile');

  const go = (path) => () => {
    setSheetOpen(false);
    navigate(isLoggedIn ? path : '/profile');
  };

  return (
    <>
      <nav className="mobile-tabbar" aria-label="primary">
        <Link to="/feed" className={`tab${onHome ? ' active' : ''}`}>
          <Home size={22} strokeWidth={1.6} />
          <span>{t('navHome')}</span>
        </Link>

        <button
          type="button"
          className="tab tab-center"
          onClick={() => setSheetOpen(true)}
          aria-label={t('create')}
        >
          <span className="tab-center-pill">
            <Plus size={26} strokeWidth={2} />
          </span>
        </button>

        <Link to="/profile" className={`tab${onProfile ? ' active' : ''}`}>
          <User size={22} strokeWidth={1.6} />
          <span>{t('navProfile')}</span>
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
