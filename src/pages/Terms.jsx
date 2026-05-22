import { useLocale } from '../hooks/useLocale.jsx';

export function Terms() {
  const { t } = useLocale();
  return (
    <article className="static-page">
      <h2>{t('terms')}</h2>
      <p>{t('termsBody')}</p>
    </article>
  );
}
