import { useLocale } from '../hooks/useLocale.jsx';

export function Privacy() {
  const { t } = useLocale();
  return (
    <article className="static-page">
      <h2>{t('privacy')}</h2>
      <p>{t('privacyBody')}</p>
    </article>
  );
}
