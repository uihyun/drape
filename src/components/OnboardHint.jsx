import { useState } from 'react';
import { X } from 'lucide-react';
import { hintSeen, markHintSeen } from '../services/homePref.js';

// A small one-time dismissible banner (generalizes SwipeHint's localStorage
// gate). Renders nothing once `storageKey` is marked seen. Used for the
// home-screen onboarding nudges on Feed and Profile.
//   text     — the message
//   ctaLabel — optional action button label
//   onCta    — called after the CTA (fires after onClose)
//   altLabel — optional SECOND button, replacing the X. Use when the hint asks
//              a real question: an X would leave the answer ambiguous, and
//              "no reply" is not a preference we should record either way.
//   onAlt    — called after the alternative (fires after onClose)
//   onClose  — called whenever the hint closes; use to persist a side effect
export function OnboardHint({ storageKey, text, ctaLabel, onCta, altLabel, onAlt, onClose }) {
  const [show, setShow] = useState(() => !hintSeen(storageKey));
  if (!show) return null;
  const dismiss = () => { markHintSeen(storageKey); setShow(false); onClose?.(); };
  const cta = () => { dismiss(); onCta?.(); };
  const alt = () => { dismiss(); onAlt?.(); };
  return (
    <div className="onboard-hint" role="status">
      <p className="onboard-hint-text">{text}</p>
      <div className="onboard-hint-actions">
        {ctaLabel && (
          <button type="button" className="onboard-hint-cta" onClick={cta}>{ctaLabel}</button>
        )}
        {altLabel ? (
          <button type="button" className="onboard-hint-alt" onClick={alt}>{altLabel}</button>
        ) : (
          <button type="button" className="onboard-hint-x" aria-label="dismiss" onClick={dismiss}>
            <X size={16} strokeWidth={1.9} />
          </button>
        )}
      </div>
    </div>
  );
}

export default OnboardHint;
