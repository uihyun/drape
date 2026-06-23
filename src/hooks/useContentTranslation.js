import { useState } from 'react';
import { useLocale } from './useLocale.jsx';
import { TranslationService } from '../services/translation-service.js';

// Drives a "translate ↔ show original" toggle for a doc's localized free-text.
// `canTranslate` is true only when the content's language differs from the
// viewer's, so same-language posts never show the affordance. `fields` is the
// translated shape (null until toggled on) for the caller to overlay by key /
// array index over the original.
export function useContentTranslation(coll, id, contentLang) {
  const { lang } = useLocale();
  const target = lang;
  const canTranslate = !!id && (contentLang || 'en') !== target;

  const [showing, setShowing] = useState(false);
  const [fields, setFields] = useState(null);
  const [loading, setLoading] = useState(false);

  const toggle = async () => {
    if (showing) { setShowing(false); return; }
    if (fields) { setShowing(true); return; }   // already fetched this session
    setLoading(true);
    try {
      const f = await TranslationService.getOrTranslate(coll, id, target);
      if (f) { setFields(f); setShowing(true); }
    } catch (err) {
      console.warn('translate failed:', err?.message);
    } finally {
      setLoading(false);
    }
  };

  return { canTranslate, showing, loading, toggle, fields: showing ? fields : null };
}
