import { useNavigate, useLocation } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import { useLocale } from '../hooks/useLocale.jsx';

// Mobile-only header. On the main surfaces (Profile, Home/Feed) the page
// itself provides chrome (handle, invite, settings) — the global header
// would just duplicate that, so we render nothing. On secondary routes we
// show a minimal back-button + page title; the credit badge moved into
// Settings since Lekondo's tone keeps the top bar to bare identity.
const HIDE_ON = [/^\/$/, /^\/profile(\/.*)?$/, /^\/feed$/];

const TITLE_BY_PATH = [
  [/^\/closet\/add$/,  'addItem'],
  [/^\/closet$/,       'navCloset'],
  [/^\/outfits\/new$/, 'newOutfit'],
  [/^\/outfits$/,      'navOutfits'],
  [/^\/o\//,           'outfit'],
  [/^\/s\//,           'outfit'],
  [/^\/i\//,           'item'],
  [/^\/tryon\//,       'navTryOn'],
  [/^\/tryon$/,        'navTryOn'],
  [/^\/calendar$/,     'navCalendar'],
  [/^\/settings$/,     'settings'],
  [/^\/privacy$/,      'privacy'],
  [/^\/terms$/,        'terms'],
  [/^\/support$/,      'support'],
];

function titleKeyFor(pathname) {
  for (const [re, key] of TITLE_BY_PATH) if (re.test(pathname)) return key;
  return null;
}

export function MobileHeader({ title }) {
  const { t } = useLocale();
  const navigate = useNavigate();
  const location = useLocation();
  if (HIDE_ON.some(re => re.test(location.pathname))) return null;

  const key = titleKeyFor(location.pathname);
  const resolved = title || (key ? t(key) : '');

  return (
    <header className="header header-mobile">
      <div className="header-inner">
        <button
          type="button"
          className="back-btn"
          onClick={() => (window.history.length > 1 ? navigate(-1) : navigate('/profile'))}
          aria-label={t('back')}
        >
          <ChevronLeft size={22} strokeWidth={1.8} />
        </button>
        <h1 className="mobile-title">{resolved}</h1>
        <div className="header-right" />
      </div>
    </header>
  );
}

export default MobileHeader;
