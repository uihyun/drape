import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { doc, onSnapshot } from 'firebase/firestore';
import { Pencil, Sparkles, EyeOff, Eye, Trash2, ChevronRight, Heart, Bookmark, Flag, Shirt } from 'lucide-react';
import { db } from '../firebase.js';
import { OutfitService } from '../services/outfit-service.js';
import { ProfileService } from '../services/profile-service.js';
import { ItemService } from '../services/item-service.js';
import { ReportModal } from '../components/ReportModal.jsx';
import { Comments } from '../components/Comments.jsx';
import { outfitCardPhoto } from '../utils/outfitPhoto.js';
import { ShareButton } from '../components/ShareButton.jsx';
import { PieceRow } from '../components/PieceRow.jsx';
import { useLocale } from '../hooks/useLocale.jsx';

// Lekondo's outfit detail reads like a magazine page: hero photo, byline,
// editorial title, then the palette / style / notes blocks. Each
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
  const [editHeroVariant, setEditHeroVariant] = useState('full'); // 'full' | 'cut'
  const [bookmarked, setBookmarked] = useState(false);
  const [reporting, setReporting] = useState(false);
  const [closet, setCloset] = useState([]);

  useEffect(() => {
    if (!outfitId) return;
    return onSnapshot(
      doc(db, 'outfits', outfitId),
      snap => setOutfit(snap.exists() ? { id: snap.id, ...snap.data() } : null),
      // A private outfit you don't own denies the read — treat it as
      // "unavailable" instead of letting the listener throw uncaught.
      err => { console.warn('outfit read denied:', err?.code); setOutfit(null); },
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

  if (!outfit) return <div className="loading"><div className="spinner" /></div>;
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
    // A dated OOTD uses `note` as its title (no separate name); a built/
    // analyzed outfit uses `name` + a longer `notes` body.
    setEditName(outfit.date ? (outfit.note || '') : (outfit.name || ''));
    setEditNotes(outfit.notes || '');
    setEditHeroVariant(outfit.heroVariant === 'cut' ? 'cut' : 'full');
    setEditing(true);
  };

  const saveEdit = async () => {
    setBusy(true);
    try {
      const patch = outfit.date
        ? { note: editName.trim() }
        : { name: editName.trim(), notes: editNotes.trim() };
      if (outfit.photoCutUrl) patch.heroVariant = editHeroVariant;
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
      {/* Hero photo — clean, no overlay actions on it. */}
      <div className="outfit-hero-wrap">
        {renderHero()}
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
          {/* Hero photo choice — only when a background-removed cut-out
              exists for this post. Full (with background) is the default. */}
          {outfit.photoCutUrl && (outfit.photoUrl || outfit.sourcePhotoUrl) && (
            <div className="outfit-hero-choice">
              <span className="outfit-hero-choice-label">{t('heroPhotoLabel')}</span>
              <div className="filter-chips filter-chips--text">
                <button
                  type="button"
                  className={`chip${editHeroVariant === 'full' ? ' active' : ''}`}
                  onClick={() => setEditHeroVariant('full')}
                >
                  {t('heroPhotoFull')}
                </button>
                <button
                  type="button"
                  className={`chip${editHeroVariant === 'cut' ? ' active' : ''}`}
                  onClick={() => setEditHeroVariant('cut')}
                >
                  {t('heroPhotoCut')}
                </button>
              </div>
            </div>
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
                  <span className="style-bars-label">{c.label}</span>
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
          <p>{notes}</p>
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
          {pieceList.map((piece, i) => (
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
          {/* Visitor social actions share this row with Share — same format,
              not a separate bar under the photo. */}
          {!isOwner && (
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
          )}
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
            title={outfit.name || t('untitledOutfit')}
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
