import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { doc, onSnapshot, getDoc } from 'firebase/firestore';
import { db } from '../firebase.js';
import { Comments } from '../components/Comments.jsx';
import { useLocale } from '../hooks/useLocale.jsx';

// Public read-only outfit page — for sharing outside the app.
// Same view as OutfitDetail minus owner-only controls.
export function OutfitShare({ user, onSignIn }) {
  const { t } = useLocale();
  const { outfitId } = useParams();
  const [outfit, setOutfit] = useState(null);
  const [items, setItems] = useState([]);
  const [author, setAuthor] = useState(null);

  useEffect(() => {
    if (!outfitId) return;
    return onSnapshot(doc(db, 'outfits', outfitId), snap => {
      setOutfit(snap.exists() ? { id: snap.id, ...snap.data() } : null);
    });
  }, [outfitId]);

  useEffect(() => {
    if (!outfit?.userId) return;
    getDoc(doc(db, 'profiles', outfit.userId)).then(snap => {
      if (snap.exists()) setAuthor(snap.data());
    });
  }, [outfit?.userId]);

  useEffect(() => {
    if (!outfit?.itemIds?.length) return;
    // Cropped item images are private; we display only what's stored on
    // the outfit cover. Strip image lookups skipped in the share view.
  }, [outfit?.itemIds]);

  if (!outfit) return <div className="loading"><div className="spinner" /></div>;
  if (!outfit.isListed && !(user && outfit.userId === user.uid)) {
    return <div className="empty-state"><p>{t('notListed')}</p></div>;
  }

  return (
    <div className="outfit-detail">
      <h2>{outfit.name || t('untitledOutfit')}</h2>
      {author && (
        <p className="muted">
          @{author.handle} · {author.displayName}
        </p>
      )}

      {outfit.coverUrl && (
        <div className="outfit-cover-large">
          <img src={outfit.coverUrl} alt="" />
        </div>
      )}

      {outfit.notes && <p style={{ marginTop: '1rem' }}>{outfit.notes}</p>}

      <hr style={{ margin: '2rem 0', border: 'none', borderTop: '1px solid var(--border)' }} />
      <Comments outfitId={outfit.id} outfitOwnerId={outfit.userId} user={user} onSignInRequest={onSignIn} />
    </div>
  );
}
