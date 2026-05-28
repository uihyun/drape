import { useEffect, useState, useMemo, useRef } from 'react';
import { Link } from 'react-router-dom';
import { Search, X } from 'lucide-react';
import { ItemService } from '../services/item-service.js';
import { CATEGORIES } from '../services/taxonomy.js';
import { useLocale } from '../hooks/useLocale.jsx';
import { usePinchColumns } from '../hooks/usePinchColumns.js';
import { usageBucket, elapsedLabel } from '../utils/elapsed.js';
import { formatPrice } from '../utils/currency.js';

// Closet grid. Live subscription so a 'processing' item that finishes flips
// from skeleton to a finished card without a re-fetch.
const VIEWS = ['all', 'categories', 'brands', 'usage'];

// Facet views map to a tag dimension + its vocab. Picking a view reveals
// a chip row of that dimension's values; selecting one filters the grid.
// Seasons/styles/colors/fit are intentionally NOT tabs — six tabs
// overflowed the row. They're reachable via search (which matches every
// localized tag label), and a dedicated multi-facet filter sheet is the
// planned home for them.
const FACETS = {
  categories: { field: 'category', values: CATEGORIES, label: 'categories', multi: false },
};

// Build one lowercase haystack per item covering name, brand, and every
// tag dimension in BOTH the raw enum token and its localized label — so
// "여름"/"summer", "navy", "미니멀"/"minimal" all hit. t() resolves the
// active locale, so a Korean user searching "겨울" matches season:winter.
function searchableText(item, t) {
  const tags = item.tags || {};
  const parts = [item.name || '', tags.brand || ''];
  const push = (dim, val) => {
    if (!val) return;
    parts.push(val);
    const label = t(`taxonomy.${dim}.${val}`);
    if (label && label !== `taxonomy.${dim}.${val}`) parts.push(label);
  };
  push('categories', tags.category);
  push('fits', tags.fit);
  (Array.isArray(tags.colors) ? tags.colors : []).forEach(c => push('colors', c));
  (Array.isArray(tags.seasons) ? tags.seasons : []).forEach(s => push('seasons', s));
  (Array.isArray(tags.styles) ? tags.styles : []).forEach(s => push('styles', s));
  if (Array.isArray(item.wearLog)) item.wearLog.forEach(e => e.date && parts.push(e.date));
  return parts.join(' ').toLowerCase();
}

// Does an item match the active facet selection? Single-value dims
// (category) check equality; array dims (seasons/styles) check inclusion.
function matchesFacet(item, view, value) {
  const facet = FACETS[view];
  if (!facet || !value) return true;
  const tagVal = item?.tags?.[facet.field];
  return Array.isArray(tagVal) ? tagVal.includes(value) : tagVal === value;
}

export function Closet({ user, authReady, onSignIn, embedded = false }) {
  const { t } = useLocale();
  const { cols, ref: gridRef } = usePinchColumns('closet', { min: 1, max: 4, def: 3 });
  const [items, setItems] = useState(null);
  // Top-row view (Lekondo: All / Usage / Brands / Categories). Picking
  // "categories" reveals a second row of category chips that drive the
  // actual filter; otherwise filter stays 'all'.
  const [view, setView] = useState('all');
  // One active facet value at a time (per the current single-view model).
  // Keyed by view so switching facet tabs resets cleanly.
  const [facetValue, setFacetValue] = useState(null);
  const [search, setSearch] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const searchInputRef = useRef(null);

  useEffect(() => {
    if (!authReady) return;
    if (!user) { setItems([]); return; }
    return ItemService.subscribeMyCloset(user.uid, setItems);
  }, [user, authReady]);

  useEffect(() => {
    if (searchOpen) searchInputRef.current?.focus();
  }, [searchOpen]);

  const filtered = useMemo(() => {
    if (!items) return null;
    let live = items.filter(i => !i.isArchived);
    if (FACETS[view] && facetValue) {
      live = live.filter(i => matchesFacet(i, view, facetValue));
    }
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      live = live.filter(i => searchableText(i, t).includes(q));
    }
    return live;
  }, [items, view, facetValue, search, t]);

  const onViewChange = (v) => {
    setView(v);
    setFacetValue(null); // each facet view starts unfiltered
  };

  if (!authReady) {
    return <div className="loading"><div className="spinner" /></div>;
  }

  if (!user || user.isAnonymous) {
    return (
      <div className="empty-state">
        <h2>{t('closetSignInTitle')}</h2>
        <p>{t('closetSignInBody')}</p>
        <button className="btn btn-primary" onClick={onSignIn}>
          {t('signIn')}
        </button>
      </div>
    );
  }

  return (
    <div className={`closet${embedded ? ' closet-embedded' : ''}`}>
      {!embedded && (
        <div className="closet-header">
          <h2 className="section-title">{t('navCloset')}</h2>
          <Link to="/closet/add" className="btn btn-primary closet-add-btn">
            {t('addItem')}
          </Link>
        </div>
      )}

      <div className="closet-filter-row">
        <nav className="filter-chips filter-chips--text" role="tablist">
          {VIEWS.map(v => (
            <button
              key={v}
              type="button"
              role="tab"
              aria-selected={view === v}
              className={`chip${view === v ? ' active' : ''}`}
              onClick={() => onViewChange(v)}
            >
              {t(`closetView.${v}`)}
            </button>
          ))}
        </nav>
        <button
          type="button"
          className="closet-search-btn"
          aria-label={t('search')}
          onClick={() => setSearchOpen(o => !o)}
        >
          {searchOpen ? <X size={18} strokeWidth={1.7} /> : <Search size={18} strokeWidth={1.7} />}
        </button>
      </div>

      {searchOpen && (
        <div className="closet-search-bar">
          <Search size={16} strokeWidth={1.6} />
          <input
            ref={searchInputRef}
            type="search"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={t('searchPlaceholder')}
            className="closet-search-input"
          />
          {search && (
            <button type="button" className="icon-btn" onClick={() => setSearch('')} aria-label={t('clear')}>
              <X size={16} strokeWidth={1.7} />
            </button>
          )}
        </div>
      )}

      {FACETS[view] && (
        <div className="closet-cat-row">
          <button
            type="button"
            className={`chip-pill${!facetValue ? ' active' : ''}`}
            onClick={() => setFacetValue(null)}
          >
            {t('filterAll')}
          </button>
          {FACETS[view].values.map(v => (
            <button
              key={v}
              type="button"
              className={`chip-pill${facetValue === v ? ' active' : ''}`}
              onClick={() => setFacetValue(facetValue === v ? null : v)}
            >
              {t(`taxonomy.${FACETS[view].label}.${v}`)}
            </button>
          ))}
        </div>
      )}

      {filtered === null ? (
        <div className="loading"><div className="spinner" /></div>
      ) : filtered.length === 0 ? (
        <div className="empty-state">
          <p>{t('closetEmpty')}</p>
          <Link to="/closet/add" className="btn btn-primary">
            {t('addFirstItem')}
          </Link>
        </div>
      ) : view === 'usage' ? (
        <GroupedList groups={groupByUsage(filtered, t)} cols={cols} t={t} showElapsed />
      ) : view === 'brands' ? (
        <GroupedList groups={groupByBrand(filtered, t)} cols={cols} t={t} />
      ) : (
        <div
          ref={gridRef}
          className="closet-grid pinch-grid"
          style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
        >
          {filtered.map(item => <ItemCard key={item.id} item={item} t={t} />)}
        </div>
      )}
    </div>
  );
}

