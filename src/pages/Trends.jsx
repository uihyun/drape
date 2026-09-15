import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase.js';
import { useLocale } from '../hooks/useLocale.jsx';
import { COLOR_HEX } from '../services/taxonomy.js';

// One roll per page load — the masthead photo rotates between visits while
// staying stable during a single view (module scope, so re-renders reuse it).
const VISIT_SEED = Math.random();

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

  // Horizontal rows keep their scrollbar invisible until the row actually
  // moves (desktop browsers otherwise park a permanent grey bar under every
  // carousel). The track height is constant — only the thumb fades in — so
  // nothing shifts. Must stay above this component's early returns.
  useEffect(() => {
    if (!data) return undefined;
    const rows = Array.from(document.querySelectorAll('.tmag-scroll'));
    const timers = new Map();
    const onScroll = (e) => {
      const el = e.currentTarget;
      el.classList.add('is-scrolling');
      clearTimeout(timers.get(el));
      timers.set(el, setTimeout(() => el.classList.remove('is-scrolling'), 700));
    };
    rows.forEach((el) => el.addEventListener('scroll', onScroll, { passive: true }));
    return () => {
      rows.forEach((el) => el.removeEventListener('scroll', onScroll));
      timers.forEach((t) => clearTimeout(t));
    };
  }, [data]);

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
  const allLooks = data.looks || [];
  // The cover rotates through this week's looks on every visit — a masthead
  // that never moves reads as a dead page. An explicit admin pin (data.cover
  // with coverId set) wins; otherwise prefer a look whose style matches the
  // headline, falling back to the whole slate. The chosen one is pulled out
  // of the row below so the same photo never appears twice.
  const headlineKey = topStyle?.key;
  const coverPick = (() => {
    if (data.coverId && data.cover) return data.cover;   // admin pin wins
    if (!allLooks.length) return data.cover || null;
    // Rotate across ALL of this week's looks — style-matching the headline
    // sounded tidy but with one matching look it pinned the masthead to a
    // single photo. The hero carries its own style caption instead, so a
    // casual cover under a "Classic is rising" headline reads as a photo
    // credit, not a contradiction. VISIT_SEED is fixed per page load
    // (module scope) — stable during a view, different on the next visit.
    // No hook here on purpose: this sits below the page's early returns.
    return allLooks[Math.floor(VISIT_SEED * allLooks.length)];
  })();
  const looks = allLooks.filter((l) => l.id !== coverPick?.id);

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
            {coverPick?.style ? ` · ${label('styles', coverPick.style)}` : ''}
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
          <div className="tmag-looks tmag-scroll">
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
          <div className="tmag-palette tmag-scroll">
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
          <div className="tmag-strip tmag-scroll">
            {data.market.map((m) => (
              <Link to={`/i/${m.id}`} key={m.id} className="tmag-strip-item">
                <img src={m.img} alt="" loading="lazy" />
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Colophon — the publication cadence. Makes the weekly rotation read
          as an editorial rhythm (and gives a reason to come back Monday)
          instead of looking like content that randomly shuffled. */}
      {data.issueWeek && (
        <footer className="tmag-colophon">
          {t('trendsIssue', { date: issueDate(data.issueWeek, lang) })}
        </footer>
      )}
    </div>
  );
}

// "2026-09-14" → a short, localized issue date ("September 14" / "9월 14일").
function issueDate(weekKey, lang) {
  try {
    const [y, m, d] = weekKey.split('-').map(Number);
    return new Date(y, m - 1, d).toLocaleDateString(
      lang === 'ko' ? 'ko-KR' : lang === 'ja' ? 'ja-JP' : 'en-US',
      { month: 'long', day: 'numeric' },
    );
  } catch { return weekKey; }
}

export default Trends;
