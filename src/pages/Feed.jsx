import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Heart } from 'lucide-react';
import { OotdService } from '../services/ootd-service.js';
import { ProfileService } from '../services/profile-service.js';
import { Avatar } from '../components/Avatar.jsx';
import { useLocale } from '../hooks/useLocale.jsx';

// Discovery — published OOTDs from every user, newest first. Each
// card is a full-bleed OOTD photo with the author chip + title
// overlay on the bottom (Lekondo capture 1 read). Tapping opens
// /ootd/:id for the editorial breakdown.
export function Feed({ user, onSignIn }) {
  const { t } = useLocale();
  const [ootds, setOotds] = useState(null);
  const [authorMap, setAuthorMap] = useState(new Map());
  const [sort, setSort] = useState('latest');

  useEffect(() => {
    setOotds(null);
    OotdService.listPublicFeed({ pageSize: 24, sortBy: sort })
      .then(({ ootds }) => setOotds(ootds))
      .catch(() => setOotds([]));
  }, [sort]);

  useEffect(() => {
    if (!ootds?.length) return;
    const missing = ootds.map(o => o.userId).filter(uid => uid && !authorMap.has(uid));
    if (!missing.length) return;
    ProfileService.getProfilesByUids?.(missing).then(map => {
      if (!map || map.size === 0) return;
      setAuthorMap(prev => {
        const next = new Map(prev);
        map.forEach((p, uid) => next.set(uid, p));
        return next;
      });
    }).catch(() => {});
  }, [ootds, authorMap]);

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

      {ootds === null ? (
        <div className="loading"><div className="spinner" /></div>
      ) : ootds.length === 0 ? (
        <FeedEmpty t={t} />
      ) : (
        <div className="ootd-feed">
          {ootds.map(o => (
            <OotdCard
              key={o.id}
              ootd={o}
              author={authorMap.get(o.userId)}
              user={user}
              onLikeChange={(patch) => setOotds(prev => prev.map(x => x.id === o.id ? { ...x, ...patch } : x))}
              onSignIn={onSignIn}
              t={t}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function OotdCard({ ootd, author, user, onLikeChange, onSignIn, t }) {
  const liked = !!(user && Array.isArray(ootd.likedBy) && ootd.likedBy.includes(user.uid));
  const handleLike = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!user || user.isAnonymous) { onSignIn?.(); return; }
    const nextLiked = !liked;
    const nextLikedBy = nextLiked
      ? [...(ootd.likedBy || []), user.uid]
      : (ootd.likedBy || []).filter(u => u !== user.uid);
    const nextCount = Math.max(0, (ootd.likeCount || 0) + (nextLiked ? 1 : -1));
    // Optimistic update
    onLikeChange?.({ likedBy: nextLikedBy, likeCount: nextCount });
    try {
      await OotdService.toggleLike(ootd.id, user.uid, liked);
    } catch (err) {
      console.warn('like failed', err.message);
      // Rollback
      onLikeChange?.({ likedBy: ootd.likedBy || [], likeCount: ootd.likeCount || 0 });
    }
  };

  return (
    <Link to={`/ootd/${ootd.id}`} className="ootd-card">
      {ootd.photoUrl
        ? <img src={ootd.photoUrl} alt="" loading="lazy" referrerPolicy="no-referrer" />
        : <div className="ootd-card-empty">◇</div>}
      <button
        type="button"
        className={`ootd-card-like${liked ? ' active' : ''}`}
        onClick={handleLike}
        aria-label={liked ? t('unlike') : t('like')}
      >
        <Heart size={18} strokeWidth={1.6} fill={liked ? 'currentColor' : 'none'} />
        {(ootd.likeCount || 0) > 0 && <span>{ootd.likeCount}</span>}
      </button>
      <div className="ootd-card-overlay">
        <div className="ootd-card-author">
          <Avatar
            src={author?.photoURL}
            name={author?.handle}
            size={28}
            className="ootd-card-avatar"
          />
          <span className="ootd-card-handle">@{author?.handle || '—'}</span>
        </div>
        {ootd.title && <h3 className="ootd-card-title">{ootd.title}</h3>}
      </div>
    </Link>
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
