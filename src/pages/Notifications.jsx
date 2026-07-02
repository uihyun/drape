import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Avatar } from '../components/Avatar.jsx';
import { NotificationService } from '../services/notification-service.js';
import { useLocale } from '../hooks/useLocale.jsx';

// Relative "3h / 2d" — good enough for an activity list; no i18n lib needed.
function timeAgo(ts) {
  const ms = ts?.toDate ? ts.toDate().getTime() : (ts ? new Date(ts).getTime() : 0);
  if (!ms) return '';
  const s = Math.max(0, Math.floor((Date.now() - ms) / 1000));
  if (s < 60) return 'now';
  const m = Math.floor(s / 60); if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60); if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24); if (d < 7) return `${d}d`;
  return `${Math.floor(d / 7)}w`;
}

// Where a notification links to, and the localized action phrase.
function linkFor(n) {
  if (n.type === 'follow') return n.actorHandle ? `/u/${n.actorHandle}` : null;
  if (n.targetType === 'board') return `/boards/${n.targetId}`;
  if (n.targetType === 'outfit') return `/o/${n.targetId}`;
  return null;
}

export function Notifications({ user, onSignIn }) {
  const { t } = useLocale();
  const [items, setItems] = useState(null);

  useEffect(() => {
    if (!user || user.isAnonymous) { setItems([]); return; }
    const unsub = NotificationService.subscribe(setItems);
    // Opening the bell clears the dot.
    NotificationService.markAllRead();
    return unsub;
  }, [user?.uid]);

  if (!user || user.isAnonymous) {
    return (
      <div className="page">
        <div className="empty-state">
          <h2>{t('notifications')}</h2>
          <p>{t('settingsSignInBody')}</p>
          <button className="btn btn-primary" onClick={onSignIn}>{t('signIn')}</button>
        </div>
      </div>
    );
  }

  const action = (n) => (
    n.type === 'follow' ? t('notifFollowed')
      : n.type === 'tryon' ? t('notifTriedOn')
        : t('notifCommented')
  );

  return (
    <div className="page notifications-page">
      <h1 className="page-h1">{t('notifications')}</h1>
      {items === null ? (
        <div className="loading"><div className="spinner" /></div>
      ) : items.length === 0 ? (
        <div className="empty-state empty-state-card"><p>{t('notifEmpty')}</p></div>
      ) : (
        <ul className="notif-list">
          {items.map((n) => {
            const to = linkFor(n);
            const inner = (
              <>
                <Avatar src={n.actorPhoto} name={n.actorName} size={40} />
                <span className="notif-body">
                  <span className="notif-text">
                    <strong>{n.actorName || 'Someone'}</strong> {action(n)}
                  </span>
                  {n.preview && <span className="notif-preview">“{n.preview}”</span>}
                </span>
                <span className="notif-time">{timeAgo(n.createdAt)}</span>
              </>
            );
            return (
              <li key={n.id} className={`notif-row${n.read ? '' : ' notif-unread'}`}>
                {to
                  ? <Link to={to} className="notif-link">{inner}</Link>
                  : <div className="notif-link">{inner}</div>}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

export default Notifications;
