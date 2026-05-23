import { Link, useNavigate } from 'react-router-dom';
import { useLocale, LANG_LABELS } from '../hooks/useLocale.jsx';

// Desktop header — brand wordmark + primary nav + lang + user chip.
// MobileTabBar handles small screens; this is hidden under 768px via CSS.
export function Header({ user, credits, onSignIn, onSignOut, onOpenCredits }) {
  const { t, lang, setLang } = useLocale();
  const navigate = useNavigate();
  const isLoggedIn = user && !user.isAnonymous;

  return (
    <header className="header header-desktop">
      <div className="header-inner">
        <Link to="/" className="brand">
          <span className="brand-mark" aria-hidden="true">◐</span>
          <span className="brand-word">drape</span>
        </Link>

        <nav className="header-nav">
          <Link to="/closet">{t('navCloset')}</Link>
          <Link to="/outfits">{t('navOutfits')}</Link>
          <Link to="/calendar">{t('navCalendar')}</Link>
          <Link to="/tryon">{t('navTryOn')}</Link>
          <Link to="/feed">{t('navFeed')}</Link>
        </nav>

        <div className="header-right">
          <select
            aria-label={t('langLabel')}
            value={lang}
            onChange={e => setLang(e.target.value)}
            className="lang-select"
          >
            {Object.entries(LANG_LABELS).map(([code, label]) => (
              <option key={code} value={code}>{label}</option>
            ))}
          </select>

          {isLoggedIn ? (
            <>
              <button className="credit-badge" onClick={onOpenCredits} title={t('credits')}>
                <i className="material-icons" aria-hidden="true">bolt</i>
                <span>{credits?.credits ?? '—'}</span>
              </button>
              <button
                className="avatar-btn"
                onClick={() => navigate('/settings')}
                title={t('settings')}
              >
                {user.photoURL
                  ? <img src={user.photoURL} alt="" />
                  : <i className="material-icons">person</i>}
              </button>
            </>
          ) : (
            <button className="btn btn-primary" onClick={onSignIn}>
              <i className="material-icons">login</i>
              {t('signIn')}
            </button>
          )}
        </div>
      </div>
    </header>
  );
}

export default Header;
