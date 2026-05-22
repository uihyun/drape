import { Link } from 'react-router-dom';
import { useLocale } from '../hooks/useLocale.jsx';

// Outfit feed card. Cover image + author chip + like/comment counts.
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
          : <div className="feed-card-cover-empty"><i className="material-icons">image</i></div>}
      </div>
      <div className="feed-card-meta">
        <div className="feed-card-author">
          {author?.photoURL
            ? <img src={author.photoURL} alt="" className="feed-card-avatar" />
            : <span className="feed-card-avatar feed-card-avatar-empty"><i className="material-icons">person</i></span>}
          <span className="feed-card-handle">@{author?.handle || '—'}</span>
        </div>
        <div className="feed-card-actions">
          <button
            className={`like-btn${liked ? ' active' : ''}`}
            onClick={handleLike}
            aria-label={liked ? t('unlike') : t('like')}
          >
            <i className="material-icons">{liked ? 'favorite' : 'favorite_border'}</i>
            <span>{outfit.likeCount || 0}</span>
          </button>
          <span className="comment-count" title={t('comments')}>
            <i className="material-icons">chat_bubble_outline</i>
            <span>{outfit.commentCount || 0}</span>
          </span>
        </div>
      </div>
    </Link>
  );
}

export default FeedCard;
