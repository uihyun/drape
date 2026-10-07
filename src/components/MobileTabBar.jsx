import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Compass, TrendingUp, Plus, X, Shirt, Sparkles, Grid3x3, ScanEye, Calendar as CalendarIcon, Wand2, Settings as SettingsIcon } from 'lucide-react';
import { useSheetDrag } from '../hooks/useSheetDrag.js';
import { getFeedMode } from '../services/appConfig.js';
import { AddItemSheet } from './AddItemSheet.jsx';
import { useLocale } from '../hooks/useLocale.jsx';

// One glass bar, five slots: Trends · Stylist · (+) · Closet · Settings
// (owner, 2026-10-07 — replaced the three separate Lekondo circles).
// Stylist and Settings came down from the Profile header: the stylist is
// the feature we want used, and a bar slot is where people look. A 5th slot
// for notifications/DMs was rejected on data — nearly nobody gets either yet.
// The glass is CSS (backdrop-filter), not native Liquid Glass, so iOS and
// Android render the same thing.
export function MobileTabBar({ user, onSignIn }) {
  const { t } = useLocale();
  const location = useLocation();
  const navigate = useNavigate();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [addItemOpen, setAddItemOpen] = useState(false);
  const { sheetStyle: createSheetStyle, handleProps: createHandleProps } = useSheetDrag(() => setSheetOpen(false));

  const isLoggedIn = user && !user.isAnonymous;
  const path = location.pathname;
  const onHome = path === '/' || path.startsWith('/feed') || path.startsWith('/trends');
  const onStylist = path.startsWith('/stylist');
  // Only your own closet. /u/:handle is someone else's page — lighting
  // "Closet" there would say you're looking at your own.
  const onProfile = path.startsWith('/profile');
  const onSettings = path.startsWith('/settings');
  // Slot index the sliding pill sits under (2 is the + button, never "active").
  const activeSlot = onHome ? 0 : onStylist ? 1 : onProfile ? 3 : onSettings ? 4 : -1;
  // The + column is narrower than the four labelled ones, so the pill moves in
  // label-column steps and jumps the + column once it's past it.
  const pillCol = activeSlot > 2 ? activeSlot - 1 : activeSlot;
  const feedMode = getFeedMode() === 'feed';

  // Guests hit the shared SignInModal (same as every other gated action) —
  // bouncing to /welcome mid-flow read as a hard eject, not a prompt.
  const gate = () => { if (onSignIn) onSignIn(); else navigate('/welcome'); };

  const go = (to) => () => {
    setSheetOpen(false);
    if (!isLoggedIn) { gate(); return; }
    navigate(to);
  };

  const openAddItem = () => {
    setSheetOpen(false);
    if (!isLoggedIn) { gate(); return; }
    setAddItemOpen(true);
  };

  return (
    <>
      <nav
        className="floating-nav"
        aria-label="primary"
        style={{ '--nav-col': pillCol, '--nav-past-center': activeSlot > 2 ? 1 : 0 }}
      >
        {activeSlot >= 0 && <span className="floating-nav-pill" aria-hidden="true" />}
        <Link
          to={feedMode ? '/feed' : '/trends'}
          data-tour="nav-trends"
          className={`floating-nav-btn${onHome ? ' active' : ''}`}
          aria-current={onHome ? 'page' : undefined}
        >
          {feedMode ? <Compass size={22} strokeWidth={1.6} /> : <TrendingUp size={22} strokeWidth={1.6} />}
          <span className="floating-nav-label">{feedMode ? t('navFeed') : t('navTrends')}</span>
        </Link>

        <Link
          to="/stylist"
          data-tour="stylist"
          className={`floating-nav-btn${onStylist ? ' active' : ''}`}
          aria-current={onStylist ? 'page' : undefined}
        >
          <Wand2 size={22} strokeWidth={1.6} />
          <span className="floating-nav-label">{t('navStylist')}</span>
        </Link>

        <button
          type="button"
          data-tour="nav-create"
          className="floating-nav-btn floating-nav-btn--center"
          onClick={() => setSheetOpen(true)}
          aria-label={t('create')}
        >
          <span className="floating-nav-plus">
            <Plus size={26} strokeWidth={2.2} />
          </span>
        </button>

        <Link
          to="/profile"
          data-tour="nav-profile"
          className={`floating-nav-btn${onProfile ? ' active' : ''}`}
          aria-current={onProfile ? 'page' : undefined}
        >
          <Shirt size={22} strokeWidth={1.6} />
          <span className="floating-nav-label">{t('navCloset')}</span>
        </Link>

        <Link
          to="/settings"
          data-tour="settings"
          className={`floating-nav-btn${onSettings ? ' active' : ''}`}
          aria-current={onSettings ? 'page' : undefined}
        >
          <SettingsIcon size={22} strokeWidth={1.6} />
          <span className="floating-nav-label">{t('navSettings')}</span>
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
              <span className="create-sheet-label">{t('createAnalyze')}</span>
            </button>
            <button type="button" className="create-sheet-row" onClick={go('/tryon?from=create_sheet')}>
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
