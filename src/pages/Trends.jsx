import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase.js';
import { useLocale } from '../hooks/useLocale.jsx';
import { COLOR_HEX } from '../services/taxonomy.js';
import { STYLIST_PERSONAS } from '../services/stylist-service.js';
import { cityDisplay } from '../data/cities.js';

// Trends as a weekly fashion issue, not a dashboard (owner, 2026-09-15:
// "절대 대시보드처럼 보이면 안 돼"). Editorial grammar borrowed from the
// brand itself — Bodoni italic display, letterspaced kickers, hairline
// rules, one inverted ink band, collage picks. Data contract unchanged:
// numbers from everyone, images only from public surfaces
// (functions/trends.js).
export function Trends() {
  const { t, lang } = useLocale();
  const [data, setData] = useState(undefined);

  useEffect(() => {
    getDoc(doc(db, 'trends', 'current'))
      .then((s) => setData(s.exists() ? s.data() : null))
      .catch(() => setData(null));
  }, []);

  if (data === undefined) return <div className="loading"><div className="spinner" /></div>;
  if (!data) {
    return (
      <div className="page">
        <h1 className="page-h1">{t('trendsTitle')}</h1>
        <div className="empty-state"><p>{t('trendsEmpty')}</p></div>
      </div>
    );
  }

  const personaOf = (id) => STYLIST_PERSONAS.find((p) => p.id === id) || STYLIST_PERSONAS[0];
  const label = (ns, key) => t(`taxonomy.${ns}.${key}`) || key;
  const topStyle = data.topStyles?.[0];
  const [coverPick, ...gridPicks] = data.picks || [];
  const regionsLine = (data.regions || [])
    .map((r) => cityDisplay(r.key, lang) || r.key).slice(0, 3).join(' · ');

  return (
    <div className="tmag">
      {/* Hero — the week's cover: top public look, headline overlaid. */}
      <header className={`tmag-hero${coverPick ? '' : ' tmag-hero--ink'}`}>
        {coverPick && (
          <Link to={`/o/${coverPick.id}`} className="tmag-hero-img">
            <img src={coverPick.img} alt="" />
          </Link>
        )}
        <div className="tmag-hero-text">
          <p className="tmag-kicker tmag-kicker--hero">{t('trendsKicker')}</p>
          {topStyle && (
            <h1 className="tmag-headline">
              {t('trendsHeadline', { style: label('styles', topStyle.key) })}
            </h1>
          )}
          <p className="tmag-dataline">
            {t('trendsDataline', {
              items: data.stats?.itemsThisWeek ?? 0,
              tryons: data.stats?.tryonsThisWeek ?? 0,
            })}
            {regionsLine ? ` · ${regionsLine}` : ''}
          </p>
        </div>
      </header>

      {/* Styles — horizontal snap cards, serif numeral watermark. */}
      {data.topStyles?.length > 0 && (
        <section className="tmag-section">
          <p className="tmag-kicker">{t('trendsTopStyles')}</p>
          <div className="tmag-cards">
            {data.topStyles.slice(0, 5).map((s, i) => {
              const p = personaOf(s.persona);
              return (
                <div className="tmag-stylecard" key={s.key}>
                  <span className="tmag-stylecard-no">{String(i + 1).padStart(2, '0')}</span>
                  <strong>{label('styles', s.key)}</strong>
                  <span className="tmag-stylecard-count">{s.count}</span>
                  <span className="tmag-stylecard-by">
                    <img src={p.img} alt="" /> {p.name} <em>AI</em>
                  </span>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Palette — compact dot strip. */}
      {data.topColors?.length > 0 && (
        <section className="tmag-section">
          <p className="tmag-kicker">{t('trendsTopColors')}</p>
          <div className="tmag-palette">
            {data.topColors.slice(0, 6).map((c) => (
              <div className="tmag-swatch" key={c.key}>
                <i style={{ background: COLOR_HEX[c.key] || '#ccc' }} />
                <span>{label('colors', c.key)}</span>
                <em>{c.count}</em>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Community picks — 2-up grid with pill tags (cover already used). */}
      {gridPicks.length > 0 && (
        <section className="tmag-section">
          <p className="tmag-kicker">{t('trendsCommunityPicks')}</p>
          <div className="tmag-grid">
            {gridPicks.map((o) => (
              <Link to={`/o/${o.id}`} key={o.id} className="tmag-cell">
                <img src={o.img} alt="" loading="lazy" />
                {o.style && <span className="tmag-pill">{label('styles', o.style)}</span>}
              </Link>
            ))}
          </div>
          <p className="tmag-note">{t('trendsCuratedNote')}</p>
        </section>
      )}

      {/* Tried-on — dark module (rounded, lekondo-style block). */}
      {data.triedOnCategories?.length > 0 && (
        <section className="tmag-ink">
          <p className="tmag-kicker tmag-kicker--ink">{t('trendsTriedOn')}</p>
          <div className="tmag-ink-list">
            {data.triedOnCategories.slice(0, 5).map((c) => (
              <span key={c.key}>
                {label('categories', c.key)}<em>×{c.count}</em>
              </span>
            ))}
          </div>
        </section>
      )}

      {/* Marketplace strip. */}
      {data.market?.length > 0 && (
        <section className="tmag-section">
          <p className="tmag-kicker">{t('trendsMarket')}</p>
          <div className="tmag-strip">
            {data.market.map((m) => (
              <Link to={`/i/${m.id}`} key={m.id} className="tmag-strip-item">
                <img src={m.img} alt="" loading="lazy" />
              </Link>
            ))}
          </div>
        </section>
      )}

      <footer className="tmag-foot">
        <span className="tmag-foot-mark">drape</span>
        <span>{t('trendsPersonaNote')}</span>
      </footer>
    </div>
  );
}

export default Trends;
