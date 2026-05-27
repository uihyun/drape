import { useEffect, useState } from 'react';
import { MessageService } from '../services/message-service.js';

// Sum of unread counts across every thread the current user is in.
// Subscribes to the same threads stream the Inbox uses so the badge stays
// in sync without an extra round trip. Returns 0 for anonymous / signed-out.
export function useUnreadMessages(user) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (!user || user.isAnonymous) { setCount(0); return; }
    return MessageService.subscribeMyThreads(threads => {
      let n = 0;
      for (const th of threads) {
        n += (th.unreadFor && th.unreadFor[user.uid]) || 0;
      }
      setCount(n);
    });
  }, [user?.uid]);
  return count;
}
