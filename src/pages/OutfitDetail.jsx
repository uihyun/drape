import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { doc, getDoc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase.js';
import { OutfitService } from '../services/outfit-service.js';
import { Comments } from '../components/Comments.jsx';
import { useLocale } from '../hooks/useLocale.jsx';

export function OutfitDetail({ user, onSignIn }) {
  const { t } = useLocale();
  const { outfitId } = useParams();
  const navigate = useNavigate();
  const [outfit, setOutfit] = useState(null);
  const [items, setItems] = useState([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!outfitId) return;
    return onSnapshot(doc(db, 'outfits', outfitId), snap => {
      setOutfit(snap.exists() ? { id: snap.id, ...snap.data() } : null);
    });
  }, [outfitId]);

  useEffect(() => {
    if (!outfit?.itemIds?.length) { setItems([]); return; }
    let cancelled = false;
    Promise.all(outfit.itemIds.map(id => getDoc(doc(db, 'items', id))))
      .then(snaps => {
        if (cancelled) return;
        setItems(snaps.filter(s => s.exists()).map(s => ({ id: s.id, ...s.data() })));
      });
    return () => { cancelled = true; };
  }, [outfit?.itemIds]);

  if (!outfit) return <div className="loading"><div className="spinner" /></div>;
  const isOwner = user && outfit.userId === user.uid;

  const togglePublish = async () => {
    setBusy(true);
    try {
      await OutfitService.updateOutfit(outfit.id, { isListed: !outfit.isListed, isPublic: true });
    } finally { setBusy(false); }
  };

  const remove = async () => {
    if (!confirm(t('confirmDeleteOutfit'))) return;
    await OutfitService.deleteOutfit(outfit.id);
    navigate('/outfits');
  };

  return (
    <div className="outfit-detail">
      <h2>{outfit.name || t('untitledOutfit')}</h2>

      {outfit.coverUrl && (
        <div className="outfit-cover-large">
          <img src={outfit.coverUrl} alt="" />
        </div>
      )}

      <div className="outfit-items-strip">
        {items.map(it => (
          <Link key={it.id} to={`/i/${it.id}`} className="outfit-item-thumb">
            {it.croppedUrl || it.originalUrl
              ? <img src={it.croppedUrl || it.originalUrl} alt="" loading="lazy" />
              : <div className="item-card-skeleton" />}
          </Link>
        ))}
      </div>

      <div className="controls">
        <Link to={`/tryon?items=${outfit.itemIds.join(',')}`} className="btn btn-primary">
          <i className="material-icons">face_retouching_natural</i>
          {t('tryThisOn')}
        </Link>
        {isOwner && (
          <>
            <button className="btn btn-secondary" onClick={togglePublish} disabled={busy}>
              <i className="material-icons">{outfit.isListed ? 'visibility' : 'visibility_off'}</i>
              {outfit.isListed ? t('unlist') : t('publishToFeed')}
            </button>
            <button className="btn btn-secondary danger-btn" onClick={remove}>
              <i className="material-icons">delete</i>
              {t('delete')}
            </button>
          </>
        )}
      </div>

      <hr style={{ margin: '2rem 0', border: 'none', borderTop: '1px solid var(--border)' }} />
      <Comments outfitId={outfit.id} outfitOwnerId={outfit.userId} user={user} onSignInRequest={onSignIn} />
    </div>
  );
}
