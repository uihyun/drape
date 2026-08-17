import { createContext, useContext, useState, useEffect } from 'react';
import { en } from '../locales/en.js';
import { ko } from '../locales/ko.js';
import { ja } from '../locales/ja.js';
import { initRemoteCopy, onRemoteCopy, getCopyOverride } from '../services/remote-copy.js';

const LOCALES = { en, ko, ja };
const SUPPORTED = Object.keys(LOCALES);
const STORAGE_KEY = 'drape_locale';

function detectLang() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved && SUPPORTED.includes(saved)) return saved;
  const browser = navigator.language?.split('-')[0];
  return SUPPORTED.includes(browser) ? browser : 'en';
}

// Non-React accessor for the data layer. Services (which aren't components and
// can't call useLocale) read the current language here to tell the generation
// callables which language to emit free-text in. Same source the provider uses.
export function currentLang() {
  try { return detectLang(); } catch { return 'en'; }
}

const LocaleContext = createContext(null);

function bundled(lang, key) {
  let val = LOCALES[lang];
  for (const p of key.split('.')) val = val?.[p];
  return val;
}

export function LocaleProvider({ children }) {
  const [lang, setLangState] = useState(detectLang);
  const [, setCopyRev] = useState(0);

  // Server copy overrides (config/copy) land async, once per session; bump a
  // counter so every t() consumer re-renders the moment they arrive.
  useEffect(() => {
    initRemoteCopy();
    return onRemoteCopy(() => setCopyRev((r) => r + 1));
  }, []);

  const setLang = (l) => {
    if (!SUPPORTED.includes(l)) return;
    setLangState(l);
    localStorage.setItem(STORAGE_KEY, l);
  };

  // t('key') or t('styles.modern.name') or t('photoLabel', { n: 2 })
  // Server override wins over the bundle at each fallback tier, so a key can
  // be hot-fixed for one language without touching the others.
  const t = (key, params) => {
    let val = getCopyOverride(lang, key);
    if (val === undefined || val === null) val = bundled(lang, key);
    if (val === undefined || val === null) val = getCopyOverride('en', key);
    if (val === undefined || val === null) val = bundled('en', key);

    if (typeof val !== 'string') return key;
    if (!params) return val;
    return val.replace(/\{(\w+)\}/g, (_, k) => (params[k] ?? `{${k}}`));
  };

  // Direct access to the current locale object (for arrays like onboarding steps)
  const locale = LOCALES[lang];

  return (
    <LocaleContext.Provider value={{ t, lang, setLang, locale }}>
      {children}
    </LocaleContext.Provider>
  );
}

export function useLocale() {
  return useContext(LocaleContext);
}

export const SUPPORTED_LANGS = SUPPORTED;
export const LANG_LABELS = { en: 'English', ko: '한국어', ja: '日本語' };
