// Guided walkthrough, v1 — replaces the stacked onboarding popups. Those
// described the app in the abstract and were forgotten by the time the user
// reached a screen; this one dims the real UI and points at the real control,
// so "where is it" is answered by looking at it.
//
// Shape: a translucent scrim over everything with a hole punched around the
// current target, a caption near the hole, and an X in the corner. The app
// stays faintly visible through the scrim — the point is to show the user
// where they already are, not to replace the screen with a slideshow.
//
// Step copy lives in the locale files under `tour*` keys, so it is hot-fixable
// through the same config/copy override path as everything else.
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { X } from 'lucide-react';
import { useLocale } from '../hooks/useLocale.jsx';
import { hintSeen, markHintSeen } from '../services/homePref.js';

export const TOUR_KEY = 'drape_tour_v1';

// `route` navigates before the step is measured. `pad` widens the hole for
// controls whose visual weight is bigger than their box (the floating nav
// pills carry a shadow well outside their bounds).
const STEPS = [
  { target: '[data-tour="nav-trends"]',  route: '/trends',  body: 'tourTrends',     pad: 10 },
  { target: '[data-tour="nav-profile"]', route: '/trends',  body: 'tourProfileNav', pad: 10 },
  { target: '[data-tour="tabs"]',        route: '/profile', body: 'tourTabs',       pad: 6 },
  { target: '[data-tour="tab-tryon"]',   route: '/profile', body: 'tourTryon',      pad: 6 },
  { target: '[data-tour="stylist"]',     route: '/profile', body: 'tourStylist',    pad: 8 },
  { target: '[data-tour="settings"]',    route: '/profile', body: 'tourSettings',   pad: 8 },
  // Last on purpose: the walkthrough ends holding the thing to do next, so the
  // closing tap lands on the button that starts the closet.
  { target: '[data-tour="nav-create"]',  route: '/profile', body: 'tourCreate',     pad: 12 },
];

// The target may not be mounted yet when a step begins (route change, sticky
// header still animating). Poll briefly rather than measuring a missing node
// and drawing the hole at 0,0.
function useTargetRect(selector, deps) {
  const [rect, setRect] = useState(null);
  const [radius, setRadius] = useState(16);
  const raf = useRef(0);
  useLayoutEffect(() => {
    let tries = 0;
    let alive = true;
    const measure = () => {
      if (!alive) return;
      const el = document.querySelector(selector);
      const r = el?.getBoundingClientRect();
      if (r && r.width > 0 && r.height > 0) {
        // Follow the target's own corner radius so a pill button gets a pill
        // of light, not a rounded square with a circle floating inside it.
        const br = parseFloat(getComputedStyle(el).borderRadius) || 0;
        setRadius(br > Math.min(r.width, r.height) / 2 - 1 ? 999 : br + 6);
        setRect(r);
        return;
      }
      if (tries++ < 60) raf.current = requestAnimationFrame(measure);
      else setRect(null); // give up: the step renders centred, with no hole
    };
    setRect(null);
    measure();
    return () => { alive = false; cancelAnimationFrame(raf.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  useEffect(() => {
    const on = () => {
      const r = document.querySelector(selector)?.getBoundingClientRect();
      if (r) setRect(r);
    };
    window.addEventListener('resize', on);
    window.addEventListener('scroll', on, true);
    return () => {
      window.removeEventListener('resize', on);
      window.removeEventListener('scroll', on, true);
    };
  }, [selector]);
  return [rect, radius];
}

export function Tour({ open, onClose }) {
  const { t } = useLocale();
  const navigate = useNavigate();
  const [i, setI] = useState(0);
  const step = STEPS[i];
  const [rect, radius] = useTargetRect(step?.target, [i, step?.target]);

  // Navigate first so the step's screen is the one behind the scrim.
  useEffect(() => {
    if (!open || !step?.route) return;
    navigate(step.route);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, i]);

  useEffect(() => {
    if (!open) setI(0);
  }, [open]);

  if (!open || !step) return null;

  const finish = () => { markHintSeen(TOUR_KEY); onClose?.(); };
  const next = () => { if (i + 1 >= STEPS.length) finish(); else setI(i + 1); };

  const pad = step.pad ?? 8;
  const hole = rect && {
    left: Math.max(rect.left - pad, 0),
    top: Math.max(rect.top - pad, 0),
    width: rect.width + pad * 2,
    height: rect.height + pad * 2,
  };
  // Caption goes on whichever side has room; a control in the bottom nav gets
  // its caption above, a header control gets it below.
  const below = hole ? hole.top < window.innerHeight / 2 : true;

  return (
    <div className="tour" role="dialog" aria-modal="true" aria-label={t('tourTitle')}>
      {hole ? (
        <div className="tour-hole" style={{ ...hole, borderRadius: radius }} />
      ) : (
        <div className="tour-scrim-full" />
      )}

      <button type="button" className="tour-x" onClick={finish} aria-label={t('close')}>
        <X size={18} strokeWidth={2} />
      </button>

      <div
        className={`tour-caption${below ? ' below' : ' above'}`}
        style={hole
          ? (below ? { top: hole.top + hole.height + 14 } : { bottom: window.innerHeight - hole.top + 14 })
          : undefined}
      >
        <p>{t(step.body)}</p>
        <div className="tour-caption-foot">
          <span className="tour-dots" aria-hidden="true">
            {STEPS.map((s, n) => <i key={s.target} className={n === i ? 'on' : ''} />)}
          </span>
          <button type="button" className="tour-next" onClick={next}>
            {i + 1 >= STEPS.length ? t('done') : t('next')}
          </button>
        </div>
      </div>

      {/* Catch taps outside the caption so the highlighted control can't be
          pressed mid-tour — advancing is the only way forward. */}
      <button type="button" className="tour-advance" onClick={next} aria-label={t('next')} />
    </div>
  );
}

export function tourPending() {
  return !hintSeen(TOUR_KEY);
}

export default Tour;
