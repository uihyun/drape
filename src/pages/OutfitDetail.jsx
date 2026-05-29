import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { doc, getDoc, onSnapshot } from 'firebase/firestore';
import { Pencil, Sparkles, EyeOff, Eye, Trash2, ChevronRight, Heart, Bookmark, Flag } from 'lucide-react';
import { db } from '../firebase.js';
import { OutfitService } from '../services/outfit-service.js';
import { ProfileService } from '../services/profile-service.js';
import { ItemService } from '../services/item-service.js';
import { ReportModal } from '../components/ReportModal.jsx';
import { Comments } from '../components/Comments.jsx';
import { ShareButton } from '../components/ShareButton.jsx';
import { matchCloset } from '../utils/itemMatch.js';
import { useLocale } from '../hooks/useLocale.jsx';

// Lekondo's outfit detail reads like a magazine page: hero photo, byline,
// editorial title, then the palette / composition / notes blocks. Each
// editorial block renders only when its data is present — outfits created
// before the auto-analysis pipeline lands still render fine, just sparser.
export function OutfitDetail({ user, onSignIn }) {
  const { t } = useLocale();
  const { outfitId } = useParams();
  const navigate = useNavigate();
  const [outfit, setOutfit] = useState(null);
  const [items, setItems] = useState([]);
  const [owner, setOwner] = useState(null);
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [bookmarked, setBookmarked] = useState(false);
  const [reporting, setReporting] = useState(false);
  const [closet, setCloset] = useState([]);

  useEffect(() => {
    if (!outfitId) return;
    return onSnapshot(doc(db, 'outfits', outfitId), snap => {
      setOutfit(snap.exists() ? { id: snap.id, ...snap.data() } : null);
    });
  }, [outfitId]);

  // Owner's closet powers the "from your closet" piece-match strip.
  useEffect(() => {
    if (!user || user.isAnonymous) { setCloset([]); return; }
    return ItemService.subscribeMyCloset(user.uid, list =>
      setCloset(list.filter(i => i.status === 'ready' && !i.isArchived)));
  }, [user?.uid]);

  useEffect(() => {
    if (!outfit?.itemIds?.length) { setItems([]); return; }
    let cancelled = false;
    Promise.all(outfit.itemIds.map(id => getDoc(doc(db, 'items', id))))
      .then(snaps => {
        if (cancelled) return;
        setItems(snaps.filter(s => s.exists()).map(s => ({ id: s.id, ...s.data() })));
      });
    return () => { cancelled = true; };
  }, [outfit?.itemIds]);

  useEffect(() => {
    if (!outfit?.userId) { setOwner(null); return; }
    ProfileService.getByUid(outfit.userId).then(setOwner).catch(() => setOwner(null));
  }, [outfit?.userId]);

  useEffect(() => {
    if (!user || user.isAnonymous || !outfitId) { setBookmarked(false); return; }
    return onSnapshot(
      doc(db, 'users', user.uid, 'bookmarks', outfitId),
      s => setBookmarked(s.exists()),
      () => setBookmarked(false),
    );
  }, [user?.uid, outfitId]);

  if (!outfit) return <div className="loading"><div className="spinner" /></div>;
  const isOwner = user && outfit.userId === user.uid;

  // Unified visibility = isPublic (with legacy isListed as fallback read).
  const isPublic = outfit.isPublic === true || outfit.isListed === true;
  const togglePublish = async () => {
    setBusy(true);
    try {
      await OutfitService.updateOutfit(outfit.id, { isPublic: !isPublic, isListed: !isPublic });
    } finally { setBusy(false); }
  };

  const remove = async () => {
    if (!confirm(t('confirmDeleteOutfit'))) return;
    await OutfitService.deleteOutfit(outfit.id);
    navigate('/profile/outfits');
  };

  const openEdit = () => {
    // A dated OOTD uses `note` as its title (no separate name); a built/
    // analyzed outfit uses `name` + a longer `notes` body.
    setEditName(outfit.date ? (outfit.note || '') : (outfit.name || ''));
    setEditNotes(outfit.notes || '');
    setEditing(true);
  };

  const saveEdit = async () => {
    setBusy(true);
    try {
      const patch = outfit.date
        ? { note: editName.trim() }
        : { name: editName.trim(), notes: editNotes.trim() };
      await OutfitService.updateOutfit(outfit.id, patch);
      setEditing(false);
    } finally { setBusy(false); }
  };

  // A dated outfit (worn-on day) shows its date; undated saved outfits fall
  // back to created date.
  const dateObj = outfit.date
    ? new Date(outfit.date)
    : (outfit.createdAt?.toDate?.() || (outfit.createdAt ? new Date(outfit.createdAt) : null));
  const dateLabel = dateObj
    ? dateObj.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }).toUpperCase()
    : '';
  const palette = Array.isArray(outfit.palette) ? outfit.palette.slice(0, 3) : [];
  const composition = Array.isArray(outfit.style) ? outfit.style : [];
  const notes = outfit.notes || '';

  // Hero collage: lay every item out as a sticker (offset / rotation
   // varies per index). Reads as a moodboard of the look instead of one
   // lone t-shirt. Falls back to coverUrl for the single-item case.
  const heroItems = items.filter(it => it.croppedUrl || it.originalUrl);
  // A worn-look photo (OOTD photo upload) is the truest hero — show it
  // uncropped, no collage.
  const wornPhoto = outfit.photoCutUrl || outfit.photoUrl || null;
  const renderHero = () => {
    if (wornPhoto) {
      return <div className="outfit-hero outfit-hero-photo"><img src={wornPhoto} alt="" referrerPolicy="no-referrer" /></div>;
    }
    if (heroItems.length === 0 && outfit.coverUrl) {
      return <div className="outfit-hero outfit-hero-single"><img src={outfit.coverUrl} alt="" /></div>;
    }
    if (heroItems.length === 1) {
      const it = heroItems[0];
      return (
        <div className="outfit-hero outfit-hero-single">
          <img src={it.croppedUrl || it.originalUrl} alt="" />
        </div>
      );
    }
    return (
      <div className="outfit-hero outfit-hero-collage" aria-label={outfit.name || ''}>
        {heroItems.map((it, idx) => {
          const cover = it.croppedUrl || it.originalUrl;
          const total = heroItems.length;
          // Spread items in an arc with slight rotation/scale variation.
          const pct = total === 1 ? 0.5 : idx / (total - 1);
          const x = 0.18 + pct * 0.64;
          const y = 0.28 + (idx % 2 === 0 ? -0.05 : 0.06) + Math.abs(pct - 0.5) * 0.18;
          const rot = (pct - 0.5) * 24;
          const scale = 0.55 - Math.abs(pct - 0.5) * 0.12;
          return (
            <img
              key={it.id}
              src={cover}
              alt=""
              style={{
                left: `${x * 100}%`,
                top: `${y * 100}%`,
                transform: `translate(-50%, -50%) rotate(${rot}deg) scale(${scale})`,
                zIndex: idx + 1,
              }}
            />
          );
        })}
      </div>
    );
  };

  return (
    <div className="outfit-detail">
      {/* Hero + overlay actions — same dark-circle style as boards */}
      <div className="outfit-hero-wrap">
        {renderHero()}
        <div className="board-detail-hero-actions">
          {isOwner ? (
            <button
              type="button"
              className={`board-hero-action${outfit.selfLiked ? ' active' : ''}`}
              onClick={async () => {
                try { await OutfitService.toggleSelfLike(outfit.id, !outfit.selfLiked); }
                catch (e) { console.warn('toggleSelfLike failed', e?.message); }
              }}
            >
              <Heart size={16} strokeWidth={1.6} fill={outfit.selfLiked ? 'currentColor' : 'none'} />
            </button>
          ) : (
            <>
              <button
                type="button"
                className={`board-hero-action${(outfit.likedBy || []).includes(user?.uid) ? ' active' : ''}`}
                onClick={async () => {
                  if (!user || user.isAnonymous) { onSignIn?.(); return; }
                  try { await OutfitService.toggleLike(outfit.id, user?.uid, (outfit.likedBy || []).includes(user?.uid)); }
                  catch (e) { console.warn('outfit like failed', e?.message); }
                }}
              >
                <Heart size={16} strokeWidth={1.6} fill={(outfit.likedBy || []).includes(user?.uid) ? 'currentColor' : 'none'} />
                {(outfit.likeCount || 0) > 0 && <span className="board-hero-count">{outfit.likeCount}</span>}
              </button>
              <button
                type="button"
                className={`board-hero-action${bookmarked ? ' bookmarked' : ''}`}
                onClick={async () => {
                  if (!user || user.isAnonymous) { onSignIn?.(); return; }
                  try { await OutfitService.toggleBookmark(outfit.id, bookmarked); }
                  catch (e) { console.warn('outfit bookmark failed', e?.message); }
                }}
              >
                <Bookmark size={16} strokeWidth={1.6} fill={bookmarked ? 'currentColor' : 'none'} />
              </button>
              <button
                type="button"
                className="board-hero-action"
                onClick={() => { if (!user || user.isAnonymous) { onSignIn?.(); return; } setReporting(true); }}
              >
                <Flag size={15} strokeWidth={1.6} />
              </button>
            </>
          )}
        </div>
      </div>
      {reporting && (
        <ReportModal target={{ type: 'outfit', id: outfit.id }} user={user} onClose={() => setReporting(false)} />
      )}

      <header className="outfit-byline">
        <div className="outfit-byline-author">
          <div className="outfit-byline-avatar">
            {owner?.photoURL
              ? <img src={owner.photoURL} alt="" />
              : <div className="profile-avatar-fallback">{(owner?.displayName || owner?.handle || '?').slice(0,1).toUpperCase()}</div>}
          </div>
          <span className="outfit-byline-handle">{owner?.handle ? `@${owner.handle}` : ''}</span>
        </div>
        {isOwner && !editing && (
          <button type="button" className="btn-edit" onClick={openEdit}>
            <Pencil size={14} strokeWidth={1.6} /> {t('edit')}
          </button>
        )}
      </header>

      {dateLabel && <div className="outfit-date">{dateLabel}</div>}

      {editing ? (
        <div className="outfit-edit-form">
          <input
            className="input"
            value={editName}
            onChange={e => setEditName(e.target.value)}
            placeholder={outfit.date ? t('ootdNotePlaceholder') : t('untitledOutfit')}
          />
          {!outfit.date && (
            <textarea
              className="input"
              value={editNotes}
              onChange={e => setEditNotes(e.target.value)}
              rows={4}
              placeholder={t('notesPlaceholder')}
            />
          )}
          <div className="outfit-edit-actions">
            <button className="btn btn-secondary" onClick={() => setEditing(false)} disabled={busy}>
              {t('cancel')}
            </button>
            <button className="btn btn-primary" onClick={saveEdit} disabled={busy}>
              {busy ? t('saving') : t('save')}
            </button>
          </div>
        </div>
      ) : (
        (outfit.name || outfit.note) ? (
          <h1 className="outfit-title">{outfit.name || outfit.note}</h1>
        ) : null
      )}

      {palette.length > 0 && (
        <section className="outfit-palette">
          {palette.map((c, i) => (
            <div
              key={i}
              className="palette-card"
              style={{
                background: c.hex,
                color: contrastInk(c.hex),
              }}
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
                  <span className="composition-label">{c.label}</span>
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

      {notes && !editing && (
        <section className="outfit-notes">
          <header><h2>{t('notesOnComposition')}</h2></header>
          <p>{notes}</p>
        </section>
      )}

      {items.length > 0 && (
        <section className="outfit-items">
          <header><h2>{t('itemsInOutfit')}</h2></header>
          <div className="outfit-items-strip">
            {items.map(it => (
              <Link key={it.id} to={`/i/${it.id}`} className="outfit-item-thumb">
                {it.croppedUrl || it.originalUrl
                  ? <img src={it.croppedUrl || it.originalUrl} alt="" loading="lazy" />
                  : <div className="item-card-skeleton" />}
              </Link>
            ))}
          </div>
        </section>
      )}

      {isOwner && Array.isArray(outfit.pieces) && outfit.pieces.length > 0 && (
        <section className="outfit-pieces">
          <header><h2>{t('piecesInLook')}</h2></header>
          {outfit.pieces.map((piece, i) => (
            <PieceMatchRow key={i} piece={piece} closet={closet} t={t} />
          ))}
        </section>
      )}

      <div className="controls">
        {(outfit.itemIds || []).length > 0 && (
          <Link to={`/tryon?items=${outfit.itemIds.join(',')}`} className="btn btn-primary">
            <Sparkles size={16} strokeWidth={1.6} /> {t('tryThisOn')}
          </Link>
        )}
        <ShareButton
          className="btn btn-secondary"
          title={outfit.name || t('untitledOutfit')}
          text={outfit.notes || ''}
          url={`${window.location.origin}/s/${outfit.id}`}
        />
        {isOwner && (
          <>
            <Link to={`/o/${outfit.id}/link`} className="btn btn-secondary">
              <Pencil size={15} strokeWidth={1.6} /> {t('linkItemsCta')}
            </Link>
            <button type="button" className="btn btn-secondary" onClick={togglePublish} disabled={busy}>
              {isPublic ? <EyeOff size={16} strokeWidth={1.6} /> : <Eye size={16} strokeWidth={1.6} />}
              {isPublic ? t('unlist') : t('publishToFeed')}
            </button>
            <button type="button" className="btn btn-secondary danger-btn" onClick={remove}>
              <Trash2 size={16} strokeWidth={1.6} /> {t('delete')}
            </button>
          </>
        )}
      </div>

      <hr style={{ margin: '2rem 0', border: 'none', borderTop: '1px solid var(--border)' }} />
      <Comments parentColl="outfits" parentId={outfit.id} ownerId={outfit.userId} user={user} onSignInRequest={onSignIn} />
    </div>
  );
}

// One detected piece + closet items that tag-match it ("from your closet").
function PieceMatchRow({ piece, closet, t }) {
  const matches = matchCloset(piece, closet);
  const label = piece.name
    || [(piece.colors || [])[0], piece.category].filter(Boolean).join(' ')
    || t('untitledItem');
  return (
    <div className="piece-match-row">
      <div className="piece-match-head">
        <span className="piece-match-name">{label}</span>
        {piece.category && (
          <span className="piece-match-cat">{t(`taxonomy.categories.${piece.category}`)}</span>
        )}
      </div>
      {matches.length > 0 ? (
        <div className="analyze-match-strip">
          <span className="analyze-match-label">{t('fromYourCloset')}</span>
          <div className="analyze-match-row">
            {matches.map(({ item }) => {
              const cover = item.croppedUrl || item.originalUrl;
              return (
                <Link key={item.id} to={`/i/${item.id}`} className="analyze-match-card" title={item.name || ''}>
                  {cover
                    ? <img src={cover} alt={item.name || ''} loading="lazy" />
                    : <div className="item-card-skeleton" />}
                </Link>
              );
            })}
          </div>
        </div>
      ) : (
        <span className="piece-match-empty">{t('noClosetMatch')}</span>
      )}
    </div>
  );
}

// Pick black or white ink so palette cards stay legible against any hex.
// Cheap relative-luminance approximation; good enough for swatches.
function contrastInk(hex) {
  if (!hex || hex[0] !== '#' || hex.length < 7) return '#111';
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return lum > 0.6 ? '#111' : '#fff';
}
