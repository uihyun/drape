import { useEffect, useState } from 'react';
import { logEvent, analytics } from '../firebase.js';
import { FollowService } from '../services/follow-service.js';
import { useLocale } from '../hooks/useLocale.jsx';

export function FollowButton({ targetUid, user, onSignInRequest, size = 'md' }) {
  const { t } = useLocale();
  const [following, setFollowing] = useState(false);
  const [pending, setPending] = useState(false);

  const isLoggedIn = user && !user.isAnonymous;
  const isSelf = isLoggedIn && targetUid === user.uid;

  useEffect(() => {
    if (!isLoggedIn || !targetUid || isSelf) { setFollowing(false); return; }
    return FollowService.subscribeIsFollowing(targetUid, setFollowing);
  }, [isLoggedIn, targetUid, isSelf]);

  if (!targetUid || isSelf) return null;

  const handleClick = async (e) => {
    e?.stopPropagation?.();
    e?.preventDefault?.();
    if (!isLoggedIn) { onSignInRequest?.(); return; }
    if (pending) return;
    setPending(true);
    const next = !following;
    setFollowing(next); // optimistic
    try {
      await FollowService.toggleFollow(targetUid, following);
      logEvent(analytics, next ? 'follow_added' : 'follow_removed', { targetUid });
    } catch (err) {
      console.error('follow toggle failed:', err);
      setFollowing(!next);
    } finally {
      setPending(false);
    }
  };

  return (
    <button
      type="button"
      className={`follow-btn ${following ? 'is-following' : ''} follow-btn-${size}`}
      onClick={handleClick}
      disabled={pending}
      aria-pressed={following}
    >
      {following ? t('following') : t('follow')}
    </button>
  );
}
