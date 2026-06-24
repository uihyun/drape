import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { doc, onSnapshot } from 'firebase/firestore';
import { Pencil, Sparkles, EyeOff, Eye, Trash2, ChevronRight, Heart, Bookmark, Flag, Shirt, Languages } from 'lucide-react';
import { db } from '../firebase.js';
import { OutfitService } from '../services/outfit-service.js';
import { ProfileService } from '../services/profile-service.js';
import { ItemService } from '../services/item-service.js';
import { dropFromFeedCaches } from '../services/uiCache.js';
import { ReportModal } from '../components/ReportModal.jsx';
import { Comments } from '../components/Comments.jsx';
import { outfitCardPhoto } from '../utils/outfitPhoto.js';
import { ShareButton } from '../components/ShareButton.jsx';
import { PieceRow } from '../components/PieceRow.jsx';
import { Avatar } from '../components/Avatar.jsx';
import { SwipeHint } from '../components/SwipeHint.jsx';
import { useSwipeNavigate } from '../hooks/useSwipeNavigate.js';
import { useLocale } from '../hooks/useLocale.jsx';
import { useContentTranslation } from '../hooks/useContentTranslation.js';
import { TranslateToggle } from '../components/TranslateToggle.jsx';

// Lekondo's outfit detail reads like a magazine page: hero photo, byline,
// editorial title, then the palette / style / notes blocks. Each
// editorial block renders only when its data is present — outfits created
// before the auto-analysis pipeline lands still render fine, just sparser.
// Title = outfit name (built/analyzed) or the OOTD memo. Cap it so the headline
// can't balloon; the editorial "Notes on style" body is a separate field.
const TITLE_MAX_LEN = 100;
export function OutfitDetail({ user, onSignIn }) {
  const { t } = useLocale();
  const { outfitId } = useParams();
  const navigate = useNavigate();
  const swipe = useSwipeNavigate();
  const [outfit, setOutfit] = useState(undefined); // undefined=loading, null=deleted/unavailable
  const [items, setItems] = useState([]);
  const [owner, setOwner] = useState(null);
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [bookmarked, setBookmarked] = useState(false);
  const [reporting, setReporting] = useState(false);
  const [closet, setCloset] = useState([]);
  // Phase-2 translate toggle — only offered when the analysis was generated in
  // a language other than the viewer's (outfit.lang vs the app locale).
  const tr = useContentTranslation('outfits', outfitId, outfit?.lang);

  useEffect(() => {
    if (!outfitId) return;
    return onSnapshot(
      doc(db, 'outfits', outfitId),
      snap => {
        if (snap.exists()) { setOutfit({ id: snap.id, ...snap.data() }); }
        // Deleted/unpublished → mark unavailable AND drop it from any cached
        // feed page so going back doesn't show the ghost card again.
        else { setOutfit(null); dropFromFeedCaches(outfitId); }
      },
      // A private outfit you don't own denies the read — treat it as
      // "unavailable" instead of letting the listener throw uncaught.
      err => { console.warn('outfit read denied:', err?.code); setOutfit(null); dropFromFeedCaches(outfitId); },
    );
  }, [outfitId]);

  // Owner's closet powers the "from your closet" piece-match strip.
  useEffect(() => {
    if (!user || user.isAnonymous) { setCloset([]); return; }
    return ItemService.subscribeMyCloset(user.uid, list =>
      setCloset(list.filter(i => i.status === 'ready' && !i.isArchived)));
  }, [user?.uid]);

  // Live, not one-shot: a just-added "+" item lands as status='processing'
  // (uncropped) and flips to 'ready' a beat later. Subscribing lets the
  // Processing badge clear and the cropped image swap in without a reload.
  useEffect(() => {
    const ids = outfit?.itemIds || [];
    if (!ids.length) { setItems([]); return; }
    const map = new Map();
    const apply = () => setItems(ids.map(id => map.get(id)).filter(Boolean));
    const unsubs = ids.map(id => onSnapshot(
      doc(db, 'items', id),
      snap => { if (snap.exists()) map.set(id, { id: snap.id, ...snap.data() }); else map.delete(id); apply(); },
      () => { map.delete(id); apply(); },
    ));
    return () => unsubs.forEach(u => u());
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

  if (outfit === undefined) return <div className="loading"><div className="spinner" /></div>;
  if (outfit === null) return (
    <div className="empty-state empty-state-card">
      <p>{t('deletedOrUnavailable')}</p>
      <button type="button" className="btn btn-primary" onClick={() => navigate(-1)}>{t('back')}</button>
    </div>
  );
  const isOwner = user && outfit.userId === user.uid;
  // An analyzed look is a saved read of SOMEONE ELSE'S photo — it isn't your
  // OOTD, so it can't be published to the feed and there are no "items you
  // wore" to link. Keep those affordances off (the rest of the layout is
  // shared with real outfits/OOTDs).
  const isAnalyzed = outfit.kind === 'analyzed';

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
    // `caption` = the user's one-line post text; the longer editorial body
    // (AI style read) stays `notes`.
    setEditName(outfit.caption || '');
    setEditNotes(outfit.notes || '');
    setEditing(true);
  };

  const saveEdit = async () => {
    setBusy(true);
    try {
      const patch = outfit.date
        ? { caption: editName.trim() }
        : { caption: editName.trim(), notes: editNotes.trim() };
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
  const styleBars = Array.isArray(outfit.style) ? outfit.style : [];
  const notes = outfit.notes || '';
  // When the translate toggle is on, overlay the translated free-text by key /
  // array index over the originals (enums + hex + percent stay as-is).
  const tf = tr.fields;
  // Use a translated value only when it's non-empty; otherwise keep the
  // original so a blank translation never wipes the user's caption/notes.
  const displayName = (tf?.caption || outfit.caption || '');
  const displayNotes = (tf?.notes || notes);
  const displayPalette = tf?.palette
    ? palette.map((c, i) => ({ ...c, name: tf.palette[i] || c.name }))
    : palette;

  // Hero collage: lay every item out as a sticker (offset / rotation
   // varies per index). Reads as a moodboard of the look instead of one
   // lone t-shirt. Falls back to coverUrl for the single-item case.
  const heroItems = items.filter(it => it.croppedUrl || it.originalUrl);
  // A worn-look photo (OOTD photo upload) is the truest hero — show it
  // uncropped, no collage.
  // Hero photo — shared with the profile/feed cards so the per-post
  // heroVariant choice ('full' with background vs 'cut' outfit-only) is
  // consistent everywhere. Calendar uses photoCutUrl separately.
  const wornPhoto = outfitCardPhoto(outfit);
  // Detected garments: OOTDs store them as `pieces` (analyzeOotd), analyzed
  // looks as `detectedItems` (richer — keeps the description). Render
  // whichever the doc carries so a saved analysis keeps its item breakdown.
  const pieceList = (Array.isArray(outfit.pieces) && outfit.pieces.length)
    ? outfit.pieces
    : (Array.isArray(outfit.detectedItems) ? outfit.detectedItems : []);
  // Display copy with translated piece names overlaid (PieceRow shows
  // `piece.name`); the matching logic above keeps using the originals.
  const pieceListDisplay = tf?.pieces
    ? pieceList.map((p, i) => ({ ...p, name: (tf.pieces[i] || p.name) }))
    : pieceList;

  // #3 — linked items slotted under their detected piece. pieceLinks maps a
  // piece index → [itemId]. Items not under any piece are shown flat under
  // "Other items". No links → the whole strip stays flat (legacy outfits).
  const pieceLinks = (outfit.pieceLinks && typeof outfit.pieceLinks === 'object') ? outfit.pieceLinks : {};
  const itemsById = Object.fromEntries(items.map(it => [it.id, it]));
  const linkedIdSet = new Set(Object.values(pieceLinks).flat());
  const unmappedItems = items.filter(it => !linkedIdSet.has(it.id));
  // When the per-piece breakdown is on screen the linked items live there, so
  // the flat list only carries the leftovers ("Other items"). Otherwise (no
  // pieces, or a visitor) it shows the full worn set.
  const piecesShown = isOwner && pieceList.length > 0;
  const flatItems = piecesShown ? unmappedItems : items;
  const isProcessing = (it) => it?.status === 'processing' || it?.status === 'uploading';
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
      <div className="outfit-hero outfit-hero-collage" aria-label={outfit.caption || ''}>
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
      {/* Hero photo — clean, no overlay actions on it. Swipe left/right here
          jumps to the previous/next look in the list you came from. */}
      <div className="outfit-hero-wrap" {...swipe.bind} style={swipe.style}>
        {renderHero()}
      </div>
      {swipe.swipeable && <SwipeHint />}
      {reporting && (
        <ReportModal target={{ type: 'outfit', id: outfit.id }} user={user} onClose={() => setReporting(false)} />
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
        {isOwner && !editing && (
          <button type="button" className="btn-edit" onClick={openEdit}>
            <Pencil size={14} strokeWidth={1.6} /> {t('edit')}
          </button>
        )}
      </header>

      {(dateLabel || tr.canTranslate) && (
        <div className="outfit-date-row">
          <span className="outfit-date">{dateLabel}</span>
          <TranslateToggle tr={tr} />
        </div>
      )}

      {editing ? (
        <div className="outfit-edit-form">
          <input
            className="input"
            value={editName}
            onChange={e => setEditName(e.target.value.slice(0, TITLE_MAX_LEN))}
            maxLength={TITLE_MAX_LEN}
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
        displayName ? (
          <h1 className="outfit-title">{displayName}</h1>
        ) : null
      )}

      {palette.length > 0 && (
        <section className="outfit-palette">
          {displayPalette.map((c, i) => (
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

      {styleBars.length > 0 && (
        <section className="outfit-style-bars">
          <header>
            <h2>{t('styleSection')}</h2>
          </header>
          <ul>
            {styleBars.map((c, i) => {
              const pct = Math.max(0, Math.min(100, ((c.level || 0) / 5) * 100));
              return (
                <li key={i} className="style-bars-row">
                  <span className="style-bars-label">{t(`taxonomy.styles.${c.label}`) || c.label}</span>
                  <div
                    className="style-bars-bar"
                    role="meter"
                    aria-valuemin="0"
                    aria-valuemax="5"
                    aria-valuenow={c.level || 0}
                    aria-label={c.label}
                  >
                    <div className="style-bars-bar-fill" style={{ width: `${pct}%` }} />
                  </div>
                  <ChevronRight size={14} strokeWidth={1.5} className="style-bars-chev" />
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {notes && !editing && (
        <section className="outfit-notes">
          <header><h2>{t('notesOnComposition')}</h2></header>
          <p>{displayNotes}</p>
        </section>
      )}

      {/* Visitor / no-pieces view: the full worn set, flat. (Owner-with-pieces
          shows items under each piece below; only leftovers list here.) */}
      {!piecesShown && items.length > 0 && (
        <section className="outfit-items">
          <header><h2>{t('itemsInOutfit')}</h2></header>
          <div className="outfit-items-strip">
            {items.map(it => (
              <Link key={it.id} to={`/i/${it.id}`} className="outfit-item-thumb">
                {it.croppedUrl || it.originalUrl
                  ? <img src={it.croppedUrl || it.originalUrl} alt="" loading="lazy" />
                  : <div className="item-card-skeleton" />}
                {isProcessing(it) && (
                  <span className="item-card-badge"><span className="dot-pulse" /> {t('processing')}</span>
                )}
              </Link>
            ))}
          </div>
        </section>
      )}

      {piecesShown && (
        <section className="outfit-pieces">
          <header><h2>{t('piecesInLook')}</h2></header>
          {pieceListDisplay.map((piece, i) => (
            <PieceRow
              key={i}
              piece={piece}
              closet={closet}
              t={t}
              // #3 — the closet items you linked under this piece (shown in
              // place of the tag-match suggestions once they exist).
              linkedItems={(pieceLinks[i] || []).map(id => itemsById[id]).filter(Boolean)}
              // Analyzed look = someone else's pieces → offer "save to
              // wishlist" (cropped from this look's photo) like the analyze
              // result screen does. Your own OOTD's pieces are already yours.
              sale={isAnalyzed ? {
                onSave: () => ItemService.createFromExistingPhoto({
                  photoUrl: outfit.photoUrl || outfit.sourcePhotoUrl || outfit.coverUrl,
                  photoPath: outfit.photoPath || outfit.sourcePhotoPath || outfit.coverPath,
                  detected: piece,
                  owned: false,
                }),
                saveLabel: t('saveToWishlist'),
                savedLabel: t('savedToWishlist'),
              } : null}
            />
          ))}
        </section>
      )}

      {/* Leftovers: linked items whose category matched no detected piece. */}
      {piecesShown && flatItems.length > 0 && (
        <section className="outfit-items">
          <header><h2>{t('otherItems')}</h2></header>
          <div className="outfit-items-strip">
            {flatItems.map(it => (
              <Link key={it.id} to={`/i/${it.id}`} className="outfit-item-thumb">
                {it.croppedUrl || it.originalUrl
                  ? <img src={it.croppedUrl || it.originalUrl} alt="" loading="lazy" />
                  : <div className="item-card-skeleton" />}
                {isProcessing(it) && (
                  <span className="item-card-badge"><span className="dot-pulse" /> {t('processing')}</span>
                )}
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Asymmetric action bar: one prominent primary (publish for owners,
          try-on for visitors with items) spanning wide, then a compact
          icon row — Delete pushed to the far right, off on its own. */}
      <div className="outfit-actions">
        {isOwner && !isAnalyzed ? (
          <button
            type="button"
            className={`outfit-action-primary${isPublic ? ' is-unlist' : ''}`}
            onClick={togglePublish}
            disabled={busy}
          >
            {isPublic ? <EyeOff size={17} strokeWidth={1.7} /> : <Eye size={17} strokeWidth={1.7} />}
            {isPublic ? t('unlist') : t('publishToFeed')}
          </button>
        ) : (
          /* Visitors re-create the whole look from this outfit's PHOTO
             (outfit-ref mode) — its itemIds belong to the owner's closet and
             can't be used directly. Available whenever the outfit has a photo. */
          outfitCardPhoto(outfit) ? (
            <Link to={`/tryon?outfitRef=${outfit.id}`} className="outfit-action-primary">
              <Sparkles size={17} strokeWidth={1.7} /> {t('tryThisOn')}
            </Link>
          ) : null
        )}

        <div className="outfit-action-row">
          {/* Like + count visible to everyone, including the owner — you can
              like your own look and always see the tally. Share sits in the
              same row, not a separate bar under the photo. */}
          <button
            type="button"
            className={`outfit-action-icon${(outfit.likedBy || []).includes(user?.uid) ? ' is-liked' : ''}`}
            aria-label={t('like')}
            onClick={async () => {
              if (!user || user.isAnonymous) { onSignIn?.(); return; }
              try { await OutfitService.toggleLike(outfit.id, user?.uid, (outfit.likedBy || []).includes(user?.uid)); }
              catch (e) { console.warn('outfit like failed', e?.message); }
            }}
          >
            <Heart size={18} strokeWidth={1.7} fill={(outfit.likedBy || []).includes(user?.uid) ? 'currentColor' : 'none'} />
            {(outfit.likeCount || 0) > 0 && <span className="outfit-action-count">{outfit.likeCount}</span>}
          </button>
          {!isOwner && (
            <button
              type="button"
              className={`outfit-action-icon${bookmarked ? ' is-saved' : ''}`}
              aria-label={t('save')}
              onClick={async () => {
                if (!user || user.isAnonymous) { onSignIn?.(); return; }
                try { await OutfitService.toggleBookmark(outfit.id, bookmarked); }
                catch (e) { console.warn('outfit bookmark failed', e?.message); }
              }}
            >
              <Bookmark size={18} strokeWidth={1.7} fill={bookmarked ? 'currentColor' : 'none'} />
            </button>
          )}
          {isOwner && (outfit.itemIds || []).length > 0 && (
            <Link to={`/tryon?items=${outfit.itemIds.join(',')}`} className="outfit-action-icon" aria-label={t('tryThisOn')} title={t('tryThisOn')}>
              <Sparkles size={18} strokeWidth={1.7} />
            </Link>
          )}
          <ShareButton
            className="outfit-action-icon"
            title={outfit.caption || t('untitledOutfit')}
            text={outfit.notes || ''}
            url={`${window.location.origin}/s/${outfit.id}`}
            label=""
          />
          {!isOwner && (
            <button
              type="button"
              className="outfit-action-icon"
              aria-label={t('report')}
              onClick={() => { if (!user || user.isAnonymous) { onSignIn?.(); return; } setReporting(true); }}
            >
              <Flag size={17} strokeWidth={1.7} />
            </button>
          )}
          {isOwner && !isAnalyzed && (
            <Link to={`/o/${outfit.id}/link`} className="outfit-action-icon" aria-label={t('linkItemsCta')} title={t('linkItemsCta')}>
              <Shirt size={17} strokeWidth={1.7} />
            </Link>
          )}
          {isOwner && (
            <button type="button" className="outfit-action-icon outfit-action-danger" onClick={remove} aria-label={t('delete')} title={t('delete')}>
              <Trash2 size={17} strokeWidth={1.7} />
            </button>
          )}
        </div>
      </div>

      <hr style={{ margin: '2rem 0', border: 'none', borderTop: '1px solid var(--border)' }} />
      <Comments parentColl="outfits" parentId={outfit.id} ownerId={outfit.userId} user={user} onSignInRequest={onSignIn} />
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
