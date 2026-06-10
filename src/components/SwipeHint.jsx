import { useState } from 'react';
import { MoveHorizontal } from 'lucide-react';
import { useLocale } from '../hooks/useLocale.jsx';

// One-time coachmark: the first time a user opens a swipeable detail, show a
// dismissible hint that you can swipe left/right to move between items. Gated
// on localStorage so it never nags again (same persistence idea as Onboarding).
const HINT_KEY = 'drape_swipe_hint_v1';

export function SwipeHint() {
  const { t } = useLocale();
  const [show, setShow] = useState(() => {
    try { return localStorage.getItem(HINT_KEY) !== '1'; } catch { return false; }
  });
  if (!show) return null;
  const dismiss = () => {
    try { localStorage.setItem(HINT_KEY, '1'); } catch { /* ignore */ }
    setShow(false);
  };
  return (
    <div className="swipe-hint" role="button" tabIndex={0} onClick={dismiss} aria-label={t('swipeHintCta')}>
      <div className="swipe-hint-card" onClick={(e) => e.stopPropagation()}>
        <div className="swipe-hint-arrows" aria-hidden="true">
          <MoveHorizontal size={44} strokeWidth={1.4} />
        </div>
        <p className="swipe-hint-text">{t('swipeHint')}</p>
        <button type="button" className="btn btn-primary swipe-hint-btn" onClick={dismiss}>
          {t('swipeHintCta')}
        </button>
      </div>
    </div>
  );
}

export default SwipeHint;
