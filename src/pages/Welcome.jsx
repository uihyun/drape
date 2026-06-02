import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Compass, ChevronDown } from 'lucide-react';
import { AuthService } from '../services/auth-service.js';
import { useLocale, LANG_LABELS, SUPPORTED_LANGS } from '../hooks/useLocale.jsx';

// First-run welcome / sign-in page (Lekondo capture 1):
// brand wordmark + lang picker on top, a hero phone-mockup region in the
// middle (kept simple — a soft gradient panel with the marketing line),
// three stacked sign-in buttons at the bottom (Google / Apple / Email),
// terms + version footer. No global header or floating nav here — the
// page is a full-bleed first impression.
export function Welcome() {
  const { t, lang, setLang } = useLocale();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(null); // 'google' | 'apple' | 'email' | null
  const [error, setError] = useState(null);
  const [langOpen, setLangOpen] = useState(false);

  const afterSignIn = () => navigate('/profile', { replace: true });

  // Swallow user-driven cancellations so closing the OAuth popup or
  // denying consent doesn't show a scary red error message.
  const CANCEL_CODES = new Set([
    'auth/user-cancelled',
    'auth/popup-closed-by-user',
    'auth/cancelled-popup-request',
  ]);
  const onSignInErr = (e) => {
    if (e?.code && CANCEL_CODES.has(e.code)) return;
    setError(e?.message || 'Sign-in failed');
  };

  const onGoogle = async () => {
    setBusy('google'); setError(null);
    try { await AuthService.signInWithGoogle(); afterSignIn(); }
    catch (e) { onSignInErr(e); }
    finally { setBusy(null); }
  };

  const onApple = async () => {
    setBusy('apple'); setError(null);
    try { await AuthService.signInWithApple(); afterSignIn(); }
    catch (e) { onSignInErr(e); }
    finally { setBusy(null); }
  };

  const onBrowse = () => navigate('/feed');

  const version = (typeof __APP_VERSION__ !== 'undefined' && __APP_VERSION__) || '0.1.0';

  return (
    <div className="welcome">
      <header className="welcome-header">
        <span className="welcome-brand">DRAPE</span>
        <div className="welcome-lang">
          <button
            type="button"
            className="welcome-lang-btn"
            onClick={() => setLangOpen(o => !o)}
            aria-haspopup="listbox"
            aria-expanded={langOpen}
          >
            <span aria-hidden="true">{LANG_FLAG[lang] || '🌐'}</span>
            <span>{LANG_LABELS[lang]}</span>
            <ChevronDown size={14} strokeWidth={1.8} />
          </button>
          {langOpen && (
            <ul className="welcome-lang-menu" role="listbox">
              {SUPPORTED_LANGS.map(code => (
                <li key={code}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={lang === code}
                    onClick={() => { setLang(code); setLangOpen(false); }}
                  >
                    <span aria-hidden="true">{LANG_FLAG[code]}</span>
                    {LANG_LABELS[code]}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </header>

      <section className="welcome-hero" aria-hidden="true">
        <div className="welcome-hero-panel">
          <p className="welcome-tagline">{t('welcomeTagline')}</p>
        </div>
      </section>

      <section className="welcome-actions">
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

        <div className="signin-divider" role="separator" />

        <button
          type="button"
          className="signin-btn signin-btn--browse"
          onClick={onBrowse}
          disabled={!!busy}
        >
          <Compass size={18} strokeWidth={1.8} />
          <span>{t('browseWithoutSignIn')}</span>
        </button>

        {error && <p className="welcome-error">{error}</p>}
      </section>

      <footer className="welcome-footer">
        <p className="welcome-legal">
          <a href="/terms">{t('termsOfService')}</a>
          <span className="welcome-legal-dot" aria-hidden="true">·</span>
          <a href="/privacy">{t('privacyPolicy')}</a>
          <span className="welcome-legal-dot" aria-hidden="true">·</span>
          <span className="welcome-version">v{version}</span>
        </p>
      </footer>
    </div>
  );
}

const LANG_FLAG = { en: '🇺🇸', ko: '🇰🇷', ja: '🇯🇵' };

// Google G — multicolor, simplified path.
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

// Apple logo — single path silhouette.
function AppleGlyph() {
  return (
    <svg width="18" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M16.365 1.43c0 1.14-.493 2.27-1.177 3.08-.744.9-1.99 1.57-2.987 1.57-.12 0-.23-.02-.3-.03-.01-.06-.04-.22-.04-.39 0-1.15.572-2.27 1.206-2.98.804-.94 2.142-1.64 3.248-1.68.03.13.05.28.05.43zm4.565 15.71c-.03.07-.463 1.58-1.518 3.12-.945 1.34-1.94 2.71-3.43 2.71-1.517 0-1.9-.88-3.63-.88-1.698 0-2.302.91-3.67.91-1.377 0-2.332-1.26-3.428-2.8-1.287-1.82-2.323-4.65-2.323-7.34 0-4.31 2.797-6.6 5.552-6.6 1.46 0 2.68.96 3.6.96.87 0 2.23-1.02 3.96-1.02.66 0 3.012.06 4.55 2.29-.12.07-2.69 1.57-2.69 4.76 0 3.74 3.25 5.06 3.34 5.09z" />
    </svg>
  );
}

export default Welcome;
