import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { MarketplaceService } from '../services/marketplace-service.js';
import { useInfiniteScroll } from '../hooks/useInfiniteScroll.js';
import { formatPrice } from '../utils/currency.js';
import { useLocale } from '../hooks/useLocale.jsx';

const GRADES = ['', 'S', 'A', 'B', 'C'];

// Marketplace surface: read-only grid of items where forSale==true.
// Sellers list directly from their item detail (toggle + price + grade);
// listings appear here in reverse-chronological order. v1 has condition
// filter only — adding city/price-range filters means denormalizing seller
// location onto the item doc, which we'll do once the marketplace has
// real volume.
export function Marketplace() {
  const { t } = useLocale();
  const [grade, setGrade] = useState('');
  const [listings, setListings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [cursor, setCursor] = useState(null);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    MarketplaceService.listRecent({ conditionGrade: grade || null, pageSize: 30 })
      .then(res => { if (!cancelled) { setListings(res.listings); setCursor(res.lastVisible); setHasMore(res.hasMore); setLoading(false); } })
      .catch(err => {
        if (cancelled) return;
        console.warn('marketplace list failed:', err.code, err.message);
        setError(err.message || String(err));
        setListings([]); setHasMore(false);
        setLoading(false);
      });
    return () => { cancelled = true; };
  }, [grade]);

  const loadMore = () => {
    if (loadingMore || !hasMore || !cursor) return;
    setLoadingMore(true);
    MarketplaceService.listRecent({ conditionGrade: grade || null, pageSize: 30, lastDoc: cursor })
      .then(res => {
        setListings(prev => [...(prev || []), ...res.listings]);
        setCursor(res.lastVisible); setHasMore(res.hasMore);
      })
      .catch(err => console.warn('marketplace loadMore failed:', err.message))
      .finally(() => setLoadingMore(false));
  };
  const sentinelRef = useInfiniteScroll({ hasMore, loading: loadingMore, onLoadMore: loadMore });

  const empty = !loading && (listings?.length ?? 0) === 0;
  const filters = useMemo(() => GRADES, []);

  return (
    <div className="marketplace">
      <header className="marketplace-head">
        <h1>{t('marketplaceTitle')}</h1>
        <p className="marketplace-sub">{t('marketplaceSubtitle')}</p>
      </header>
      <div className="marketplace-filters">
        {filters.map(g => (
          <button
            key={g || 'all'}
            type="button"
            className={`marketplace-filter${grade === g ? ' active' : ''}`}
            onClick={() => setGrade(g)}
          >
            {g ? t(`saleGrade_${g}`).split(' — ')[0] : t('marketplaceAll')}
          </button>
        ))}
      </div>
      {loading ? (
        <div className="loading"><div className="spinner" /></div>
      ) : error ? (
        <div className="empty-state"><p>{t('marketplaceError')}</p></div>
      ) : empty ? (
        <div className="empty-state"><p>{t('marketplaceEmpty')}</p></div>
      ) : (
        <>
          <div className="marketplace-grid">
            {listings.map(it => <ListingCard key={it.id} item={it} t={t} />)}
          </div>
          {hasMore && <div ref={sentinelRef} className="feed-sentinel">{loadingMore && <div className="spinner" />}</div>}
        </>
      )}
    </div>
  );
}

export function ListingCard({ item, t }) {
  const cover = item.croppedUrl || item.originalUrl;
  return (
    <Link to={`/i/${item.id}`} className="listing-card">
      <div className="listing-card-image">
        {cover
          ? <img src={cover} alt={item.name || ''} loading="lazy" />
          : <div className="listing-card-skeleton" />}
      </div>
      <div className="listing-card-meta">
        {item.tags?.brand && <span className="listing-card-brand">{item.tags.brand}</span>}
        <span className="listing-card-name">{item.name || t('untitledItem')}</span>
        <span className="listing-card-price">
          {formatPrice(item.priceAsking || 0, item.currency)}
          {item.priceOriginal > 0 && item.priceOriginal !== item.priceAsking && (
            <span className="listing-card-price-original">
              {formatPrice(item.priceOriginal, item.currency)}
            </span>
          )}
        </span>
      </div>
    </Link>
  );
}

export default Marketplace;
