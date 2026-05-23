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
        (i.tags?.brand || '').toLowerCase().includes(q)
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
          {VIEWS.map(v => {
            const disabled = v === 'usage' || v === 'brands';
            return (
              <button
                key={v}
                type="button"
                role="tab"
                aria-selected={view === v}
                className={`chip${view === v ? ' active' : ''}${disabled ? ' chip-soon' : ''}`}
                onClick={() => !disabled && onViewChange(v)}
                disabled={disabled}
                title={disabled ? t('comingSoon') : undefined}
              >
                {t(`closetView.${v}`)}
              </button>
            );
          })}
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
      ) : (
        <div className="closet-grid">
          {filtered.map(item => <ItemCard key={item.id} item={item} t={t} />)}
        </div>
      )}
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
