import { Languages } from 'lucide-react';
import { useLocale } from '../hooks/useLocale.jsx';

// Small "translate ↔ show original" button for localized free-text. Renders
// nothing unless the content is in a language other than the viewer's (the
// hook's `canTranslate`). Pass the useContentTranslation() result as `tr`.
export function TranslateToggle({ tr, className = '' }) {
  const { t } = useLocale();
  if (!tr.canTranslate) return null;
  return (
    <button
      type="button"
      className={`translate-toggle${className ? ` ${className}` : ''}`}
      onClick={tr.toggle}
      disabled={tr.loading}
      aria-pressed={tr.showing}
    >
      <Languages size={14} strokeWidth={1.7} />
      {tr.loading ? t('translating') : tr.showing ? t('showOriginal') : t('translateView')}
    </button>
  );
}
