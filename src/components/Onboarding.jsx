// First-launch overlay. Three slides that explain drape's loop:
//   1. Snap each piece → digital closet
//   2. Add 2~3 full-body shots → virtual try-on
//   3. Build outfits + OOTD calendar + share to feed
//
// Persisted in localStorage so it doesn't nag on every visit.

import { useState } from 'react';
import { useLocale } from '../hooks/useLocale.jsx';

const KEY = 'drape_onboarding_dismissed_v1';

function isDismissed() {
  try { return localStorage.getItem(KEY) === '1'; } catch { return true; }
}

function dismiss() {
  try { localStorage.setItem(KEY, '1'); } catch { /* ignore */ }
}

export function Onboarding({ forceShow = false, onClose }) {
  const { t } = useLocale();
  const [hidden, setHidden] = useState(!forceShow && isDismissed());
  const [step, setStep] = useState(0);

  if (hidden) return null;

  const slides = [
    {
      icon: 'checkroom',
      title: t('onboardSlide1Title'),
      body: t('onboardSlide1Body'),
    },
    {
      icon: 'face_retouching_natural',
      title: t('onboardSlide2Title'),
      body: t('onboardSlide2Body'),
    },
    {
      icon: 'calendar_month',
      title: t('onboardSlide3Title'),
      body: t('onboardSlide3Body'),
    },
  ];

  const close = () => {
    dismiss();
    setHidden(true);
    onClose?.();
  };

  const next = () => {
    if (step < slides.length - 1) setStep(step + 1);
    else close();
  };

  const s = slides[step];

  return (
    <div className="modal-overlay">
      <div className="modal-box onboarding-card">
        <div className="onboarding-icon">
          <i className="material-icons">{s.icon}</i>
        </div>
        <h2>{s.title}</h2>
        <p>{s.body}</p>

        <div className="onboarding-dots" aria-hidden="true">
          {slides.map((_, i) => (
            <span key={i} className={`dot${i === step ? ' active' : ''}`} />
          ))}
        </div>

        <div className="controls" style={{ marginTop: '1rem' }}>
          <button className="btn btn-primary" onClick={next}>
            {step === slides.length - 1 ? t('start') : t('next')}
          </button>
          <button className="btn btn-secondary" onClick={close}>
            {t('skip')}
          </button>
        </div>
      </div>
    </div>
  );
}

export default Onboarding;
