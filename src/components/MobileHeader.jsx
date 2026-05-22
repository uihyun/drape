import { useNavigate, useLocation } from 'react-router-dom';
import { useLocale } from '../hooks/useLocale.jsx';

// Mobile-only header. Shows brand on the home tab; otherwise a back button
// + page title. Tabbed nav lives in MobileTabBar (bottom).
export function MobileHeader({ user, credits, onOpenCredits, title }) {
  const { t } = useLocale();
  const navigate = useNavigate();
  const location = useLocation();
  const isRoot = location.pathname === '/' || location.pathname === '/closet';
  const isLoggedIn = user && !user.isAnonymous;

  return (
    <header className="header header-mobile">
      <div className="header-inner">
        {!isRoot && (
          <button
            className="back-btn"
            onClick={() => (window.history.length > 1 ? navigate(-1) : navigate('/closet'))}
            aria-label={t('back')}
          >
            <i className="material-icons">arrow_back_ios_new</i>
          </button>
        )}
        <h1 className="mobile-title">
          {isRoot ? (
            <span className="brand-word">drape</span>
          ) : (
            title || ''
          )}
        </h1>
        <div className="header-right">
          {isLoggedIn && (
            <button className="credit-badge" onClick={onOpenCredits} title={t('credits')}>
              <i className="material-icons">bolt</i>
              <span>{credits ?? '—'}</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
}

export default MobileHeader;
