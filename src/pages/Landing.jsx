import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { useLocale, LANG_LABELS, SUPPORTED_LANGS } from '../hooks/useLocale.jsx';
import { PhoneShowcase } from '../components/PhoneShowcase.jsx';
import '../styles/landing.css';

// Marketing landing page. Lives at /landing and is the page the buyable
// drape.nyc domain points at (see deploy notes). Fully public, full bleed
// (no app header / nav).
export function Landing() {
  const { t, lang, setLang } = useLocale();
  const [langOpen, setLangOpen] = useState(false);
  const WEB_APP = 'https://drape-9e532.web.app';

  return (
    <div className="landing">
      <header className="lp-nav">
        <span className="lp-brand">drape</span>
        <div className="lp-lang">
          <button
            type="button"
            className="lp-lang-btn"
            onClick={() => setLangOpen(o => !o)}
            aria-haspopup="listbox"
            aria-expanded={langOpen}
          >
            <span aria-hidden="true">{LANG_FLAG[lang] || '🌐'}</span>
            <span>{LANG_LABELS[lang]}</span>
            <ChevronDown size={14} strokeWidth={1.8} />
          </button>
          {langOpen && (
            <ul className="lp-lang-menu" role="listbox">
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

      <main className="lp-hero">
        <PhoneShowcase />

        <div className="lp-copy">
          <ul className="lp-pills">
            <li>{t('landingFeat1')}</li>
            <li>{t('landingFeat2')}</li>
            <li>{t('landingFeat3')}</li>
            <li>{t('landingFeat4')}</li>
            <li>{t('landingFeat5')}</li>
          </ul>

          <h1 className="lp-headline">
            <span className="lp-headline-brand">drape</span>
            <span className="lp-headline-statement">{t('landingHeadline')}</span>
          </h1>
          <p className="lp-tagline">{t('landingTagline')}</p>

          <div className="lp-stores">
            <span className="lp-store">
              <AppleGlyph />
              <span className="lp-store-text">
                <small>{t('landingStoreOn')}</small>
                <strong>App Store</strong>
              </span>
            </span>
            <span className="lp-store">
              <PlayGlyph />
              <span className="lp-store-text">
                <small>{t('landingStoreGet')}</small>
                <strong>Google Play</strong>
              </span>
            </span>
          </div>
        </div>
      </main>

      <footer className="lp-footer">
        <span className="lp-foot-brand">drape</span>
        <nav>
          <a href={`${WEB_APP}/privacy`}>{t('privacyPolicy')}</a>
          <a href={`${WEB_APP}/terms`}>{t('termsOfService')}</a>
        </nav>
      </footer>
    </div>
  );
}

const LANG_FLAG = { en: '🇺🇸', ko: '🇰🇷', ja: '🇯🇵' };

function AppleGlyph() {
  return (
    <svg width="20" height="24" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M16.365 1.43c0 1.14-.493 2.27-1.177 3.08-.744.9-1.99 1.57-2.987 1.57-.12 0-.23-.02-.3-.03-.01-.06-.04-.22-.04-.39 0-1.15.572-2.27 1.206-2.98.804-.94 2.142-1.64 3.248-1.68.03.13.05.28.05.43zm4.565 15.71c-.03.07-.463 1.58-1.518 3.12-.945 1.34-1.94 2.71-3.43 2.71-1.517 0-1.9-.88-3.63-.88-1.698 0-2.302.91-3.67.91-1.377 0-2.332-1.26-3.428-2.8-1.287-1.82-2.323-4.65-2.323-7.34 0-4.31 2.797-6.6 5.552-6.6 1.46 0 2.68.96 3.6.96.87 0 2.23-1.02 3.96-1.02.66 0 3.012.06 4.55 2.29-.12.07-2.69 1.57-2.69 4.76 0 3.74 3.25 5.06 3.34 5.09z" />
    </svg>
  );
}

function PlayGlyph() {
  return (
    <svg width="20" height="22" viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#00D3FF" d="M3.6 2.3c-.4.2-.6.6-.6 1.1v17.2c0 .5.2.9.6 1.1l9.4-9.7L3.6 2.3z" />
      <path fill="#FFCE00" d="M17.3 9.1l-3.5-2-3.4 3.5 3.4 3.5 3.5-2c1.1-.6 1.1-2.4 0-3z" />
      <path fill="#FF3D44" d="M3.6 2.3l9.4 9.7 3.4-3.5L5.6 2.1c-.7-.4-1.5-.3-2 .2z" />
      <path fill="#00E676" d="M3.6 21.7c.5.5 1.3.6 2 .2l10.8-6.4-3.4-3.5-9.4 9.7z" />
    </svg>
  );
}

export default Landing;
