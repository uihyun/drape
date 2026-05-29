import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Sparkles, Search, X } from 'lucide-react';
import { GenerationService } from '../services/generation-service.js';
import { ItemService } from '../services/item-service.js';
import { STYLES } from '../services/taxonomy.js';
import { useLocale } from '../hooks/useLocale.jsx';

export function TryOnHistory({ user, onSignIn, embedded = false }) {
  const { t } = useLocale();
  const [gens, setGens] = useState(null);
  const [closet, setCloset] = useState({});
  const [search, setSearch] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [filterLiked, setFilterLiked] = useState(false);
  const [filterStyle, setFilterStyle] = useState(null);
  const [compOpen, setCompOpen] = useState(false);
  const searchRef = useRef(null);

  useEffect(() => {
    if (!user || user.isAnonymous) { setGens([]); return; }
    return GenerationService.subscribeMyGenerations(user.uid, setGens, { pageSize: 60 });
  }, [user]);

  // Closet (keyed by id) lets the search match a try-on by the tags of the
  // items it used — category / colors / styles / brand — same vocabulary as
  // the closet's own tag search. No titles anymore; tags + style are how you
  // find a look.
  useEffect(() => {
    if (!user || user.isAnonymous) { setCloset({}); return; }
    return ItemService.subscribeMyCloset(user.uid, list =>
      setCloset(Object.fromEntries(list.map(i => [i.id, i]))));
  }, [user?.uid]);

  // Build the searchable tag text for one generation: its style/composition
  // labels (en + localized) + every linked item's tags.
  const tagTextFor = (g) => {
    const parts = [];
    for (const c of (g.composition || [])) {
      if (c.label) { parts.push(c.label, t(`taxonomy.styles.${c.label}`)); }
    }
    for (const id of (g.itemIds || [])) {
      const it = closet[id];
      if (!it) continue;
      const tg = it.tags || {};
      if (it.name) parts.push(it.name);
      if (tg.category) { parts.push(tg.category, t(`taxonomy.categories.${tg.category}`)); }
      if (tg.brand) parts.push(tg.brand);
      for (const col of (tg.colors || [])) parts.push(col, t(`taxonomy.colors.${col}`));
      for (const st of (tg.styles || [])) parts.push(st, t(`taxonomy.styles.${st}`));
    }
    return parts.join(' ').toLowerCase();
  };

  const visible = useMemo(() => {
    if (!gens) return null;
    let list = gens;
    const q = search.trim().toLowerCase();
    if (q) list = list.filter(g => tagTextFor(g).includes(q));
    if (filterLiked) list = list.filter(g => g.liked);
    if (filterStyle) {
      list = list.filter(g =>
        Array.isArray(g.composition) &&
        g.composition.some(c => c.label === filterStyle && (c.level || 0) >= 1),
      );
    }
    return list;
  }, [gens, closet, search, filterLiked, filterStyle]);

  const toggleSearch = () => {
    if (showSearch) {
      setSearch('');
      setShowSearch(false);
    } else {
      setShowSearch(true);
      setTimeout(() => searchRef.current?.focus(), 50);
    }
  };

  if (!user || user.isAnonymous) {
    return (
      <div className={embedded ? '' : 'page'}>
        {!embedded && <h1 className="page-h1">{t('tryOnHistory')}</h1>}
        <div className="empty-state empty-state-card">
          <p>{t('tryOnSignInTitle')}</p>
          <button className="btn btn-primary" onClick={onSignIn}>{t('signIn')}</button>
        </div>
      </div>
    );
  }

  return (
    <div className={embedded ? '' : 'page'}>
      {!embedded && (
        <div className="closet-header">
          <h1 className="page-h1" style={{ margin: 0 }}>{t('tryOnHistory')}</h1>
          <Link to="/tryon" className="btn btn-primary">
            <Sparkles size={14} strokeWidth={1.8} /> {t('newTryOn')}
          </Link>
        </div>
      )}

      {gens && gens.length > 0 && (
        <>
          {showSearch && (
            <div className="closet-search-bar tryon-search-bar">
              <Search size={16} strokeWidth={1.6} />
              <input
                ref={searchRef}
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder={t('tryOnSearchPlaceholder')}
                className="closet-search-input"
              />
              {search && (
                <button type="button" className="icon-btn" onClick={() => setSearch('')} aria-label={t('clear')}>
                  <X size={16} strokeWidth={1.7} />
                </button>
              )}
            </div>
          )}
          <div className="filter-chips filter-chips--text tryon-filter-chips" style={{ alignItems: 'center' }}>
            <button
              type="button"
              className={`chip${filterLiked ? ' active' : ''}`}
              onClick={() => setFilterLiked(f => !f)}
            >
              {t('filterLiked')}
            </button>
            <button
              type="button"
              className={`chip${(compOpen || filterStyle) ? ' active' : ''}`}
              onClick={() => setCompOpen(o => !o)}
            >
              {t('filterComposition')} {compOpen ? '▴' : '▾'}
            </button>
            <button
              type="button"
              className={`closet-search-btn${(showSearch || search) ? ' has-filters' : ''}`}
              style={{ marginLeft: 'auto', flexShrink: 0 }}
              aria-label={t('search')}
              onClick={toggleSearch}
            >
              {(showSearch || search)
                ? <X size={18} strokeWidth={1.7} />
                : <Search size={18} strokeWidth={1.7} />}
            </button>
          </div>
          {compOpen && (
            <div className="filter-chips filter-chips--text tryon-filter-chips tryon-style-chips">
              {STYLES.map(s => (
                <button
                  key={s}
                  type="button"
                  className={`chip${filterStyle === s ? ' active' : ''}`}
                  onClick={() => setFilterStyle(f => f === s ? null : s)}
                >
                  {t(`taxonomy.styles.${s}`)}
                </button>
              ))}
            </div>
          )}
        </>
      )}

      {visible === null ? (
        <div className="loading"><div className="spinner" /></div>
      ) : gens.length === 0 ? (
        <div className="empty-state empty-state-card">
          <p>{t('tryOnHistoryEmpty')}</p>
          <Link to="/tryon" className="btn btn-primary">
            <Sparkles size={14} strokeWidth={1.8} /> {t('newTryOn')}
          </Link>
        </div>
      ) : visible.length === 0 ? (
        <div className="empty-state empty-state-card">
          <p>{t('tryOnSearchEmpty')}</p>
        </div>
      ) : (
        <div className="tryon-history-grid">
          {visible.map(g => {
            const cover = (g.variantUrls || [])[0];
            const status = g.status || 'unknown';
            return (
              <Link key={g.id} to={`/tryon/${g.id}`} className="tryon-history-card">
                <div className="tryon-history-cover">
                  {cover
                    ? <img src={cover} alt="" loading="lazy" referrerPolicy="no-referrer" />
                    : <div className={`tryon-history-empty status-${status}`}>{t(`tryOnStatus.${status}`) || status}</div>}
                </div>
                <div className="tryon-history-meta">
                  <span className="tryon-history-date">
                    {g.createdAt?.toDate?.()?.toLocaleDateString?.() || ''}
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default TryOnHistory;
