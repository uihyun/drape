// First-launch overlay, v4 — action-first AND server-arrangeable. v3 attacked
// the activation leak (signups who never add an item) by cutting to a single
// promise + "start with today's outfit" action — but that cut every mention of
// try-on, the product's reason to exist, and the 2026-08 funnel review showed
// users never discover it. v4 restores a try-on step and moves the whole step
// list behind config/copy (remote-copy.js): copy AND flow order can now change
// without a store release. Step text fields are locale KEYS (hot-fixable via
// the same doc's string overrides), never inline text.
//
// Gated by a localStorage flag only (per-device). KEY stays at v2 on purpose:
// users who already dismissed an earlier version should not be re-interrupted.

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLocale } from '../hooks/useLocale.jsx';
import { getRemoteOnboardingSteps } from '../services/remote-copy.js';

const KEY = 'drape_onboarding_dismissed_v2';

// Baked-in default flow. A step with `route` closes the overlay and navigates
// (the activation path — same as the + sheet's OOTD row: one photo fills the
// first calendar day and the analyzed pieces flow into the closet); steps
// without one just advance.
const BAKED_STEPS = [
  { icon: 'checkroom', title: 'onboardSlide1Title', body: 'onboardSlide1Body' },
  { icon: 'auto_awesome', title: 'onboardTryonTitle', body: 'onboardTryonBody' },
  {
    icon: 'photo_camera',
    title: 'onboardActionTitle',
    body: 'onboardActionBody',
    cta: 'onboardActionCta',
    route: '/profile/calendar?ootd=today',
    skip: 'onboardChooseLater',
  },
];

function isDismissed() {
  try { return localStorage.getItem(KEY) === '1'; } catch { return true; }
}

function dismiss() {
  try { localStorage.setItem(KEY, '1'); } catch { /* ignore */ }
}

export function Onboarding({ user, forceShow = false, onClose }) {
  const { t } = useLocale();
  const navigate = useNavigate();
  const [hidden, setHidden] = useState(true);
  const [step, setStep] = useState(0);

  useEffect(() => {
    setHidden(forceShow ? false : isDismissed());
  }, [user?.uid, forceShow]);

  if (hidden) return null;

  const steps = getRemoteOnboardingSteps() || BAKED_STEPS;
  const s = steps[Math.min(step, steps.length - 1)];
  const isLast = step >= steps.length - 1;

  const close = () => {
    dismiss();
    setHidden(true);
    onClose?.();
  };

  const primary = () => {
    if (s.route) { close(); navigate(s.route); return; }
    if (isLast) { close(); return; }
    setStep(step + 1);
  };

  return (
    <div className="modal-overlay">
      <div className="modal-box onboarding-card">
        <div className="onboarding-icon">
          <i className="material-icons">{s.icon}</i>
        </div>
        <h2>{t(s.title)}</h2>
        <p>{t(s.body)}</p>
        <div className="onboarding-dots" aria-hidden="true">
          {steps.map((_, i) => (
            <span key={i} className={`dot${i === step ? ' active' : ''}`} />
          ))}
        </div>
        <div className="controls" style={{ marginTop: '1rem' }}>
          <button className="btn btn-primary" onClick={primary}>
            {t(s.cta || 'next')}
          </button>
          <button className="btn btn-secondary" onClick={close}>
            {t(s.skip || 'skip')}
          </button>
        </div>
      </div>
    </div>
  );
}

export default Onboarding;
