import { useLocale } from '../hooks/useLocale.jsx';
import { PRIVACY, LEGAL_EFFECTIVE } from '../data/legal.js';

export function Privacy() {
  const { t, lang } = useLocale();
  const sections = PRIVACY[lang] || PRIVACY.en;
  return (
    <article className="static-page">
      <h2>{t('privacyPolicy')}</h2>
      <p className="static-page-date">{t('legalEffective', { date: LEGAL_EFFECTIVE })}</p>
      {sections.map((s, i) => (
        <section key={i} className="static-page-section">
          {s.h && <h3>{s.h}</h3>}
          <p>{s.p}</p>
        </section>
      ))}
    </article>
  );
}
