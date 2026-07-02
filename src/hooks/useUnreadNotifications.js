import { useEffect, useState } from 'react';
import { NotificationService } from '../services/notification-service.js';

// True when the user has any unread notification. Drives the profile bell's
// DOT badge (intentionally a dot, not a count — likes etc. shouldn't turn the
// bell into an anxiety-inducing number). Returns false for anon / signed-out.
export function useUnreadNotifications(user) {
  const [hasUnread, setHasUnread] = useState(false);
  useEffect(() => {
    if (!user || user.isAnonymous) { setHasUnread(false); return; }
    return NotificationService.subscribe(items => {
      setHasUnread(items.some(n => !n.read));
    });
  }, [user?.uid]);
  return hasUnread;
}
