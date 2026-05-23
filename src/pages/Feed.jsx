import { useEffect, useState } from 'react';
import { OutfitService } from '../services/outfit-service.js';
import { FeedCard } from '../components/FeedCard.jsx';
import { ProfileService } from '../services/profile-service.js';
import { useLocale } from '../hooks/useLocale.jsx';

// Discovery / "Home" feed — Pinterest-style masonry of other people's
// outfits. Modeled on archelier's moodboard. Sort toggle on top right
// (Latest / Popular), tiles below in 2-col (mobile) / 3-col (desktop)
// column masonry so tall and wide covers both fit naturally.
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
      <header className="feed-top">
        <h1 className="feed-h1">{t('feedTitle')}</h1>
        <nav className="feed-sort-tabs" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={sort === 'latest'}
            className={`feed-sort-tab${sort === 'latest' ? ' active' : ''}`}
            onClick={() => setSort('latest')}
          >
            {t('feedSortLatest')}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={sort === 'popular'}
            className={`feed-sort-tab${sort === 'popular' ? ' active' : ''}`}
            onClick={() => setSort('popular')}
          >
            {t('feedSortPopular')}
          </button>
        </nav>
      </header>

      {outfits === null ? (
        <div className="loading"><div className="spinner" /></div>
      ) : outfits.length === 0 ? (
        <FeedEmpty t={t} />
      ) : (
        <div className="moodboard-grid">
          {outfits.map(o => (
            <div key={o.id} className="moodboard-item">
              <FeedCard
                outfit={o}
                user={user}
                author={authorMap.get(o.userId)}
                onLike={handleLike}
                onSignInRequest={onSignIn}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function FeedEmpty({ t }) {
  return (
    <div className="feed-empty">
      <div className="feed-empty-mark">◇</div>
      <h2 className="feed-empty-title">{t('feedEmptyTitle')}</h2>
      <p className="feed-empty-body">{t('feedEmptyBody')}</p>
    </div>
  );
}
