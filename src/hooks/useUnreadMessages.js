import { useEffect, useState } from 'react';
import { MessageService } from '../services/message-service.js';

// Sum of unread counts across every thread the current user is in.
// Subscribes to the same threads stream the Inbox uses so the badge stays
// in sync without an extra round trip. Returns 0 for anonymous / signed-out.
// Returns unread count AND whether any conversation exists at all. The second
// half drives whether the inbox entry is shown: DMs only start from a
// marketplace listing, so for everyone who has never bought or sold, an inbox
// icon is a permanently empty room taking a slot in the header. Hiding it
// on `hasThreads` keeps the feature reachable for the people actually in a
// conversation — a blanket hide would strand a seller with a message they
// can never open.
export function useMessagePresence(user) {
  const [state, setState] = useState({ unread: 0, hasThreads: false });
  useEffect(() => {
    if (!user || user.isAnonymous) { setState({ unread: 0, hasThreads: false }); return; }
    return MessageService.subscribeMyThreads(threads => {
      let n = 0;
      for (const th of threads) {
        n += (th.unreadFor && th.unreadFor[user.uid]) || 0;
      }
      setState({ unread: n, hasThreads: threads.length > 0 });
    });
  }, [user?.uid]);
  return state;
}

export function useUnreadMessages(user) {
  return useMessagePresence(user).unread;
}
