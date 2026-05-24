import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { OotdService } from '../services/ootd-service.js';
import { ProfileService } from '../services/profile-service.js';
import { Avatar } from '../components/Avatar.jsx';
import { useLocale } from '../hooks/useLocale.jsx';

// Discovery — published OOTDs from every user, newest first. Each
// card is a full-bleed OOTD photo with the author chip + title
// overlay on the bottom (Lekondo capture 1 read). Tapping opens
// /ootd/:id for the editorial breakdown.
export function Feed({ user, onSignIn }) {
  const { t } = useLocale();
  const [ootds, setOotds] = useState(null);
  const [authorMap, setAuthorMap] = useState(new Map());

  useEffect(() => {
    OotdService.listPublicFeed({ pageSize: 24 })
      .then(({ ootds }) => setOotds(ootds))
      .catch(() => setOotds([]));
  }, []);

  useEffect(() => {
    if (!ootds?.length) return;
    const missing = ootds.map(o => o.userId).filter(uid => uid && !authorMap.has(uid));
    if (!missing.length) return;
    ProfileService.getProfilesByUids?.(missing).then(map => {
      if (!map || map.size === 0) return;
      setAuthorMap(prev => {
        const next = new Map(prev);
        map.forEach((p, uid) => next.set(uid, p));
        return next;
      });
    }).catch(() => {});
  }, [ootds, authorMap]);

  return (
    <div className="community-feed">
      <header className="feed-top">
        <h1 className="feed-h1">{t('feedTitle')}</h1>
      </header>

      {ootds === null ? (
        <div className="loading"><div className="spinner" /></div>
      ) : ootds.length === 0 ? (
        <FeedEmpty t={t} />
      ) : (
        <div className="ootd-feed">
          {ootds.map(o => (
            <OotdCard key={o.id} ootd={o} author={authorMap.get(o.userId)} t={t} />
          ))}
        </div>
      )}
    </div>
  );
}

function OotdCard({ ootd, author, t }) {
  return (
    <Link to={`/ootd/${ootd.id}`} className="ootd-card">
      {ootd.photoUrl
        ? <img src={ootd.photoUrl} alt="" loading="lazy" referrerPolicy="no-referrer" />
        : <div className="ootd-card-empty">◇</div>}
      <div className="ootd-card-overlay">
        <div className="ootd-card-author">
          <Avatar
            src={author?.photoURL}
            name={author?.handle}
            size={28}
            className="ootd-card-avatar"
          />
          <span className="ootd-card-handle">@{author?.handle || '—'}</span>
        </div>
        {ootd.title && <h3 className="ootd-card-title">{ootd.title}</h3>}
      </div>
    </Link>
  );
}

function FeedEmpty({ t }) {
  return (
    <div className="feed-empty">
      <div className="feed-empty-mark">◇</div>
      <h2 className="feed-empty-title">{t('feedEmptyTitle')}</h2>
      <p className="feed-empty-body">{t('feedEmptyBody')}</p>
    </div>
  );
}
