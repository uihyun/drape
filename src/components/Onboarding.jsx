// First-launch overlay. Three intro slides + a final "how will you use drape?"
// choice that sets the home screen:
//   1. Snap pieces → closet + build outfits + OOTD calendar
//   2. Add full-body shots → virtual try-on
//   3. Discover & shop — feed, spot pieces, buy/sell
//   4. Choose home: My closet (→profile) or Browse (→feed)
//
// Gated by a localStorage flag only (per-device). Reinstall re-shows it — rare,
// and skippable. Bump the KEY version to re-show after a major onboarding change.

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLocale } from '../hooks/useLocale.jsx';
import { setHomePref } from '../services/homePref.js';

// v2: the 5-slide intro became 3 slides + a "how will you use drape?" home choice.
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
  // Show unless this device has already dismissed it (local flag only).
  const [hidden, setHidden] = useState(true);
  const [step, setStep] = useState(0);

  useEffect(() => {
    setHidden(forceShow ? false : isDismissed());
  }, [user?.uid, forceShow]);

  if (hidden) return null;

  const slides = [
    { icon: 'checkroom', title: t('onboardSlide1Title'), body: t('onboardSlide1Body') },
    { icon: 'face_retouching_natural', title: t('onboardSlide2Title'), body: t('onboardSlide2Body') },
    { icon: 'explore', title: t('onboardSlide3Title'), body: t('onboardSlide3Body') },
    { choice: true },
  ];

  const close = () => {
    dismiss();
    setHidden(true);
    onClose?.();
  };

  // Final slide: lock in the home screen, then drop the user straight onto it.
  const chooseHome = (pref) => {
    setHomePref(pref);
    close();
    navigate(pref === 'profile' ? '/profile' : '/feed');
  };

  const next = () => {
    if (step < slides.length - 1) setStep(step + 1);
    else close();
  };

  const s = slides[step];

  return (
    <div className="modal-overlay">
      <div className="modal-box onboarding-card">
        {s.choice ? (
          <>
            <h2>{t('onboardChooseTitle')}</h2>
            <p className="onboard-choose-sub">{t('onboardChooseSubtitle')}</p>
            <div className="onboard-choose">
              <button type="button" className="onboard-choose-card" onClick={() => chooseHome('profile')}>
                <i className="material-icons">checkroom</i>
                <span className="onboard-choose-label">{t('onboardChooseProfile')}</span>
                <span className="onboard-choose-desc">{t('onboardChooseProfileDesc')}</span>
              </button>
              <button type="button" className="onboard-choose-card" onClick={() => chooseHome('feed')}>
                <i className="material-icons">explore</i>
                <span className="onboard-choose-label">{t('onboardChooseFeed')}</span>
                <span className="onboard-choose-desc">{t('onboardChooseFeedDesc')}</span>
              </button>
            </div>
            <div className="onboarding-dots" aria-hidden="true">
              {slides.map((_, i) => (
                <span key={i} className={`dot${i === step ? ' active' : ''}`} />
              ))}
            </div>
            <button type="button" className="onboard-choose-later" onClick={close}>
              {t('onboardChooseLater')}
            </button>
          </>
        ) : (
          <>
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
                {t('next')}
              </button>
              <button className="btn btn-secondary" onClick={close}>
                {t('skip')}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default Onboarding;
