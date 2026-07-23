// First-launch overlay, v3 — action-first. GA showed the leak is activation
// (signups who never add an item), so instead of three feature-description
// slides we get the user to DO the core thing: one promise slide, then a
// "start with today's outfit" action that drops them into the analyze flow
// (photo → pieces detected → filed into the closet). Home-screen choice
// slide is gone: the default is the closet now (homePref), and Settings
// still has the toggle for feed-first people.
//
// Gated by a localStorage flag only (per-device). KEY stays at v2 on purpose:
// the v3 rework (action-first, 2026-07) targets NEW users — existing users
// who already dismissed v2 should not be re-interrupted.

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLocale } from '../hooks/useLocale.jsx';

const KEY = 'drape_onboarding_dismissed_v2';

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

  const close = () => {
    dismiss();
    setHidden(true);
    onClose?.();
  };

  // The whole point of the overlay: route into logging TODAY's outfit while
  // the motivation is fresh — same path as the + sheet's OOTD row. One photo
  // fills the first calendar day, and the analyzed pieces can be added to
  // the closet from there (the "aha" the old slides only talked about).
  const startWithPhoto = () => {
    close();
    navigate('/profile/calendar?ootd=today');
  };

  return (
    <div className="modal-overlay">
      <div className="modal-box onboarding-card">
        {step === 0 ? (
          <>
            <div className="onboarding-icon">
              <i className="material-icons">checkroom</i>
            </div>
            <h2>{t('onboardSlide1Title')}</h2>
            <p>{t('onboardSlide1Body')}</p>
            <div className="onboarding-dots" aria-hidden="true">
              <span className="dot active" /><span className="dot" />
            </div>
            <div className="controls" style={{ marginTop: '1rem' }}>
              <button className="btn btn-primary" onClick={() => setStep(1)}>
                {t('next')}
              </button>
              <button className="btn btn-secondary" onClick={close}>
                {t('skip')}
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="onboarding-icon">
              <i className="material-icons">photo_camera</i>
            </div>
            <h2>{t('onboardActionTitle')}</h2>
            <p>{t('onboardActionBody')}</p>
            <div className="onboarding-dots" aria-hidden="true">
              <span className="dot" /><span className="dot active" />
            </div>
            <div className="controls" style={{ marginTop: '1rem' }}>
              <button className="btn btn-primary" onClick={startWithPhoto}>
                {t('onboardActionCta')}
              </button>
              <button className="btn btn-secondary" onClick={close}>
                {t('onboardChooseLater')}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default Onboarding;
