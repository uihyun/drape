import { useNavigate } from 'react-router-dom';
import { Heart, MessageCircle } from 'lucide-react';
import { Avatar } from './Avatar.jsx';
import { useLocale } from '../hooks/useLocale.jsx';

// Outfit feed card. Cover image dominates; meta is a single thin row of
// @handle + like/comment counts under the photo (Lekondo-style). Card
// uses an onClick (not a wrapping <Link>) so the inner @handle and
// like button stay independent click targets without invalid nested
// anchors.
export function FeedCard({ outfit, user, author, onLike, onSignInRequest }) {
  const { t } = useLocale();
  const navigate = useNavigate();
  const liked = !!(user && Array.isArray(outfit.likedBy) && outfit.likedBy.includes(user.uid));
  const cover = outfit.coverUrl;

  const openOutfit = () => navigate(`/o/${outfit.id}`);
  const openAuthor = (e) => {
    e.stopPropagation();
    if (author?.handle) navigate(`/u/${author.handle}`);
  };
  const handleLike = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!user || user.isAnonymous) { onSignInRequest?.(); return; }
    onLike?.(outfit.id, liked);
  };

  return (
    <div
      role="link"
      tabIndex={0}
      className="feed-card"
      onClick={openOutfit}
      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') openOutfit(); }}
    >
      <div className="feed-card-cover">
        {cover
          ? <img src={cover} alt={outfit.name || 'outfit'} loading="lazy" />
          : <div className="feed-card-cover-empty" />}
      </div>
      <div className="feed-card-meta">
        <button
          type="button"
          className="feed-card-author"
          onClick={openAuthor}
          disabled={!author?.handle}
        >
          <Avatar
            src={author?.photoURL}
            name={author?.handle}
            size={22}
            className="feed-card-avatar"
          />
          <span className="feed-card-handle">@{author?.handle || '—'}</span>
        </button>
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
    </div>
  );
}

export default FeedCard;
