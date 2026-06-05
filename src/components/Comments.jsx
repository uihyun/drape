import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { logEvent, analytics } from '../firebase.js';
import { CommentService, COMMENT_MAX_LEN } from '../services/comment-service.js';
import { DEFAULT_DISPLAY_NAME } from '../services/profile-service.js';
import { FollowButton } from './FollowButton.jsx';
import { useLocale } from '../hooks/useLocale.jsx';
import { useBlockedUids } from '../hooks/useBlockedUids.js';

function timeAgo(ts) {
  if (!ts) return '';
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  const diff = Date.now() - d.getTime();
  const mins = Math.round(diff / 60000);
  if (mins < 1) return 'now';
  if (mins < 60) return `${mins}m`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  const days = Math.round(hrs / 24);
  if (days < 30) return `${days}d`;
  return d.toLocaleDateString();
}

// `parentColl` is the parent collection name — 'outfits' | 'ootds' | 'boards'.
// Lets the same UI mount under any feed item without duplicating layout.
export function Comments({ parentColl = 'outfits', parentId, ownerId, user, onSignInRequest }) {
  const { t } = useLocale();
  const [comments, setComments] = useState([]);
  const [text, setText] = useState('');
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState(null);
  // 차단한 사용자의 댓글은 숨김 (Apple Guideline 1.2).
  const blockedUids = useBlockedUids(user);

  useEffect(() => {
    if (!parentId) return;
    return CommentService.subscribe(parentColl, parentId, setComments);
  }, [parentColl, parentId]);

  const isLoggedIn = user && !user.isAnonymous;
  const isOwner = isLoggedIn && ownerId === user.uid;
  const visibleComments = blockedUids.size > 0
    ? comments.filter(c => !blockedUids.has(c.userId))
    : comments;

  const handlePost = async () => {
    if (!text.trim() || posting) return;
    if (!isLoggedIn) { onSignInRequest?.(); return; }
    setError(null);
    setPosting(true);
    try {
      await CommentService.addComment(parentColl, parentId, text);
      logEvent(analytics, 'comment_posted', { parentColl, parentId });
      setText('');
    } catch (err) {
      console.error('comment post failed:', err);
      setError(err.message === 'TEXT_REQUIRED' ? t('commentTooLong') : t('commentErrGeneric'));
    } finally {
      setPosting(false);
    }
  };

  const handleDelete = async (c) => {
    if (!window.confirm(t('commentDeleteConfirm'))) return;
    try {
      await CommentService.deleteComment(parentColl, parentId, c.id);
      logEvent(analytics, 'comment_deleted', { parentColl, parentId });
    } catch (err) {
      console.error('comment delete failed:', err);
    }
  };

  return (
    <div className="preview-container">
      <h3>{t('commentsTitle')}{visibleComments.length > 0 && ` (${visibleComments.length})`}</h3>

      {visibleComments.length === 0 ? (
        <p className="comments-empty">{t('commentEmpty')}</p>
      ) : (
        <ul className="comment-list">
          {visibleComments.map(c => {
            const canDelete = isLoggedIn && (c.userId === user.uid || isOwner);
            return (
              <li key={c.id} className="comment-item">
                {(() => {
                  const avatar = c.photoURL ? (
                    <img src={c.photoURL} alt="" className="comment-avatar" />
                  ) : (
                    <div className="comment-avatar comment-avatar-placeholder">
                      {(c.handle || c.displayName || '?').slice(0, 1).toUpperCase()}
                    </div>
                  );
                  return c.handle
                    ? <Link to={`/u/${c.handle}`} className="comment-avatar-link">{avatar}</Link>
                    : avatar;
                })()}
                <div className="comment-body">
                  <div className="comment-meta">
                    {/* Instagram 식 — 댓글은 @handle 이 primary identity (단일 슬롯).
                        old comments 는 handle 없을 수 있어 displayName fallback. */}
                    {c.handle ? (
                      <Link to={`/u/${c.handle}`} className="comment-name">@{c.handle}</Link>
                    ) : (
                      <span className="comment-name">
                        {c.displayName && c.displayName !== DEFAULT_DISPLAY_NAME
                          ? c.displayName
                          : DEFAULT_DISPLAY_NAME}
                      </span>
                    )}
                    {isLoggedIn && c.userId !== user.uid && (
                      <FollowButton targetUid={c.userId} user={user} onSignInRequest={onSignInRequest} size="sm" />
                    )}
                    <span className="comment-time">{timeAgo(c.createdAt)}</span>
                    {canDelete && (
                      <button className="comment-delete-btn" onClick={() => handleDelete(c)} aria-label={t('commentDelete')}>
                        ×
                      </button>
                    )}
                  </div>
                  <p className="comment-text">{c.text}</p>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {isLoggedIn ? (
        <div className="comment-composer">
          <textarea
            className="comment-input"
            placeholder={t('commentPlaceholder')}
            value={text}
            onChange={e => setText(e.target.value.slice(0, COMMENT_MAX_LEN))}
            maxLength={COMMENT_MAX_LEN}
            rows={2}
            disabled={posting}
          />
          <div className="comment-composer-row">
            <span className={`comment-char-counter ${text.length >= COMMENT_MAX_LEN ? 'at-limit' : ''}`}>
              {text.length}/{COMMENT_MAX_LEN}
            </span>
            <button
              className="btn btn-primary comment-post-btn"
              onClick={handlePost}
              disabled={posting || !text.trim()}
            >
              {posting ? t('commentPosting') : t('commentPost')}
            </button>
          </div>
          {error && <p className="comment-error">{error}</p>}
        </div>
      ) : (
        <div className="comment-signin-prompt">
          <p>{t('commentSignInHint')}</p>
          {onSignInRequest && (
            <button className="btn btn-primary" onClick={() => onSignInRequest()}>
              {t('signIn')}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
