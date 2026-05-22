import { Link, useLocation } from 'react-router-dom';
import { useLocale } from '../hooks/useLocale.jsx';

const TABS = [
  { to: '/closet',   icon: 'checkroom',         labelKey: 'navCloset' },
  { to: '/outfits',  icon: 'auto_awesome_motion', labelKey: 'navOutfits' },
  { to: '/calendar', icon: 'calendar_month',    labelKey: 'navCalendar' },
  { to: '/tryon',    icon: 'face_retouching_natural', labelKey: 'navTryOn' },
  { to: '/feed',     icon: 'photo_library',     labelKey: 'navFeed' },
];

export function MobileTabBar({ user }) {
  const { t } = useLocale();
  const location = useLocation();
  const isLoggedIn = user && !user.isAnonymous;

  return (
    <nav className="mobile-tabbar" aria-label="primary">
      {TABS.map(({ to, icon, labelKey }) => {
        const active = location.pathname === to || location.pathname.startsWith(to + '/');
        return (
          <Link key={to} to={to} className={`tab${active ? ' active' : ''}`}>
            <i className="material-icons">{icon}</i>
            <span>{t(labelKey)}</span>
          </Link>
        );
      })}
      <Link
        to={isLoggedIn ? '/settings' : '/signin'}
        className={`tab${location.pathname.startsWith('/settings') ? ' active' : ''}`}
      >
        <i className="material-icons">person</i>
        <span>{t('navMe')}</span>
      </Link>
    </nav>
  );
}

export default MobileTabBar;
