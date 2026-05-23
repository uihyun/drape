import { Link } from 'react-router-dom';
import { Heart, MessageCircle } from 'lucide-react';
import { useLocale } from '../hooks/useLocale.jsx';

// Outfit feed card. Cover image dominates; meta is a single thin row of
// @handle + like/comment counts under the photo (Lekondo-style).
export function FeedCard({ outfit, user, author, onLike, onSignInRequest }) {
  const { t } = useLocale();
  const liked = !!(user && Array.isArray(outfit.likedBy) && outfit.likedBy.includes(user.uid));
  const cover = outfit.coverUrl;

  const handleLike = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!user || user.isAnonymous) { onSignInRequest?.(); return; }
    onLike?.(outfit.id, liked);
  };

  return (
    <Link to={`/o/${outfit.id}`} className="feed-card">
      <div className="feed-card-cover">
        {cover
          ? <img src={cover} alt={outfit.name || 'outfit'} loading="lazy" />
          : <div className="feed-card-cover-empty" />}
      </div>
      <div className="feed-card-meta">
        <div className="feed-card-author">
          {author?.photoURL
            ? <img src={author.photoURL} alt="" className="feed-card-avatar" />
            : <span className="feed-card-avatar feed-card-avatar-empty">
                {(author?.handle || '?').slice(0, 1).toUpperCase()}
              </span>}
          <span className="feed-card-handle">@{author?.handle || '—'}</span>
        </div>
        <div className="feed-card-actions">
          <button
            type="button"
            className={`like-btn${liked ? ' active' : ''}`}
            onClick={handleLike}
            aria-label={liked ? t('unlike') : t('like')}
          >
            <Heart size={14} strokeWidth={1.6} fill={liked ? 'currentColor' : 'none'} />
            <span>{outfit.likeCount || 0}</span>
          </button>
          <span className="comment-count" title={t('comments')}>
            <MessageCircle size={14} strokeWidth={1.6} />
            <span>{outfit.commentCount || 0}</span>
          </span>
        </div>
      </div>
    </Link>
  );
}

export default FeedCard;
