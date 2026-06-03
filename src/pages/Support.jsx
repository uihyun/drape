import { useLocale } from '../hooks/useLocale.jsx';

export function Support() {
  const { t } = useLocale();
  return (
    <article className="static-page">
      <h2>{t('support')}</h2>
      <p>{t('supportBody')}</p>
      <p><a href="mailto:uihyunkei@gmail.com">uihyunkei@gmail.com</a></p>
    </article>
  );
}
