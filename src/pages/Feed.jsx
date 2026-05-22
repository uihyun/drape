import { useEffect, useState } from 'react';
import { OutfitService } from '../services/outfit-service.js';
import { FeedCard } from '../components/FeedCard.jsx';
import { ProfileService } from '../services/profile-service.js';
import { useLocale } from '../hooks/useLocale.jsx';

export function Feed({ user, onSignIn }) {
  const { t } = useLocale();
  const [outfits, setOutfits] = useState(null);
  const [authorMap, setAuthorMap] = useState(new Map());
  const [sort, setSort] = useState('latest');

  useEffect(() => {
    OutfitService.getFeedOutfits({ sortBy: sort })
      .then(({ outfits }) => setOutfits(outfits))
      .catch(() => setOutfits([]));
  }, [sort]);

  useEffect(() => {
    if (!outfits?.length) return;
    const missing = outfits.map(o => o.userId).filter(uid => uid && !authorMap.has(uid));
    if (!missing.length) return;
    ProfileService.getProfilesByUids?.(missing).then(map => {
      if (!map || map.size === 0) return;
      setAuthorMap(prev => {
        const next = new Map(prev);
        map.forEach((p, uid) => next.set(uid, p));
        return next;
      });
    }).catch(() => {});
  }, [outfits, authorMap]);

  const handleLike = async (outfitId, currentlyLiked) => {
    if (!user || user.isAnonymous) { onSignIn?.(); return; }
    setOutfits(prev => prev.map(o => {
      if (o.id !== outfitId) return o;
      const nextLiked = currentlyLiked
        ? (o.likedBy || []).filter(u => u !== user.uid)
        : [...(o.likedBy || []), user.uid];
      return { ...o, likedBy: nextLiked, likeCount: Math.max(0, (o.likeCount || 0) + (currentlyLiked ? -1 : 1)) };
    }));
    try { await OutfitService.toggleLike(outfitId, user.uid, currentlyLiked); }
    catch (err) { console.warn('like failed', err.message); }
  };

  return (
    <div className="community-feed">
      <div className="feed-header">
        <h2 className="feed-title">{t('navFeed')}</h2>
      </div>

      <div className="feed-sort-btns">
        <button className={`feed-sort-btn ${sort === 'latest' ? 'active' : ''}`} onClick={() => setSort('latest')}>
          {t('feedSortLatest')}
        </button>
        <button className={`feed-sort-btn ${sort === 'popular' ? 'active' : ''}`} onClick={() => setSort('popular')}>
          {t('feedSortPopular')}
        </button>
      </div>

      {outfits === null ? (
        <div className="loading"><div className="spinner" /></div>
      ) : outfits.length === 0 ? (
        <p className="feed-empty">{t('feedEmpty')}</p>
      ) : (
        <div className="feed-grid">
          {outfits.map(o => (
            <FeedCard
              key={o.id}
              outfit={o}
              user={user}
              author={authorMap.get(o.userId)}
              onLike={handleLike}
              onSignInRequest={onSignIn}
            />
          ))}
        </div>
      )}
    </div>
  );
}
