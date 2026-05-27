import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { MessageService } from '../services/message-service.js';
import { ProfileService } from '../services/profile-service.js';
import { Avatar } from '../components/Avatar.jsx';
import { useLocale } from '../hooks/useLocale.jsx';

// Inbox = list of every thread the user is in (marketplace DMs). Sorted by
// most-recent activity. Tapping opens /messages/:threadId.
export function Inbox({ user }) {
  const { t } = useLocale();
  const [threads, setThreads] = useState(null);
  const [authors, setAuthors] = useState(new Map());

  useEffect(() => {
    if (!user || user.isAnonymous) { setThreads([]); return; }
    return MessageService.subscribeMyThreads(setThreads);
  }, [user?.uid]);

  // Hydrate the *other* participant's profile (avatar + handle) for each row.
  useEffect(() => {
    if (!threads?.length || !user) return;
    const otherUids = [...new Set(
      threads.map(th => th.participants.find(p => p !== user.uid)).filter(Boolean)
    )];
    const missing = otherUids.filter(u => !authors.has(u));
    if (!missing.length) return;
    Promise.all(missing.map(u => ProfileService.getByUid(u).catch(() => null)))
      .then(profs => {
        setAuthors(prev => {
          const next = new Map(prev);
          missing.forEach((u, i) => next.set(u, profs[i]));
          return next;
        });
      });
  }, [threads, user?.uid]);

  if (!user || user.isAnonymous) {
    return <div className="empty-state"><p>{t('inboxSignInRequired')}</p></div>;
  }
  if (threads === null) return <div className="loading"><div className="spinner" /></div>;
  if (threads.length === 0) return <div className="empty-state"><p>{t('inboxEmpty')}</p></div>;

  return (
    <div className="inbox">
      <header className="inbox-head"><h1>{t('inboxTitle')}</h1></header>
      <ul className="inbox-list">
        {threads.map(th => {
          const otherUid = th.participants.find(p => p !== user.uid);
          const author = authors.get(otherUid);
          const preview = th.lastMessage?.text || t('inboxNoMessages');
          const fromMe = th.lastMessage?.fromUid === user.uid;
          const unread = th.unreadFor?.[user.uid] || 0;
          return (
            <li key={th.id}>
              <Link to={`/messages/${th.id}`} className={`inbox-row${unread ? ' is-unread' : ''}`}>
                <Avatar src={author?.photoURL} name={author?.displayName || author?.handle} size={42} />
                <div className="inbox-row-meta">
                  <div className="inbox-row-top">
                    <span className="inbox-row-name">
                      {author?.displayName || (author?.handle ? `@${author.handle}` : t('unknownUser'))}
                    </span>
                    {th.itemName && <span className="inbox-row-item">· {th.itemName}</span>}
                  </div>
                  <div className="inbox-row-preview">
                    {fromMe && <span className="inbox-row-from-me">{t('inboxYou')}: </span>}
                    {preview}
                  </div>
                </div>
                {unread > 0 && (
                  <span className="inbox-row-badge" aria-label={`${unread} unread`}>
                    {unread > 9 ? '9+' : unread}
                  </span>
                )}
                {th.itemCover && (
                  <div className="inbox-row-thumb">
                    <img src={th.itemCover} alt="" />
                  </div>
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export default Inbox;
