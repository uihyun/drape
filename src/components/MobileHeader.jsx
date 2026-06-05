import { useNavigate, useLocation } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import { useLocale } from '../hooks/useLocale.jsx';

// Back-button only header. The page itself (Settings, AddItem,
// OutfitBuilder, ItemDetail, etc.) owns its own h1, so a centered
// title here would just duplicate it. We render a transparent floating
// back button that sits in the safe-area without taking layout space.
const HIDE_ON = [
  /^\/$/,
  /^\/profile(\/.*)?$/,
  /^\/feed$/,
  /^\/welcome$/,
  // ItemDetail and OutfitShare are full-screen viewers with their own
  // close button.
  /^\/i\//,
  /^\/s\//,
  // Thread has its own header back button (→ /messages).
  /^\/messages\/[^/]+$/,
];

export function MobileHeader() {
  const { t } = useLocale();
  const navigate = useNavigate();
  const location = useLocation();
  if (HIDE_ON.some(re => re.test(location.pathname))) return null;

  return (
    <header className="page-back-bar">
      <button
        type="button"
        className="page-back-btn"
        onClick={() => (window.history.length > 1 ? navigate(-1) : navigate('/profile'))}
        aria-label={t('back')}
      >
        <ChevronLeft size={22} strokeWidth={1.8} />
      </button>
    </header>
  );
}

export default MobileHeader;
