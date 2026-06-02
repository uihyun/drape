import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Home, User, Plus, X, Shirt, Sparkles, Grid3x3, ScanEye, Calendar as CalendarIcon } from 'lucide-react';
import { useSheetDrag } from '../hooks/useSheetDrag.js';
import { AddItemSheet } from './AddItemSheet.jsx';
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
  const [addItemOpen, setAddItemOpen] = useState(false);
  const { sheetStyle: createSheetStyle, handleProps: createHandleProps } = useSheetDrag(() => setSheetOpen(false));

  const isLoggedIn = user && !user.isAnonymous;
  const onHome = location.pathname === '/' || location.pathname.startsWith('/feed');
  const onProfile = location.pathname.startsWith('/profile') || location.pathname.startsWith('/u/');

  const go = (path) => () => {
    setSheetOpen(false);
    navigate(isLoggedIn ? path : '/welcome');
  };

  const openAddItem = () => {
    setSheetOpen(false);
    if (!isLoggedIn) { navigate('/welcome'); return; }
    setAddItemOpen(true);
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
          <div className="create-sheet" style={createSheetStyle} onClick={e => e.stopPropagation()} role="dialog" aria-modal="true">
            <div className="create-sheet-handle" {...createHandleProps} style={{ cursor: 'grab' }} />
            <button type="button" className="create-sheet-close" onClick={() => setSheetOpen(false)} aria-label={t('close')}>
              <X size={18} />
            </button>
            <h3 className="create-sheet-title">{t('createSheetTitle')}</h3>
            {/* All rows equal weight. Order is reverse-frequency + reach: the
                sheet rises from the + button at the bottom, so the LAST row
                sits closest to where the thumb just was. "Add item" is both
                the most frequent and the only action whose fast path is this
                sheet (OOTD also opens from the calendar, try-on from an item
                or an outfit, analyze/boards are occasional) — so it goes last,
                right above the thumb. Rarer / multi-entry actions sit higher. */}
            <button type="button" className="create-sheet-row" onClick={go('/boards/new')}>
              <span className="create-sheet-icon"><Grid3x3 size={20} strokeWidth={1.5} /></span>
              <span className="create-sheet-label">{t('createBoard')}</span>
            </button>
            <button type="button" className="create-sheet-row" onClick={go('/analyze')}>
              <span className="create-sheet-icon"><ScanEye size={20} strokeWidth={1.5} /></span>
              <span className="create-sheet-label">
                {t('createAnalyze')}
                <span className="create-sheet-sub">{t('createAnalyzeSub')}</span>
              </span>
            </button>
            <button type="button" className="create-sheet-row" onClick={go('/tryon')}>
              <span className="create-sheet-icon"><Sparkles size={20} strokeWidth={1.5} /></span>
              <span className="create-sheet-label">{t('createTryOn')}</span>
            </button>
            <button type="button" className="create-sheet-row" onClick={go('/profile/calendar?ootd=today')}>
              <span className="create-sheet-icon"><CalendarIcon size={20} strokeWidth={1.5} /></span>
              <span className="create-sheet-label">{t('createLogOotd')}</span>
            </button>
            <button type="button" className="create-sheet-row" onClick={openAddItem}>
              <span className="create-sheet-icon"><Shirt size={20} strokeWidth={1.5} /></span>
              <span className="create-sheet-label">{t('createAddItem')}</span>
            </button>
          </div>
        </div>
      )}

      <AddItemSheet
        open={addItemOpen}
        user={user}
        onClose={() => setAddItemOpen(false)}
        onSaved={() => { setAddItemOpen(false); navigate('/profile/closet'); }}
      />
    </>
  );
}

export default MobileTabBar;
