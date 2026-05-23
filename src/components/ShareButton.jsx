import { useState } from 'react';
import { Share2, Check } from 'lucide-react';
import { shareLink } from '../services/share-service.js';
import { useLocale } from '../hooks/useLocale.jsx';

// Drop-in share button. Wraps shareLink so callers don't repeat the
// Web Share API + clipboard fallback dance. Briefly flips to a "copied"
// state when the platform falls back to clipboard so the user gets
// confirmation that anything happened.
export function ShareButton({ title, text, url, className = '', label }) {
  const { t } = useLocale();
  const [copied, setCopied] = useState(false);

  const onClick = async () => {
    try {
      const shared = await shareLink({ title, text, url });
      if (!shared) {
        setCopied(true);
        setTimeout(() => setCopied(false), 1600);
      }
    } catch (err) {
      console.warn('share failed', err?.message);
    }
  };

  return (
    <button
      type="button"
      className={`share-btn ${className}`}
      onClick={onClick}
      aria-label={label || t('share')}
    >
      {copied ? <Check size={16} strokeWidth={1.8} /> : <Share2 size={16} strokeWidth={1.6} />}
      <span>{copied ? t('copiedLink') : (label || t('share'))}</span>
    </button>
  );
}

export default ShareButton;
