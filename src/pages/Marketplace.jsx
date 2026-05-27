import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { MarketplaceService } from '../services/marketplace-service.js';
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

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    MarketplaceService.listRecent({ conditionGrade: grade || null, pageSize: 60 })
      .then(res => { if (!cancelled) { setListings(res.listings); setLoading(false); } })
      .catch(err => {
        if (cancelled) return;
        console.warn('marketplace list failed:', err.code, err.message);
        setError(err.message || String(err));
        setListings([]);
        setLoading(false);
      });
    return () => { cancelled = true; };
  }, [grade]);

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
        <div className="marketplace-grid">
          {listings.map(it => <ListingCard key={it.id} item={it} t={t} />)}
        </div>
      )}
    </div>
  );
}

function ListingCard({ item, t }) {
  const cover = item.croppedUrl || item.originalUrl;
  return (
    <Link to={`/i/${item.id}`} className="listing-card">
      <div className="listing-card-image">
        {cover
          ? <img src={cover} alt={item.name || ''} loading="lazy" />
          : <div className="listing-card-skeleton" />}
        {item.conditionGrade && (
          <span className="listing-card-grade">{item.conditionGrade}</span>
        )}
      </div>
      <div className="listing-card-meta">
        {item.tags?.brand && <span className="listing-card-brand">{item.tags.brand}</span>}
        <span className="listing-card-name">{item.name || t('untitledItem')}</span>
        <span className="listing-card-price">
          {t('salePriceCurrency')}{(item.priceAsking || 0).toLocaleString()}
          {item.priceOriginal > 0 && item.priceOriginal !== item.priceAsking && (
            <span className="listing-card-price-original">
              {t('salePriceCurrency')}{item.priceOriginal.toLocaleString()}
            </span>
          )}
        </span>
      </div>
    </Link>
  );
}

export default Marketplace;
