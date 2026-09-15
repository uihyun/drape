import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase.js';
import { useLocale } from '../hooks/useLocale.jsx';
import { COLOR_HEX } from '../services/taxonomy.js';

// Trends as a weekly fashion issue, not a dashboard (owner, 2026-09-15:
// "절대 대시보드처럼 보이면 안 돼"). Editorial grammar borrowed from the
// brand itself — Bodoni italic display, letterspaced kickers, hairline
// rules, one inverted ink band, collage picks. Data contract unchanged:
// numbers from everyone, images only from public surfaces
// (functions/trends.js).
export function Trends() {
  const { t } = useLocale();
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

  const label = (ns, key) => t(`taxonomy.${ns}.${key}`) || key;
  // The headline must name a style that is actually RISING — the #1 row can
  // be falling (it was, on launch day: casual 53 this week vs 82 last).
  const styles = data.topStyles || [];
  const topStyle = styles.find((x) => x.trend === 'up' || x.trend === 'new') || styles[0];
  // Looks are editorially curated (admin picks the ids) — nothing
  // auto-promotes, so no volume gate is needed. Cover is its own pin.
  const looks = data.looks || [];
  const coverPick = data.cover || null;

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
          </p>
        </div>
      </header>

      {/* Styles — horizontal snap cards, serif numeral watermark. */}
      {data.topStyles?.length > 0 && (
        <section className="tmag-section">
          <p className="tmag-kicker">{t('trendsTopStyles')}</p>
          <ol className="tmag-rank">
            {data.topStyles.slice(0, 5).map((st, i) => (
              <li key={st.key}>
                <span className="tmag-rank-no">{String(i + 1).padStart(2, '0')}</span>
                <span className="tmag-rank-name">{label('styles', st.key)}</span>
                {st.trend === 'new' && <span className="tmag-flag">{t('trendsNew')}</span>}
                {st.trend === 'up' && <span className="tmag-flag">↑</span>}
                <span className="tmag-rank-count">
                  {data.basis === 'week'
                    ? t('trendsAddedThisWeek', { n: st.week })
                    : t('trendsInClosets', { n: st.total ?? st.count })}
                </span>
              </li>
            ))}
          </ol>
        </section>
      )}

      {/* This week's looks — curated outfit cards, horizontal by design
          (image browsing; the ranked sections stay vertical). */}
      {looks.length > 0 && (
        <section className="tmag-section">
          <p className="tmag-kicker">{t('trendsLooks')}</p>
          <div className="tmag-looks">
            {looks.map((o) => (
              <Link to={`/o/${o.id}`} key={o.id} className="tmag-look">
                <img src={o.img} alt="" loading="lazy" />
                {o.style && <span className="tmag-pill">{label('styles', o.style)}</span>}
              </Link>
            ))}
          </div>
          <p className="tmag-note">{t('trendsLooksNote')}</p>
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

      {/* Brands — what people actually own, folded by name. */}
      {data.topBrands?.length > 0 && (
        <section className="tmag-section">
          <p className="tmag-kicker">{t('trendsBrands')}</p>
          <ol className="tmag-brands">
            {data.topBrands.map((b, i) => (
              <li key={b.key}>
                <span className="tmag-brands-no">{String(i + 1).padStart(2, '0')}</span>
                <span className="tmag-brands-name">{b.key}</span>
                <span className="tmag-brands-count">{b.count}</span>
              </li>
            ))}
          </ol>
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

    </div>
  );
}

export default Trends;
