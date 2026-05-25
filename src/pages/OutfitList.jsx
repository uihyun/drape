import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase.js';
import { OutfitService } from '../services/outfit-service.js';
import { useLocale } from '../hooks/useLocale.jsx';

function formatCardDate(ts) {
  const d = ts?.toDate?.() || (ts instanceof Date ? ts : null);
  return d ? d.toLocaleDateString() : '';
}

export function OutfitList({ user, onSignIn, embedded = false }) {
  const { t } = useLocale();
  const [outfits, setOutfits] = useState(null);
  const [itemsById, setItemsById] = useState({});
  const [tab, setTab] = useState('mine'); // 'mine' | 'saved'

  useEffect(() => {
    if (!user || user.isAnonymous) { setOutfits([]); return; }
    setOutfits(null);
    OutfitService.listMyOutfits({
      uid: user.uid,
      kind: tab === 'saved' ? 'analyzed' : 'mine',
    })
      .then(({ outfits }) => setOutfits(outfits))
      .catch(() => setOutfits([]));
  }, [user, tab]);

  // Once we have outfits, batch-fetch every referenced item just once
  // (de-duped) so the cards can render a moodboard-style collage cover
  // instead of just one piece. Per-list reads = unique item count,
  // bounded by user's closet size.
  useEffect(() => {
    if (!outfits?.length) return;
    const allIds = new Set();
    for (const o of outfits) {
      for (const id of (o.itemIds || []).slice(0, 6)) allIds.add(id);
    }
    const missing = Array.from(allIds).filter(id => !itemsById[id]);
    if (missing.length === 0) return;
    Promise.all(missing.map(id => getDoc(doc(db, 'items', id))))
      .then(snaps => {
        const next = { ...itemsById };
        for (const s of snaps) {
          if (s.exists()) {
            const d = s.data();
            next[s.id] = d.croppedUrl || d.originalUrl || null;
          }
        }
        setItemsById(next);
      })
      .catch(() => {});
  }, [outfits]);

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

      <nav className="filter-chips filter-chips--text" role="tablist" style={{ marginBottom: '0.75rem' }}>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'mine'}
          className={`chip${tab === 'mine' ? ' active' : ''}`}
          onClick={() => setTab('mine')}
        >
          {t('outfitsMine')}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'saved'}
          className={`chip${tab === 'saved' ? ' active' : ''}`}
          onClick={() => setTab('saved')}
        >
          {t('outfitsSaved')}
        </button>
      </nav>

      {outfits === null ? (
        <div className="loading"><div className="spinner" /></div>
      ) : outfits.length === 0 ? (
        tab === 'saved' ? (
          <div className="empty-state empty-state-card">
            <p>{t('savedEmpty')}</p>
            <div className="empty-state-actions">
              <Link to="/analyze" className="btn btn-primary">
                <Plus size={14} strokeWidth={1.8} /> {t('analyzeAPhoto')}
              </Link>
              <Link to="/feed" className="btn btn-secondary">
                {t('browseFeed')}
              </Link>
            </div>
          </div>
        ) : (
          <div className="empty-state empty-state-card">
            <p>{t('noOutfitsYet')}</p>
            <Link to="/outfits/new" className="btn btn-primary">
              <Plus size={14} strokeWidth={1.8} /> {t('createOutfit')}
            </Link>
          </div>
        )
      ) : (
        <div className="outfit-grid">
          {outfits.map(o => (
            <Link key={o.id} to={`/o/${o.id}`} className="outfit-card">
              <OutfitCover outfit={o} itemsById={itemsById} t={t} />
              <div className="outfit-card-meta">
                <span className="card-meta-name">{o.name || t('untitledOutfit')}</span>
                <span className="card-meta-date">{formatCardDate(o.createdAt || o.updatedAt)}</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

// Card cover. If we have ≥ 2 of the outfit's items resolved, render a
// moodboard-style collage (overlapping cutouts on a soft gradient).
// Otherwise fall back to the single coverUrl / placeholder.
function OutfitCover({ outfit, itemsById, t }) {
  const thumbs = useMemo(() => {
    const ids = (outfit.itemIds || []).slice(0, 5);
    return ids.map(id => itemsById[id]).filter(Boolean);
  }, [outfit.itemIds, itemsById]);

  if (thumbs.length >= 2) {
    return (
      <div className="outfit-card-cover outfit-card-collage">
        {thumbs.map((url, idx) => {
          const total = thumbs.length;
          const pct = total === 1 ? 0.5 : idx / (total - 1);
          const x = 0.22 + pct * 0.56;
          const y = 0.34 + (idx % 2 === 0 ? -0.04 : 0.05) + Math.abs(pct - 0.5) * 0.16;
          const rot = (pct - 0.5) * 18;
          const scale = 0.6 - Math.abs(pct - 0.5) * 0.1;
          return (
            <img
              key={idx}
              src={url}
              alt=""
              loading="lazy"
              referrerPolicy="no-referrer"
              style={{
                left: `${x * 100}%`,
                top: `${y * 100}%`,
                transform: `translate(-50%, -50%) rotate(${rot}deg) scale(${scale})`,
                zIndex: idx + 1,
              }}
            />
          );
        })}
      </div>
    );
  }

  return (
    <div className="outfit-card-cover">
      {outfit.coverUrl
        ? <img src={outfit.coverUrl} alt={outfit.name || ''} loading="lazy" />
        : <div className="outfit-card-cover-empty">
            <span>{outfit.itemIds?.length || 0} {t('itemsShort')}</span>
          </div>}
    </div>
  );
}
