import { useState } from 'react';
import { X } from 'lucide-react';
import { AuthService } from '../services/auth-service.js';
import { useLocale } from '../hooks/useLocale.jsx';

// Sign-in chooser shown when any in-app CTA hits an "auth required"
// branch. Mirrors Welcome's two-provider list (Google + Apple) so
// users land on the same buttons whether they're signing in fresh or
// from inside an already-running session.
export function SignInModal({ open, onClose, onSignedIn }) {
  const { t } = useLocale();
  const [busy, setBusy] = useState(null); // 'google' | 'apple' | null
  const [error, setError] = useState(null);

  if (!open) return null;

  const after = () => { onSignedIn?.(); onClose?.(); };

  const onGoogle = async () => {
    setBusy('google'); setError(null);
    try { await AuthService.signInWithGoogle(); after(); }
    catch (e) { setError(e.message || 'Sign-in failed'); }
    finally { setBusy(null); }
  };

  const onApple = async () => {
    setBusy('apple'); setError(null);
    try { await AuthService.signInWithApple(); after(); }
    catch (e) { setError(e.message || 'Sign-in failed'); }
    finally { setBusy(null); }
  };

  return (
    <div className="create-sheet-overlay" onClick={onClose}>
      <div className="create-sheet signin-sheet" onClick={e => e.stopPropagation()} role="dialog" aria-modal="true">
        <div className="create-sheet-handle" />
        <button type="button" className="create-sheet-close" onClick={onClose} aria-label={t('close')}>
          <X size={18} />
        </button>
        <h3 className="signin-sheet-title">{t('signInTitle')}</h3>
        <p className="signin-sheet-sub">{t('signInSubtitle')}</p>

        <div className="signin-sheet-actions">
          <button
            type="button"
            className="signin-btn signin-btn--google"
            onClick={onGoogle}
            disabled={!!busy}
          >
            <GoogleGlyph />
            <span>{busy === 'google' ? t('signingIn') : t('continueGoogle')}</span>
          </button>
          <button
            type="button"
            className="signin-btn signin-btn--apple"
            onClick={onApple}
            disabled={!!busy}
          >
            <AppleGlyph />
            <span>{busy === 'apple' ? t('signingIn') : t('continueApple')}</span>
          </button>
        </div>

        {error && <p className="settings-error" style={{ textAlign: 'center', margin: '0.6rem 0 0' }}>{error}</p>}
      </div>
    </div>
  );
}

function GoogleGlyph() {
  return (
    <svg width="20" height="20" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.6-6 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8c1.8-4.4 6.1-7.5 11.1-7.5 3.1 0 5.9 1.2 8 3l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2c-2 1.4-4.5 2.4-7.2 2.4-5.3 0-9.7-3.4-11.3-8.1l-6.6 5.1C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.1-4.1 5.5l6.2 5.2c-.4.4 6.6-4.8 6.6-14.7 0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  );
}

function AppleGlyph() {
  return (
    <svg width="18" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M16.365 1.43c0 1.14-.493 2.27-1.177 3.08-.744.9-1.99 1.57-2.987 1.57-.12 0-.23-.02-.3-.03-.01-.06-.04-.22-.04-.39 0-1.15.572-2.27 1.206-2.98.804-.94 2.142-1.64 3.248-1.68.03.13.05.28.05.43zm4.565 15.71c-.03.07-.463 1.58-1.518 3.12-.945 1.34-1.94 2.71-3.43 2.71-1.517 0-1.9-.88-3.63-.88-1.698 0-2.302.91-3.67.91-1.377 0-2.332-1.26-3.428-2.8-1.287-1.82-2.323-4.65-2.323-7.34 0-4.31 2.797-6.6 5.552-6.6 1.46 0 2.68.96 3.6.96.87 0 2.23-1.02 3.96-1.02.66 0 3.012.06 4.55 2.29-.12.07-2.69 1.57-2.69 4.76 0 3.74 3.25 5.06 3.34 5.09z" />
    </svg>
  );
}

export default SignInModal;
