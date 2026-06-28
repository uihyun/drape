import { useState } from 'react';
import { X } from 'lucide-react';
import { hintSeen, markHintSeen } from '../services/homePref.js';

// A small one-time dismissible banner (generalizes SwipeHint's localStorage
// gate). Renders nothing once `storageKey` is marked seen. Used for the
// home-screen onboarding nudges on Feed and Profile.
//   text     — the message
//   ctaLabel — optional action button label
//   onCta    — called after the CTA (fires after onClose)
//   onClose  — called whenever the hint closes (CTA or dismiss); use to persist
//              a side effect like "from now on, open profile"
export function OnboardHint({ storageKey, text, ctaLabel, onCta, onClose }) {
  const [show, setShow] = useState(() => !hintSeen(storageKey));
  if (!show) return null;
  const dismiss = () => { markHintSeen(storageKey); setShow(false); onClose?.(); };
  const cta = () => { dismiss(); onCta?.(); };
  return (
    <div className="onboard-hint" role="status">
      <p className="onboard-hint-text">{text}</p>
      <div className="onboard-hint-actions">
        {ctaLabel && (
          <button type="button" className="onboard-hint-cta" onClick={cta}>{ctaLabel}</button>
        )}
        <button type="button" className="onboard-hint-x" aria-label="dismiss" onClick={dismiss}>
          <X size={16} strokeWidth={1.9} />
        </button>
      </div>
    </div>
  );
}

export default OnboardHint;
