import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase.js';
import { useLocale } from '../hooks/useLocale.jsx';
import { COLOR_HEX } from '../services/taxonomy.js';
import { STYLIST_PERSONAS } from '../services/stylist-service.js';
import { cityDisplay } from '../data/cities.js';

// The feed's stand-in while the community is small (owner call 2026-09-15):
// a ranking board built from what people actually DO in drape. Aggregate
// numbers come from everyone's closets; images only from public surfaces
// (public looks + marketplace) — the privacy contract lives in
// functions/trends.js, this page just renders trends/current.
export function Trends() {
  const { t } = useLocale();
  const [data, setData] = useState(undefined); // undefined=loading, null=missing

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
  const maxStyle = Math.max(1, ...(data.topStyles || []).map((s) => s.count));
  const label = (ns, key) => t(`taxonomy.${ns}.${key}`) || key;

  return (
    <div className="page trends-page">
      <h1 className="page-h1">{t('trendsTitle')}</h1>
      <p className="muted trends-sub">{t('trendsSub', {
        items: data.stats?.itemsThisWeek ?? 0,
        tryons: data.stats?.tryonsThisWeek ?? 0,
      })}</p>

      {/* Styles leaderboard, each row fronted by its stylist persona. */}
      {data.topStyles?.length > 0 && (
        <section className="trends-card">
          <h3>{t('trendsTopStyles')}</h3>
          {data.topStyles.map((s) => {
            const p = personaOf(s.persona);
            return (
              <div className="trends-stylerow" key={s.key}>
                <img src={p.img} alt={p.name} className="trends-persona" title={`${p.name} · AI`} />
                <span className="trends-stylename">{label('styles', s.key)}</span>
                <div className="trends-bar"><span style={{ width: `${Math.round((s.count / maxStyle) * 100)}%` }} /></div>
                <span className="trends-count">{s.count}</span>
              </div>
            );
          })}
          <p className="trends-note">{t('trendsPersonaNote')}</p>
        </section>
      )}

      {/* Color + category pulse of everyone's closets (numbers only). */}
      {data.topColors?.length > 0 && (
        <section className="trends-card">
          <h3>{t('trendsTopColors')}</h3>
          <div className="trends-colors">
            {data.topColors.map((c) => (
              <span className="trends-color" key={c.key}>
                <i style={{ background: COLOR_HEX[c.key] || '#ccc' }} />
                {label('colors', c.key)} <em>{c.count}</em>
              </span>
            ))}
          </div>
        </section>
      )}
      {data.triedOnCategories?.length > 0 && (
        <section className="trends-card">
          <h3>{t('trendsTriedOn')}</h3>
          <div className="trends-colors">
            {data.triedOnCategories.map((c) => (
              <span className="trends-color" key={c.key}>
                {label('categories', c.key)} <em>{c.count}</em>
              </span>
            ))}
          </div>
        </section>
      )}

      {/* Community picks — curated FROM looks people chose to make public. */}
      {data.picks?.length > 0 && (
        <section className="trends-card">
          <h3>{t('trendsCommunityPicks')}</h3>
          <p className="trends-note">{t('trendsCuratedNote')}</p>
          <div className="trends-grid">
            {data.picks.map((o) => (
              <Link to={`/o/${o.id}`} key={o.id} className="trends-pick">
                <img src={o.img} alt="" loading="lazy" />
                {o.style && <span className="trends-pick-tag">{label('styles', o.style)}</span>}
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Marketplace pulse — listings are public by definition. */}
      {data.market?.length > 0 && (
        <section className="trends-card">
          <h3>{t('trendsMarket')}</h3>
          <div className="trends-strip">
            {data.market.map((m) => (
              <Link to={`/i/${m.id}`} key={m.id} className="trends-strip-item">
                <img src={m.img} alt="" loading="lazy" />
              </Link>
            ))}
          </div>
        </section>
      )}

      {data.regions?.length > 0 && (
        <section className="trends-card">
          <h3>{t('trendsRegions')}</h3>
          <div className="trends-colors">
            {data.regions.map((r) => (
              <span className="trends-color" key={r.key}>{cityDisplay(r.key) || r.key} <em>{r.count}</em></span>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

export default Trends;
