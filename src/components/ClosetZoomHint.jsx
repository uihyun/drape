// One-time teach for pinch-to-resize on the closet grid. The gesture has been
// there since the grid shipped and nobody finds it — a gesture with no visible
// affordance is invisible by definition, so it has to be shown once.
//
// Same language as the tour: the app dims behind a scrim and a card explains
// one thing. The glyph animates the gesture itself (arrows in, then out),
// because the motion is the instruction — a sentence about pinching is much
// harder to act on than seeing it.
import { useEffect, useState } from 'react';
import { useLocale } from '../hooks/useLocale.jsx';
import { hintSeen, markHintSeen } from '../services/homePref.js';

export const HINT_CLOSET_ZOOM = 'drape_seen_closet_zoom_v1';

// Below this the grid fits on one screen at any density, so resizing solves
// nothing and the hint would just be noise.
export const ZOOM_HINT_MIN_ITEMS = 6;

export function ClosetZoomHint({ itemCount, onClose }) {
  const { t } = useLocale();
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (itemCount >= ZOOM_HINT_MIN_ITEMS && !hintSeen(HINT_CLOSET_ZOOM)) setShow(true);
  }, [itemCount]);

  if (!show) return null;

  const done = () => { markHintSeen(HINT_CLOSET_ZOOM); setShow(false); onClose?.(); };

  return (
    <div className="zoomhint" role="dialog" aria-modal="true">
      <div className="zoomhint-card">
        <div className="zoomhint-demo" aria-hidden="true">
          {/* Four chevrons that travel inward, hold, then travel outward —
              one loop of the gesture in both directions. */}
          <span className="zoomhint-arrow tl" />
          <span className="zoomhint-arrow tr" />
          <span className="zoomhint-arrow bl" />
          <span className="zoomhint-arrow br" />
          <span className="zoomhint-tiles">
            <i /><i /><i /><i />
          </span>
        </div>
        <p className="zoomhint-text">{t('closetZoomHint')}</p>
        <button type="button" className="btn btn-primary zoomhint-cta" onClick={done}>
          {t('swipeHintCta')}
        </button>
      </div>
    </div>
  );
}

export default ClosetZoomHint;
