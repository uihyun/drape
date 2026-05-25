import { useEffect, useState, useMemo, useRef } from 'react';
import { Link } from 'react-router-dom';
import { Search, X } from 'lucide-react';
import { ItemService } from '../services/item-service.js';
import { CATEGORIES } from '../services/taxonomy.js';
import { useLocale } from '../hooks/useLocale.jsx';

// Closet grid. Live subscription so a 'processing' item that finishes flips
// from skeleton to a finished card without a re-fetch.
const VIEWS = ['all', 'usage', 'brands', 'categories'];

export function Closet({ user, authReady, onSignIn, embedded = false }) {
  const { t } = useLocale();
  const [items, setItems] = useState(null);
  // Top-row view (Lekondo: All / Usage / Brands / Categories). Picking
  // "categories" reveals a second row of category chips that drive the
  // actual filter; otherwise filter stays 'all'.
  const [view, setView] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState(null);
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
    if (view === 'categories' && categoryFilter) {
      live = live.filter(i => i?.tags?.category === categoryFilter);
    }
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      live = live.filter(i =>
        (i.name || '').toLowerCase().includes(q) ||
        (i.tags?.category || '').toLowerCase().includes(q) ||
        (i.tags?.brand || '').toLowerCase().includes(q) ||
        // Wear log dates ("2026-05" matches anything worn in May 2026)
        (Array.isArray(i.wearLog) && i.wearLog.some(e => e.date?.includes(q)))
      );
    }
    return live;
  }, [items, view, categoryFilter, search]);

  const onViewChange = (v) => {
    setView(v);
    if (v !== 'categories') setCategoryFilter(null);
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
          {t('signInGoogle')}
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

      {view === 'categories' && (
        <div className="closet-cat-row">
          <button
            type="button"
            className={`chip-pill${!categoryFilter ? ' active' : ''}`}
            onClick={() => setCategoryFilter(null)}
          >
            {t('filterAll')}
          </button>
          {CATEGORIES.map(c => (
            <button
              key={c}
              type="button"
              className={`chip-pill${categoryFilter === c ? ' active' : ''}`}
              onClick={() => setCategoryFilter(c)}
            >
              {t(`taxonomy.categories.${c}`)}
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
        <GroupedList groups={groupByUsage(filtered, t)} t={t} />
      ) : view === 'brands' ? (
        <GroupedList groups={groupByBrand(filtered, t)} t={t} />
      ) : (
        <div className="closet-grid">
          {filtered.map(item => <ItemCard key={item.id} item={item} t={t} />)}
        </div>
      )}
    </div>
  );
}

// Group items by wear frequency. Section labels are static buckets so the
// view stays useful even when very few items have wear logs yet.
function groupByUsage(items, t) {
  const buckets = {
    often: { label: t('usageOften'), items: [] },     // wornCount >= 3
    sometimes: { label: t('usageSometimes'), items: [] }, // 1-2
    never: { label: t('usageNever'), items: [] },     // 0
  };
  for (const it of items) {
    const n = it.wornCount || 0;
    if (n >= 3) buckets.often.items.push(it);
    else if (n >= 1) buckets.sometimes.items.push(it);
    else buckets.never.items.push(it);
  }
  // Most-worn first within each bucket so the heavy hitters lead the row.
  for (const k of Object.keys(buckets)) {
    buckets[k].items.sort((a, b) => (b.wornCount || 0) - (a.wornCount || 0));
  }
  return Object.values(buckets).filter(g => g.items.length > 0);
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

function GroupedList({ groups, t }) {
  return (
    <div className="closet-groups">
      {groups.map((g, i) => (
        <section key={i} className="closet-group">
          <header className="closet-group-head">
            <h3>{g.label}</h3>
            <span className="closet-group-count">{g.items.length}</span>
          </header>
          <div className="closet-grid">
            {g.items.map(item => <ItemCard key={item.id} item={item} t={t} />)}
          </div>
        </section>
      ))}
    </div>
  );
}

function ItemCard({ item, t }) {
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
      </div>
      <div className="item-card-meta">
        {item.tags?.category && (
          <span className="item-card-cat">{t(`taxonomy.categories.${item.tags.category}`)}</span>
        )}
        {item.name && (
          <span className="item-card-name">{item.name}</span>
        )}
      </div>
    </Link>
  );
}
