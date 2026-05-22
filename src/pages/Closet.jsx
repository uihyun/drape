import { useEffect, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { ItemService } from '../services/item-service.js';
import { CATEGORIES } from '../services/taxonomy.js';
import { useLocale } from '../hooks/useLocale.jsx';

// Closet grid. Live subscription so a 'processing' item that finishes flips
// from skeleton to a finished card without a re-fetch.
export function Closet({ user, authReady, onSignIn, embedded = false }) {
  const { t } = useLocale();
  const [items, setItems] = useState(null);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    if (!authReady) return;
    if (!user) { setItems([]); return; }
    return ItemService.subscribeMyCloset(user.uid, setItems);
  }, [user, authReady]);

  const filtered = useMemo(() => {
    if (!items) return null;
    const live = items.filter(i => !i.isArchived);
    if (filter === 'all') return live;
    return live.filter(i => i?.tags?.category === filter);
  }, [items, filter]);

  if (!authReady) {
    return <div className="loading"><div className="spinner" /></div>;
  }

  if (!user || user.isAnonymous) {
    return (
      <div className="empty-state">
        <i className="material-icons">checkroom</i>
        <h2>{t('closetSignInTitle')}</h2>
        <p>{t('closetSignInBody')}</p>
        <button className="btn btn-primary" onClick={onSignIn}>
          <i className="material-icons">login</i>
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
            <i className="material-icons">add</i>
            {t('addItem')}
          </Link>
        </div>
      )}

      <div className="filter-chips" role="tablist">
        <button
          className={`chip ${filter === 'all' ? 'active' : ''}`}
          onClick={() => setFilter('all')}
        >
          {t('filterAll')}
        </button>
        {CATEGORIES.map(c => (
          <button
            key={c}
            className={`chip ${filter === c ? 'active' : ''}`}
            onClick={() => setFilter(c)}
          >
            {t(`taxonomy.categories.${c}`)}
          </button>
        ))}
      </div>

      {filtered === null ? (
        <div className="loading"><div className="spinner" /></div>
      ) : filtered.length === 0 ? (
        <div className="empty-state">
          <i className="material-icons">checkroom</i>
          <p>{t('closetEmpty')}</p>
          <Link to="/closet/add" className="btn btn-primary">
            <i className="material-icons">add</i>
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
        {item.tags?.colors?.[0] && (
          <span className="item-card-color">{t(`taxonomy.colors.${item.tags.colors[0]}`)}</span>
        )}
      </div>
    </Link>
  );
}
