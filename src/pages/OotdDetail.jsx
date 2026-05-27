import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { doc, onSnapshot } from 'firebase/firestore';
import { ChevronRight, Eye, EyeOff, Trash2, Heart } from 'lucide-react';
import { db } from '../firebase.js';
import { OotdService } from '../services/ootd-service.js';
import { OutfitService } from '../services/outfit-service.js';
import { ProfileService } from '../services/profile-service.js';
import { Avatar } from '../components/Avatar.jsx';
import { ShareButton } from '../components/ShareButton.jsx';
import { MoreMenu } from '../components/MoreMenu.jsx';
import { useLocale } from '../hooks/useLocale.jsx';

// Editorial page for a single OOTD. Mirrors the Lekondo capture:
// big photo on top, byline (avatar + @handle + date), title, color
// palette, aesthetic composition bars, notes. Owner can publish /
// unpublish and delete; visitor can just read (and the OOTD is only
// readable at all if isPublic=true — owner-only otherwise).
export function OotdDetail({ user, onSignIn }) {
  const { t } = useLocale();
  const { ootdId } = useParams();
  const navigate = useNavigate();
  const [ootd, setOotd] = useState(null);
  const [owner, setOwner] = useState(null);
  const [outfit, setOutfit] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!ootdId) return;
    return onSnapshot(doc(db, 'ootds', ootdId), snap => {
      setOotd(snap.exists() ? { id: snap.id, ...snap.data() } : null);
    });
  }, [ootdId]);

  useEffect(() => {
    if (!ootd?.userId) { setOwner(null); return; }
    ProfileService.getByUid(ootd.userId).then(setOwner).catch(() => setOwner(null));
  }, [ootd?.userId]);

  useEffect(() => {
    if (!ootd?.outfitId) { setOutfit(null); return; }
    OutfitService.getOutfit(ootd.outfitId).then(setOutfit).catch(() => setOutfit(null));
  }, [ootd?.outfitId]);

  if (ootd === null) {
    return (
      <div className="page">
        <div className="empty-state empty-state-card">
          <p>{t('ootdNotFound')}</p>
          <Link to="/feed" className="btn btn-secondary">{t('feedTitle')}</Link>
        </div>
      </div>
    );
  }
  if (!ootd) return <div className="loading"><div className="spinner" /></div>;

  const isOwner = user && ootd.userId === user.uid;
  const dateLabel = ootd.date
    ? new Date(ootd.date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }).toUpperCase()
    : '';
  const palette = Array.isArray(ootd.palette) ? ootd.palette.slice(0, 3) : [];
  const composition = Array.isArray(ootd.composition) ? ootd.composition : [];
  const title = ootd.title || '';
  const notes = ootd.notes || '';

  const togglePublic = async () => {
    if (!isOwner || busy) return;
    setBusy(true);
    try {
      await OotdService.upsertOotd({
        date: ootd.date,
        isPublic: !ootd.isPublic,
      });
    } finally { setBusy(false); }
  };

  const remove = async () => {
    if (!isOwner) return;
    if (!confirm(t('ootdConfirmDelete'))) return;
    setBusy(true);
    try {
      await OotdService.deleteOotd({ uid: ootd.userId, date: ootd.date });
      navigate('/profile/calendar');
    } finally { setBusy(false); }
  };

  return (
    <div className="ootd-detail">
      {ootd.photoUrl && (
        <div className="ootd-hero">
          <img src={ootd.photoUrl} alt="" referrerPolicy="no-referrer" />
        </div>
      )}

      <header className="outfit-byline">
        <Link
          to={owner?.handle ? `/u/${owner.handle}` : '#'}
          className="outfit-byline-author"
          onClick={(e) => { if (!owner?.handle) e.preventDefault(); }}
        >
          <Avatar
            src={owner?.photoURL}
            name={owner?.displayName || owner?.handle}
            size={32}
            className="outfit-byline-avatar"
          />
          <span className="outfit-byline-handle">{owner?.handle ? `@${owner.handle}` : ''}</span>
        </Link>
        <div className="outfit-byline-actions">
          {isOwner && (
            <button type="button" className="btn-edit" onClick={togglePublic} disabled={busy}>
              {ootd.isPublic ? <EyeOff size={14} strokeWidth={1.6} /> : <Eye size={14} strokeWidth={1.6} />}
              {ootd.isPublic ? t('unlist') : t('publishToFeed')}
            </button>
          )}
          {!isOwner && (
            <MoreMenu
              target={{ type: 'ootd', id: ootd.id }}
              targetUid={ootd.userId}
              user={user}
              onSignIn={onSignIn}
            />
          )}
        </div>
      </header>

      {dateLabel && <div className="outfit-date">{dateLabel}</div>}

      {title && <h1 className="outfit-title">{title}</h1>}

      {palette.length > 0 && (
        <section className="outfit-palette">
          {palette.map((c, i) => (
            <div
              key={i}
              className="palette-card"
              style={{ background: c.hex, color: contrastInk(c.hex) }}
            >
              <span className="palette-pct">{Math.round(c.percent || 0)}%</span>
              <div className="palette-meta">
                <div className="palette-name">{c.name || ''}</div>
                <div className="palette-hex">{c.hex}</div>
              </div>
              <ChevronRight size={16} strokeWidth={1.5} className="palette-chev" />
            </div>
          ))}
        </section>
      )}

      {composition.length > 0 && (
        <section className="outfit-composition">
          <header>
            <h2>{t('aestheticComposition')}</h2>
            <span className="composition-sub">{t('aestheticCompositionSub')}</span>
          </header>
          <ul>
            {composition.map((c, i) => {
              const pct = Math.max(0, Math.min(100, ((c.level || 0) / 5) * 100));
              return (
                <li key={i} className="composition-row">
                  <span className="composition-label">{t(`taxonomy.styles.${c.label}`) || c.label}</span>
                  <div
                    className="composition-bar"
                    role="meter"
                    aria-valuemin="0"
                    aria-valuemax="5"
                    aria-valuenow={c.level || 0}
                    aria-label={c.label}
                  >
                    <div className="composition-bar-fill" style={{ width: `${pct}%` }} />
                  </div>
                  <ChevronRight size={14} strokeWidth={1.5} className="composition-chev" />
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {notes && (
        <section className="outfit-notes">
          <header><h2>{t('notesOnComposition')}</h2></header>
          <p>{notes}</p>
        </section>
      )}

      {outfit && (
        <section className="outfit-items">
          <header><h2>{t('itemsInOutfit')}</h2></header>
          <Link to={`/o/${outfit.id}`} className="ootd-outfit-link">
            <span>{outfit.name || t('untitledOutfit')}</span>
            <ChevronRight size={16} strokeWidth={1.5} />
          </Link>
        </section>
      )}

      <div className="controls" style={{ padding: '0 1rem' }}>
        <LikeButton ootd={ootd} user={user} />
        <ShareButton
          className="btn btn-secondary"
          title={title || t('ootdSheetTitle')}
          text={notes || ''}
          url={`${typeof window !== 'undefined' ? window.location.origin : ''}/ootd/${ootd.id}`}
        />
        {isOwner && (
          <button type="button" className="btn btn-secondary danger-btn" onClick={remove} disabled={busy}>
            <Trash2 size={14} strokeWidth={1.6} /> {t('delete')}
          </button>
        )}
      </div>
    </div>
  );
}

function LikeButton({ ootd, user }) {
  const { t } = useLocale();
  const [liked, setLiked] = useState(
    !!(user && Array.isArray(ootd.likedBy) && ootd.likedBy.includes(user.uid))
  );
  const [count, setCount] = useState(ootd.likeCount || 0);
  // Re-sync from props when the live doc updates.
  useEffect(() => {
    setLiked(!!(user && Array.isArray(ootd.likedBy) && ootd.likedBy.includes(user.uid)));
    setCount(ootd.likeCount || 0);
  }, [ootd.likedBy, ootd.likeCount, user?.uid]);

  const onClick = async () => {
    if (!user || user.isAnonymous) return;
    const next = !liked;
    setLiked(next);
    setCount(c => Math.max(0, c + (next ? 1 : -1)));
    try {
      await OotdService.toggleLike(ootd.id, user.uid, liked);
    } catch (err) {
      setLiked(!next);
      setCount(c => Math.max(0, c + (next ? -1 : 1)));
      console.warn('like failed', err.message);
    }
  };

  return (
    <button
      type="button"
      className={`btn btn-secondary${liked ? ' is-liked' : ''}`}
      onClick={onClick}
      aria-pressed={liked}
    >
      <Heart size={14} strokeWidth={1.6} fill={liked ? 'currentColor' : 'none'} />
      {count > 0 ? count : t('like')}
    </button>
  );
}

function contrastInk(hex) {
  if (!hex || hex[0] !== '#' || hex.length < 7) return '#111';
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return lum > 0.6 ? '#111' : '#fff';
}

export default OotdDetail;
