import { useEffect, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { SlidersHorizontal, X } from 'lucide-react';
import { ItemService } from '../services/item-service.js';
import { CATEGORIES, COLORS, SEASONS, STYLES, FITS } from '../services/taxonomy.js';
import { useLocale } from '../hooks/useLocale.jsx';
import { useSheetDrag } from '../hooks/useSheetDrag.js';
import { usePinchColumns } from '../hooks/usePinchColumns.js';
import { usageBucket, elapsedLabel } from '../utils/elapsed.js';
import { formatPrice } from '../utils/currency.js';

// Closet grid. Live subscription so a 'processing' item that finishes flips
// from skeleton to a finished card without a re-fetch.
const VIEWS = ['all', 'brands', 'usage'];

// Tag dimensions exposed in the detailed filter sheet. Each maps a tag
// field to its vocab + the locale namespace for chip labels. `multi`
// flags array-valued tags (an item can be summer AND spring) vs scalar.
const FILTER_DIMS = [
  { key: 'category', field: 'category', values: CATEGORIES, ns: 'categories', labelKey: 'tagCategory', multi: false },
  { key: 'colors',   field: 'colors',   values: COLORS,     ns: 'colors',     labelKey: 'tagColors',   multi: true },
  { key: 'seasons',  field: 'seasons',  values: SEASONS,    ns: 'seasons',    labelKey: 'tagSeasons',  multi: true },
  { key: 'styles',   field: 'styles',   values: STYLES,     ns: 'styles',     labelKey: 'tagStyles',   multi: true },
  { key: 'fits',     field: 'fit',      values: FITS,       ns: 'fits',       labelKey: 'tagFit',      multi: false },
];

function emptyFilters() {
  return { category: [], colors: [], seasons: [], styles: [], fits: [], forSale: [], kind: [] };
}
function countFilters(f) {
  return Object.values(f).reduce((n, arr) => n + arr.length, 0);
}

// An item passes if, for every dimension that has selections, its tag
// value intersects the selection. Across dimensions = AND; within a
// dimension = OR. Tag enums are language-agnostic, so selecting "summer"
// matches regardless of the user's locale (no cross-language text issue).
function matchesFilters(item, filters) {
  const tags = item.tags || {};
  for (const dim of FILTER_DIMS) {
    const sel = filters[dim.key];
    if (!sel?.length) continue;
    const v = tags[dim.field];
    const has = Array.isArray(v) ? v.some(x => sel.includes(x)) : sel.includes(v);
    if (!has) return false;
  }
  // For-sale is a boolean off the item (not a tag); selecting it keeps
  // only listed items.
  if (filters.forSale?.length && !item.forSale) return false;
  // Owned vs saved (analyze-detected reference). Items predating the field
  // are treated as owned (the default).
  if (filters.kind?.length) {
    const k = item.kind || 'owned';
    if (!filters.kind.includes(k)) return false;
  }
  return true;
}

export function Closet({ user, authReady, onSignIn, embedded = false }) {
  const { t } = useLocale();
  const { cols, ref: gridRef } = usePinchColumns('closet', { min: 1, max: 4, def: 3 });
  const [items, setItems] = useState(null);
  // Top-row view: All (grid) / Brands (alpha groups) / Usage (recency).
  const [view, setView] = useState('all');
  // Multi-facet tag filters (Set-like arrays per dimension). The All-view
  // category chip row and the detailed-filter sheet both write here.
  const [filters, setFilters] = useState(emptyFilters);
  const [sheetOpen, setSheetOpen] = useState(false);

  useEffect(() => {
    if (!authReady) return;
    if (!user) { setItems([]); return; }
    return ItemService.subscribeMyCloset(user.uid, setItems);
  }, [user, authReady]);

  const filterCount = countFilters(filters);

  const filtered = useMemo(() => {
    if (!items) return null;
    let live = items.filter(i => !i.isArchived);
    if (filterCount > 0) live = live.filter(i => matchesFilters(i, filters));
    return live;
  }, [items, filters, filterCount]);

  const toggleDim = (key, value) => {
    setFilters(prev => {
      const cur = prev[key] || [];
      const next = cur.includes(value) ? cur.filter(x => x !== value) : [...cur, value];
      return { ...prev, [key]: next };
    });
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
              onClick={() => setView(v)}
            >
              {t(`closetView.${v}`)}
            </button>
          ))}
        </nav>
        <button
          type="button"
          className={`closet-search-btn${filterCount > 0 ? ' has-filters' : ''}`}
          aria-label={t('detailedFilter')}
          onClick={() => setSheetOpen(true)}
        >
          <SlidersHorizontal size={18} strokeWidth={1.7} />
          {filterCount > 0 && <span className="closet-filter-badge">{filterCount}</span>}
        </button>
      </div>

      {/* All view: category chips as the representative quick filter
          (the old Categories tab folded into All). Multi-select; writes
          the same filters.category the detailed sheet uses. */}
      {view === 'all' && (
        <div className="closet-cat-row">
          <button
            type="button"
            className={`chip-pill${filters.category.length === 0 ? ' active' : ''}`}
            onClick={() => setFilters(prev => ({ ...prev, category: [] }))}
          >
            {t('filterAll')}
          </button>
          {CATEGORIES.map(c => (
            <button
              key={c}
              type="button"
              className={`chip-pill${filters.category.includes(c) ? ' active' : ''}`}
              onClick={() => toggleDim('category', c)}
            >
              {t(`taxonomy.categories.${c}`)}
            </button>
          ))}
          <span className="closet-cat-div" aria-hidden="true" />
          <button
            type="button"
            className={`chip-pill${filters.kind.includes('owned') ? ' active' : ''}`}
            onClick={() => toggleDim('kind', 'owned')}
          >
            {t('itemKindOwned')}
          </button>
          <button
            type="button"
            className={`chip-pill${filters.kind.includes('saved') ? ' active' : ''}`}
            onClick={() => toggleDim('kind', 'saved')}
          >
            {t('itemKindSaved')}
          </button>
        </div>
      )}

      {/* Active non-category filters from the sheet, shown as removable
          chips so the user always sees what's narrowing the grid. */}
      {filterCount - filters.category.length > 0 && (
        <div className="closet-active-filters">
          {FILTER_DIMS.filter(d => d.key !== 'category').flatMap(d =>
            (filters[d.key] || []).map(v => (
              <button
                key={`${d.key}-${v}`}
                type="button"
                className="closet-active-chip"
                onClick={() => toggleDim(d.key, v)}
              >
                {t(`taxonomy.${d.ns}.${v}`)}
                <X size={12} strokeWidth={2} />
              </button>
            ))
          )}
          {(filters.forSale || []).length > 0 && (
            <button
              type="button"
              className="closet-active-chip"
              onClick={() => toggleDim('forSale', 'yes')}
            >
              {t('filterForSale')}
              <X size={12} strokeWidth={2} />
            </button>
          )}
          <button
            type="button"
            className="closet-active-clear"
            onClick={() => setFilters(emptyFilters())}
          >
            {t('clear')}
          </button>
        </div>
      )}

      {sheetOpen && (
        <DetailFilterSheet
          filters={filters}
          onToggle={toggleDim}
          onClear={() => setFilters(emptyFilters())}
          onClose={() => setSheetOpen(false)}
          count={filterCount}
          resultCount={filtered?.length ?? 0}
          t={t}
        />
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
  // Pure alphabetical (case-insensitive). Unbranded always last.
  const sorted = [...map.values()].sort((a, b) =>
    a.label.localeCompare(b.label, undefined, { sensitivity: 'base' })
  );
  if (unbranded.length) sorted.push({ label: t('brandUnbranded'), items: unbranded });
  return sorted;
}

// Detailed filter sheet — every tag dimension as multi-select chips.
// Selecting tags filters by enum value (language-agnostic), sidestepping
// the cross-language text-search problem. Across dims = AND, within = OR.
function DetailFilterSheet({ filters, onToggle, onClear, onClose, count, resultCount, t }) {
  const { sheetStyle, handleProps } = useSheetDrag(onClose);
  return (
    <div className="create-sheet-overlay" onClick={onClose}>
      <div className="create-sheet detail-filter" style={sheetStyle} onClick={e => e.stopPropagation()} role="dialog" aria-modal="true">
        <div className="create-sheet-handle" {...handleProps} style={{ cursor: 'grab' }} />
        <button type="button" className="create-sheet-close" onClick={onClose} aria-label={t('close')}>
          <X size={18} />
        </button>
        <h3 className="create-sheet-title">{t('detailedFilter')}</h3>

        <div className="detail-filter-body">
          {FILTER_DIMS.map(dim => (
            <div key={dim.key} className="detail-filter-dim">
              <span className="detail-filter-dim-label">{t(dim.labelKey)}</span>
              <div className="detail-filter-chips">
                {dim.values.map(v => {
                  const on = (filters[dim.key] || []).includes(v);
                  return (
                    <button
                      key={v}
                      type="button"
                      className={`chip-pill${on ? ' active' : ''}`}
                      onClick={() => onToggle(dim.key, v)}
                    >
                      {t(`taxonomy.${dim.ns}.${v}`)}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
          {/* Marketplace status — boolean, not a tag dimension. */}
          <div className="detail-filter-dim">
            <span className="detail-filter-dim-label">{t('saleSection')}</span>
            <div className="detail-filter-chips">
              <button
                type="button"
                className={`chip-pill${(filters.forSale || []).length ? ' active' : ''}`}
                onClick={() => onToggle('forSale', 'yes')}
              >
                {t('filterForSale')}
              </button>
            </div>
          </div>
        </div>

        <div className="detail-filter-actions">
          <button type="button" className="btn btn-secondary" onClick={onClear} disabled={count === 0}>
            {t('clear')}
          </button>
          <button type="button" className="btn btn-primary" onClick={onClose}>
            {t('detailedFilterApply', { n: resultCount })}
          </button>
        </div>
      </div>
    </div>
  );
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
        {item.kind === 'saved' && (
          <span className="item-card-saved-badge">{t('itemKindSaved')}</span>
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
