import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { OutfitService } from '../services/outfit-service.js';
import { useLocale } from '../hooks/useLocale.jsx';

export function OutfitList({ user, onSignIn, embedded = false }) {
  const { t } = useLocale();
  const [outfits, setOutfits] = useState(null);

  useEffect(() => {
    if (!user || user.isAnonymous) { setOutfits([]); return; }
    OutfitService.listMyOutfits({ uid: user.uid })
      .then(({ outfits }) => setOutfits(outfits))
      .catch(() => setOutfits([]));
  }, [user]);

  if (!user || user.isAnonymous) {
    return (
      <div className="empty-state">
        <h2>{t('outfitSignInTitle')}</h2>
        <button className="btn btn-primary" onClick={onSignIn}>{t('signInGoogle')}</button>
      </div>
    );
  }

  return (
    <div className={`outfit-list${embedded ? ' outfit-list-embedded' : ''}`}>
      {!embedded && (
        <div className="closet-header">
          <h2 className="section-title">{t('navOutfits')}</h2>
          <Link to="/outfits/new" className="btn btn-primary">
            <Plus size={14} strokeWidth={1.8} /> {t('newOutfit')}
          </Link>
        </div>
      )}

      {outfits === null ? (
        <div className="loading"><div className="spinner" /></div>
      ) : outfits.length === 0 ? (
        <div className="empty-state empty-state-card">
          <p>{t('noOutfitsYet')}</p>
          <Link to="/outfits/new" className="btn btn-primary">
            <Plus size={14} strokeWidth={1.8} /> {t('createOutfit')}
          </Link>
        </div>
      ) : (
        <div className="outfit-grid">
          {outfits.map(o => (
            <Link key={o.id} to={`/o/${o.id}`} className="outfit-card">
              <div className="outfit-card-cover">
                {o.coverUrl
                  ? <img src={o.coverUrl} alt={o.name || ''} loading="lazy" />
                  : <div className="outfit-card-cover-empty">
                      <span>{o.itemIds?.length || 0} {t('itemsShort')}</span>
                    </div>}
              </div>
              <div className="outfit-card-meta">
                <span>{o.name || t('untitledOutfit')}</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
