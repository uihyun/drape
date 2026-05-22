import { useEffect, useState } from 'react';
import { BlockService } from '../services/block-service.js';

// Realtime Set<uid> of users I've blocked. Empty set when signed out /
// anonymous. Used by feed-like surfaces (CommunityFeed, follow list modal)
// to filter out content/users I shouldn't see.
export function useBlockedUids(user) {
  const [blockedUids, setBlockedUids] = useState(() => new Set());

  useEffect(() => {
    if (!user || user.isAnonymous) {
      setBlockedUids(new Set());
      return undefined;
    }
    const unsub = BlockService.subscribeMyBlockedUids(setBlockedUids);
    return unsub;
  }, [user?.uid, user?.isAnonymous]);

  return blockedUids;
}