// Group by how recently each piece was last worn. The "dormant" bucket
// (6+ months) is what the marketplace will surface as listing candidates
// — items the user clearly isn't reaching for anymore.
function groupByUsage(items, t) {
  const buckets = new Map();
  for (const it of items) {
    const b = usageBucket(it.lastWornAt);
    if (!buckets.has(b.key)) buckets.set(b.key, { ...b, items: [] });
    buckets.get(b.key).items.push(it);
  }
  // Sort within each bucket: most recent first for worn buckets; alpha for never.
  for (const g of buckets.values()) {
    g.items.sort((a, b) => (b.lastWornAt || '').localeCompare(a.lastWornAt || ''));
  }
  return [...buckets.values()]
    .sort((a, b) => a.order - b.order)
    .map(g => ({ label: t(`usage${g.key.charAt(0).toUpperCase()}${g.key.slice(1)}`), items: g.items, key: g.key }));
}

// Group by brand (case-insensitive key, original casing for the label).
// Items without a brand land in a single "Unbranded" section at the end so
// they remain visible — easier for the user to spot ones worth labelling.
function groupByBrand(items, t) {
  const map = new Map();
  let unbranded = [];
  for (const it of items) {
    const raw = (it.tags?.brand || '').trim();
    if (!raw) { unbranded.push(it); continue; }
    const key = raw.toLowerCase();
    if (!map.has(key)) map.set(key, { label: raw, items: [] });
    map.get(key).items.push(it);
  }
  const sorted = [...map.values()].sort((a, b) =>
    b.items.length - a.items.length || a.label.localeCompare(b.label)
  );
  if (unbranded.length) sorted.push({ label: t('brandUnbranded'), items: unbranded });
  return sorted;
}

function GroupedList({ groups, cols, t, showElapsed = false }) {
  return (
    <div className="closet-groups">
      {groups.map((g, i) => (
        <section
          key={i}
          className={`closet-group${g.key === 'dormant' ? ' closet-group-dormant' : ''}`}
        >
          <header className="closet-group-head">
            <h3>{g.label}</h3>
            <span className="closet-group-count">{g.items.length}</span>
          </header>
          <div
            className="closet-grid"
            style={cols ? { gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` } : undefined}
          >
            {g.items.map(item => (
              <ItemCard
                key={item.id}
                item={item}
                t={t}
                elapsed={showElapsed ? elapsedLabel(item.lastWornAt, t) : null}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function ItemCard({ item, t, elapsed = null }) {
  const processing = item.status === 'processing' || item.status === 'uploading';
  const failed = item.status === 'failed';
  const cover = item.croppedUrl || item.originalUrl;
  return (
    <Link to={`/i/${item.id}`} className={`item-card ${processing ? 'processing' : ''}`}>
      <div className="item-card-image">
        {cover
          ? <img src={cover} alt={item.name || ''} loading="lazy" />
          : <div className="item-card-skeleton" />}
        {processing && (
          <span className="item-card-badge">
            <span className="dot-pulse" /> {t('processing')}
          </span>
        )}
        {failed && (
          <span className="item-card-badge item-card-badge-error">
            {t('processFailed')}
          </span>
        )}
        {item.forSale && item.priceAsking > 0 && (
          <span className="item-card-sale">
            {formatPrice(item.priceAsking, item.currency)}
          </span>
        )}
      </div>
      <div className="item-card-meta">
        {item.tags?.category && (
          <span className="item-card-cat">{t(`taxonomy.categories.${item.tags.category}`)}</span>
        )}
        {item.name && (
          <span className="item-card-name">{item.name}</span>
        )}
        {elapsed && (
          <span className="item-card-elapsed">{elapsed}</span>
        )}
      </div>
    </Link>
  );
}
