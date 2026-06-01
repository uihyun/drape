import { useLocale } from '../hooks/useLocale.jsx';
import { TERMS, LEGAL_EFFECTIVE } from '../data/legal.js';

export function Terms() {
  const { t, lang } = useLocale();
  const sections = TERMS[lang] || TERMS.en;
  return (
    <article className="static-page">
      <h2>{t('termsOfService')}</h2>
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
