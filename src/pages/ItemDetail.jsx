import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { doc, onSnapshot, getDocs, collection, query, where, orderBy, limit } from 'firebase/firestore';
import { ChevronLeft, Sparkles, MoreHorizontal, Pencil, Trash2, Layers, Image as ImageIcon, Download, Flag, ExternalLink, ShoppingBag, Check, Bookmark } from 'lucide-react';
import { db } from '../firebase.js';
import { ItemService } from '../services/item-service.js';
import { dropFromFeedCaches } from '../services/uiCache.js';
import { CameraService } from '../services/camera.js';
import { CATEGORIES, SUBCATEGORIES, COLORS, SEASONS, STYLES, FITS, categoryLabel } from '../services/taxonomy.js';
import { BrandInput } from '../components/BrandInput.jsx';
import { ShareButton } from '../components/ShareButton.jsx';
import { ReportModal } from '../components/ReportModal.jsx';
import { MessageService, threadIdFor } from '../services/message-service.js';
import { ProfileService } from '../services/profile-service.js';
import { shareOrDownloadImage } from '../services/share-service.js';
import { elapsedLabel, daysSince } from '../utils/elapsed.js';
import { currencyForCountry, currencySymbol, formatPrice } from '../utils/currency.js';
import { cityCountry } from '../data/cities.js';
import { SwipeHint } from '../components/SwipeHint.jsx';
import { useSwipeNavigate } from '../hooks/useSwipeNavigate.js';
import { useLocale } from '../hooks/useLocale.jsx';
import { useContentTranslation } from '../hooks/useContentTranslation.js';
import { TranslateToggle } from '../components/TranslateToggle.jsx';
import { publicOrigin } from '../services/platform-service.js';

// Full-screen single-item viewer modeled on Image 24:
// - photo dominates (white bg, contain) — tap to toggle Before/After
// - X top-left, share / more / try-on side rail on the right
// - bottom bar: category + name, expandable into the tag editor
//
// The legacy stacked layout is preserved for screens > 768px where the
// editor lives below the hero.
export function ItemDetail({ user, onSignIn }) {
  const { t } = useLocale();
  const { itemId } = useParams();
  const navigate = useNavigate();
  const swipe = useSwipeNavigate();
  const [item, setItem] = useState(undefined); // undefined=loading, null=deleted/unavailable
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState({});
  const [saving, setSaving] = useState(false);
  const [showOriginal, setShowOriginal] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [reporting, setReporting] = useState(false);
  const [ownerCurrency, setOwnerCurrency] = useState(null);
  const [listingOpen, setListingOpen] = useState(false);
  const [listingSaving, setListingSaving] = useState(false);
  // Phase-2 translate toggle for the auto-generated item name (description
  // stays English — it's the shopping query). Offered only cross-language.
  const tr = useContentTranslation('items', itemId, item?.lang);
  const [saleDraft, setSaleDraft] = useState(null);
  // If a thread for (me, seller, this item) already exists, "Contact seller"
  // becomes "Open chat" → reuse it instead of looking like a fresh start.
  // (Deterministic thread id means it's the same room either way; this just
  // reflects that in the button. A 30-day-deleted thread reads as absent →
  // back to "Contact seller".)
  const [existingThreadId, setExistingThreadId] = useState(null);
  const stageRef = useRef(null);

  // While editing, the photo follows the scroll: as the form is pulled up
  // the photo glides up at ~half speed (parallax) and fades, then glides
  // back down on reverse scroll — a smooth reveal, not a block that just
  // scrolls off. Driven by the scroll container's scrollTop.
  const onEditScroll = (e) => {
    const el = stageRef.current;
    if (!el) return;
    const y = e.currentTarget.scrollTop;
    el.style.transform = `translateY(${-y * 0.5}px)`;
    el.style.opacity = String(Math.max(0, 1 - y / 320));
  };

  // Leaving edit mode (Save/Cancel) must clear the parallax transform/opacity
  // the scroll handler left on the stage — otherwise the photo stays shifted
  // up and faded to 0, i.e. an invisible (white) hero that won't tap-toggle.
  useEffect(() => {
    if (!editing && stageRef.current) {
      stageRef.current.style.transform = '';
      stageRef.current.style.opacity = '';
    }
  }, [editing]);

  useEffect(() => {
    if (!itemId) return;
    return onSnapshot(doc(db, 'items', itemId), snap => {
      const data = snap.exists() ? { id: snap.id, ...snap.data() } : null;
      setItem(data);
      if (!data) dropFromFeedCaches(itemId); // deleted → clear from market feed cache
      if (data && !editing) setDraft({
        name: data.name || '',
        tags: data.tags || {},
        forSale: !!data.forSale,
        priceOriginal: data.priceOriginal ?? '',
        priceAsking: data.priceAsking ?? '',
        conditionGrade: data.conditionGrade || '',
      });
    });
  }, [itemId, editing]);

  // Resolve currency once for the editor — falls back to item's stamped
  // currency, then to KRW. The save handler re-resolves from the profile
  // for a freshly-listed item so this only matters for the form preview.
  useEffect(() => {
    if (!item?.userId) return;
    if (item.currency) { setOwnerCurrency(item.currency); return; }
    ProfileService.getByUid(item.userId)
      .then(p => setOwnerCurrency(currencyForCountry(cityCountry(p?.location))))
      .catch(() => setOwnerCurrency('KRW'));
  }, [item?.userId, item?.currency]);

  // "Used in" — lazy-load generations/outfits/boards that include this
  // item, shown only to the owner. Board stickers are object arrays, so
  // we load the user's boards and filter client-side.
  const [usedIn, setUsedIn] = useState(null);
  useEffect(() => {
    if (!user || !itemId) return;
    let cancelled = false;
    async function load() {
      const uid = user.uid;
      const [genSnap, outfitSnap, boardSnap] = await Promise.all([
        getDocs(query(
          collection(db, 'generations'),
          where('userId', '==', uid),
          where('itemIds', 'array-contains', itemId),
          orderBy('createdAt', 'desc'),
          limit(6),
        )).catch(() => null),
        getDocs(query(
          collection(db, 'outfits'),
          where('userId', '==', uid),
          where('itemIds', 'array-contains', itemId),
          orderBy('createdAt', 'desc'),
          limit(6),
        )).catch(() => null),
        getDocs(query(
          collection(db, 'boards'),
          where('userId', '==', uid),
          orderBy('updatedAt', 'desc'),
          limit(40),
        )).catch(() => null),
      ]);
      if (cancelled) return;
      const gens = genSnap ? genSnap.docs.map(d => ({ id: d.id, ...d.data() })) : [];
      const outfits = outfitSnap ? outfitSnap.docs.map(d => ({ id: d.id, ...d.data() })) : [];
      const boards = boardSnap
        ? boardSnap.docs
            .map(d => ({ id: d.id, ...d.data() }))
            .filter(b => (b.stickers || []).some(s => s.itemId === itemId))
            .slice(0, 6)
        : [];
      setUsedIn({ gens, outfits, boards });
    }
    load();
    return () => { cancelled = true; };
  }, [user?.uid, itemId]);

  // Does a thread already exist for this listing + me?
  useEffect(() => {
    setExistingThreadId(null);
    if (!user || user.isAnonymous || !item) return;
    if (item.userId === user.uid) return;          // I'm the seller
    if (!item.forSale || !(item.priceAsking > 0)) return;
    const id = threadIdFor(user.uid, item.userId, item.id);
    let cancelled = false;
    MessageService.getThread(id)
      .then(th => { if (!cancelled && th) setExistingThreadId(id); })
      .catch(() => {}); // missing thread denies the read → stays absent
    return () => { cancelled = true; };
  }, [user?.uid, item?.id, item?.userId, item?.forSale, item?.priceAsking]);

  if (item === undefined) return <div className="loading"><div className="spinner" /></div>;
  if (item === null) return (
    <div className="empty-state empty-state-card">
      <p>{t('deletedOrUnavailable')}</p>
      <button type="button" className="btn btn-primary" onClick={() => navigate(-1)}>{t('back')}</button>
    </div>
  );
  const isOwner = user && item.userId === user.uid;

  // Visitors get the processed cutout + tags only. Before-photo
  // (originalUrl) stays owner-only — that's the user's raw source
  // shot, which often shows their bedroom / hanger setup.
  const hasBoth = isOwner && item.originalUrl && item.croppedUrl && item.originalUrl !== item.croppedUrl;
  const cover = isOwner && showOriginal && item.originalUrl
    ? item.originalUrl
    : (item.croppedUrl || (isOwner ? item.originalUrl : null));

  const close = () => {
    if (window.history.length > 1) navigate(-1);
    else navigate('/profile/closet');
  };

  const save = async () => {
    // Sale data is managed from the menu's listing modal now — the tag
    // editor only touches name + tags.
    setSaving(true);
    try {
      await ItemService.updateItem(item.id, {
        name: draft.name,
        tags: draft.tags,
      });
      setEditing(false);
    } finally { setSaving(false); }
  };

  // Open the listing modal seeded from the item's last-known sale values, so
  // re-listing an unlisted item restores its previous price/condition.
  const openListing = () => {
    setSaleDraft({
      forSale: true,
      priceOriginal: item.priceOriginal ?? '',
      priceAsking: item.priceAsking ?? '',
      conditionGrade: item.conditionGrade || '',
    });
    setListingOpen(true);
  };

  const saveListing = async () => {
    // A listing needs a numeric asking price + a condition grade.
    const askingNum = Number(saleDraft.priceAsking);
    if (!Number.isFinite(askingNum) || askingNum <= 0) { alert(t('saleNeedsAsking')); return; }
    if (!saleDraft.conditionGrade) { alert(t('saleNeedsGrade')); return; }
    const originalNum = saleDraft.priceOriginal === '' || saleDraft.priceOriginal == null
      ? null : Number(saleDraft.priceOriginal);
    setListingSaving(true);
    try {
      // Stamp the listing currency from the seller's profile location so
      // viewers don't need a ProfileService hit just to format the price.
      let currency = item.currency || null;
      if (!currency) {
        try {
          const prof = await ProfileService.getByUid(item.userId);
          currency = currencyForCountry(cityCountry(prof?.location));
        } catch { currency = 'KRW'; }
      }
      await ItemService.updateItem(item.id, {
        forSale: true,
        priceOriginal: originalNum,
        priceAsking: askingNum,
        conditionGrade: saleDraft.conditionGrade,
        currency,
      });
      setListingOpen(false);
    } finally { setListingSaving(false); }
  };

  // Take the item off the market but KEEP price/condition so a future
  // re-list starts from the last values.
  const unlist = async () => {
    try { await ItemService.updateItem(item.id, { forSale: false }); }
    catch (e) { console.warn('unlist failed', e?.message); }
  };

  const remove = async () => {
    if (!confirm(t('confirmDeleteItem'))) return;
    await ItemService.deleteItem(item.id);
    navigate('/profile/closet');
  };

  // Replace the source photo. Uploads through CameraService.compressImage
  // → ItemService.createItem 's upload helper would be heavy; for now we
  // surface a hidden file input that's processed by reprocessItem after
  // the new bytes are written, so the cropping/tagging pipeline reruns.
  const onChangeProduct = async (file) => {
    if (!file) return;
    try {
      const blob = await CameraService.compressImage(file);
      // The existing createItem flow always allocates a new doc; here we
      // want to replace the *current* item's source. We do it directly:
      // upload to items/{uid}/{itemId}/original.jpg, then reprocess.
      const { ref, uploadBytes, getDownloadURL } = await import('firebase/storage');
      const { storage } = await import('../firebase.js');
      const path = `items/${item.userId}/${item.id}/original.jpg`;
      const r = ref(storage, path);
      await uploadBytes(r, blob, { contentType: blob.type || 'image/jpeg' });
      const url = await getDownloadURL(r);
      await ItemService.updateItem(item.id, {});
      // Manually re-trigger the pipeline; updateItem 's allowlist won't
      // touch originalUrl/originalPath/status, so call reprocess after a
      // direct doc patch from server side would be the clean way — for
      // now we patch via the existing reprocessItem path which calls the
      // processItem Cloud Function (it reads originalPath from the doc).
      // First we need to update originalUrl/originalPath; rules allow.
      const { updateDoc, serverTimestamp, doc: docFn } = await import('firebase/firestore');
      const { db: dbRef } = await import('../firebase.js');
      await updateDoc(docFn(dbRef, 'items', item.id), {
        originalUrl: url,
        originalPath: path,
        status: 'processing',
        updatedAt: serverTimestamp(),
      });
      await ItemService.reprocessItem(item.id);
    } catch (e) {
      console.warn('change product failed', e?.message);
      alert(e?.message || 'change_failed');
    }
  };

  const onSave = async () => {
    const url = item.croppedUrl || item.originalUrl;
    if (!url) return;
    try {
      const res = await fetch(url, { mode: 'cors' });
      const blob = await res.blob();
      const filename = `${(item.name || 'item').replace(/[^a-z0-9_\-]+/gi, '_')}.${blob.type === 'image/png' ? 'png' : 'jpg'}`;
      await shareOrDownloadImage({
        blob,
        filename,
        title: item.name || t('untitledItem'),
        text: item.tags?.category ? t(`taxonomy.categories.${item.tags.category}`) : '',
      });
    } catch (e) {
      console.warn('save failed', e?.message);
      alert(t('saveFailed'));
    }
  };

  return (
    <div
      className={`item-viewer${editing ? ' editing' : ''}`}
      onScroll={editing ? onEditScroll : undefined}
    >
      <button
        type="button"
        className="item-viewer-close"
        onClick={close}
        aria-label={t('close')}
      >
        <ChevronLeft size={22} strokeWidth={2} />
      </button>

      <div
        ref={stageRef}
        className="item-viewer-stage"
        {...swipe.bind}
        style={swipe.style}
        // A horizontal swipe navigates to the next item; a plain tap toggles
        // before/after. moved.current tells them apart so a swipe doesn't also
        // flip the image on the way out.
        onClick={() => { if (swipe.moved?.current) return; if (hasBoth) setShowOriginal(s => !s); }}
        role={hasBoth ? 'button' : undefined}
        aria-label={hasBoth ? (showOriginal ? t('showProcessed') : t('showOriginal')) : undefined}
      >
        {cover
          ? <img src={cover} alt={item.name || ''} draggable={false} />
          : <div className="item-card-skeleton" />}
        {(item.status === 'processing' || item.status === 'uploading') && (
          <span className="item-card-badge"><span className="dot-pulse" /> {t('processing')}</span>
        )}
        {hasBoth && (
          <span className="item-viewer-toggle">
            {showOriginal ? t('before') : t('after')}
          </span>
        )}
      </div>
      {swipe.swipeable && <SwipeHint />}

      <aside className="item-viewer-rail" aria-label="actions">
        {isOwner && (
          <Link to={`/tryon?items=${item.id}`} className="item-rail-btn" aria-label={t('tryThisOn')}>
            <Sparkles size={20} strokeWidth={1.6} />
          </Link>
        )}
        <ShareButton
          className="item-rail-btn item-rail-share"
          title={item.name || t('untitledItem')}
          text={item.tags?.category ? t(`taxonomy.categories.${item.tags.category}`) : ''}
          url={`${publicOrigin()}/i/${item.id}`}
          label=""
        />
        {isOwner ? (
          <button
            type="button"
            className="item-rail-btn"
            onClick={() => setMenuOpen(o => !o)}
            aria-label={t('more')}
          >
            <MoreHorizontal size={20} strokeWidth={1.6} />
          </button>
        ) : (
          <button
            type="button"
            className="item-rail-btn"
            onClick={() => { if (!user || user.isAnonymous) { onSignIn?.(); return; } setReporting(true); }}
            aria-label={t('report')}
          >
            <Flag size={20} strokeWidth={1.6} />
          </button>
        )}
        {isOwner && menuOpen && (
          <div className="menu-backdrop" onClick={() => setMenuOpen(false)} aria-hidden="true" />
        )}
        {isOwner && menuOpen && (
          <div className="item-rail-menu" onMouseLeave={() => setMenuOpen(false)}>
            <button type="button" onClick={() => { setMenuOpen(false); setEditing(true); }}>
              <Pencil size={14} strokeWidth={1.7} /> {t('editTags')}
            </button>
            <button
              type="button"
              onClick={async () => {
                setMenuOpen(false);
                // Toggle owned ↔ wishlist (reversible — a mis-tap or a sold
                // piece can flip back). Missing kind is treated as owned.
                const next = (item.kind === 'wishlist') ? 'owned' : 'wishlist';
                try { await ItemService.updateItem(item.id, { kind: next }); }
                catch (e) { console.warn('toggle kind failed', e?.message); }
              }}
            >
              {item.kind === 'wishlist'
                ? <><Check size={14} strokeWidth={1.7} /> {t('itemMarkOwned')}</>
                : <><Bookmark size={14} strokeWidth={1.7} /> {t('itemMarkWishlist')}</>}
            </button>
            {/* Change photo re-runs the crop/tag pipeline on its own
                (onChangeProduct → reprocessItem), so no standalone Reprocess. */}
            <button type="button" onClick={async () => { setMenuOpen(false); const f = await CameraService.pickFromLibrary(); if (f) onChangeProduct(f); }}>
              <ImageIcon size={14} strokeWidth={1.7} /> {t('changeProduct')}
            </button>
            <button type="button" onClick={() => { setMenuOpen(false); onSave(); }}>
              <Download size={14} strokeWidth={1.7} /> {t('saveImage')}
            </button>
            {/* Marketplace lives in the menu, not buried in the tag editor.
                Listing data (price/condition) survives an unlist so re-listing
                keeps the last values. Wishlist items aren't owned → can't sell. */}
            {item.kind !== 'wishlist' && (
              item.forSale ? (
                // Already listed: edit the price/condition in place (keeps the
                // listing + its DM threads alive) or take it down.
                <>
                  <button type="button" onClick={() => { setMenuOpen(false); openListing(); }}>
                    <ShoppingBag size={14} strokeWidth={1.7} /> {t('itemEditListing')}
                  </button>
                  <button type="button" onClick={() => { setMenuOpen(false); unlist(); }}>
                    <ShoppingBag size={14} strokeWidth={1.7} /> {t('itemUnlistMarket')}
                  </button>
                </>
              ) : (
                <button type="button" onClick={() => { setMenuOpen(false); openListing(); }}>
                  <ShoppingBag size={14} strokeWidth={1.7} /> {t('itemListMarket')}
                </button>
              )
            )}
            <button type="button" className="danger" onClick={() => { setMenuOpen(false); remove(); }}>
              <Trash2 size={14} strokeWidth={1.7} /> {t('delete')}
            </button>
          </div>
        )}
      </aside>

      {isOwner && Array.isArray(item.wearLog) && item.wearLog.length > 0 && (
        <div className={`item-viewer-wear${daysSince(item.lastWornAt) > 180 ? ' is-dormant' : ''}`}>
          <span className="item-viewer-wear-label">
            {t('lastWorn')}: {elapsedLabel(item.lastWornAt, t)}
          </span>
          <span className="item-viewer-wear-count">
            · {t('wornN', { n: item.wornCount || item.wearLog.length })}
          </span>
        </div>
      )}

      <footer className="item-viewer-foot">
        {editing ? (
          <div className="item-viewer-edit">
            <input
              className="rename-input"
              value={draft.name}
              onChange={e => setDraft({ ...draft, name: e.target.value })}
              placeholder={t('itemNamePlaceholder')}
              maxLength={80}
            />
            <TagsBlock t={t} tags={draft.tags} editing onChange={tags => setDraft({ ...draft, tags })} />
            <div className="item-viewer-edit-actions">
              <button className="btn btn-secondary" onClick={() => setEditing(false)} disabled={saving}>{t('cancel')}</button>
              <button className="btn btn-primary" onClick={save} disabled={saving}>{saving ? t('saving') : t('save')}</button>
            </div>
          </div>
        ) : (
          <>
            <div className="item-viewer-meta">
              {item.tags?.category && (
                <span className="item-viewer-cat">{categoryLabel(item.tags, t)}</span>
              )}
              <h1 className="item-viewer-name">
                {tr.fields?.name || item.name || t('untitledItem')}
                {(item.shopUrl || item.tags?.shopUrl) && (
                  <a
                    href={item.shopUrl || item.tags?.shopUrl}
                    target="_blank"
                    rel="noopener noreferrer nofollow"
                    className="item-name-link"
                    aria-label={t('viewProduct')}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <ExternalLink size={14} strokeWidth={1.8} />
                  </a>
                )}
                {item.forSale && item.priceAsking > 0 && (
                  <span className="item-sale-tags">
                    <span className="item-sale-price">
                      {formatPrice(item.priceAsking, item.currency)}
                    </span>
                    {item.conditionGrade && (
                      <span className="item-sale-grade">{item.conditionGrade}</span>
                    )}
                  </span>
                )}
              </h1>
              <TranslateToggle tr={tr} className="item-name-translate" />
              {/* Shopping: owner-set product link (recommend / remember) +
                  a Google Shopping search from brand + description. */}
              <div className="item-shop-row">
                {(item.shopUrl || item.tags?.shopUrl) && (
                  <a
                    className="item-shop-link"
                    href={item.shopUrl || item.tags?.shopUrl}
                    target="_blank"
                    rel="noopener noreferrer nofollow"
                  >
                    <ExternalLink size={13} strokeWidth={1.8} /> {t('viewProduct')}
                  </a>
                )}
                {(item.tags?.brand || item.tags?.description || item.name) && (
                  <a
                    className="item-shop-link"
                    href={`https://www.google.com/search?tbm=shop&q=${encodeURIComponent([item.tags?.brand, item.tags?.description || item.name].filter(Boolean).join(' '))}`}
                    target="_blank"
                    rel="noopener noreferrer nofollow"
                  >
                    <ShoppingBag size={13} strokeWidth={1.8} /> {t('findSimilar')}
                  </a>
                )}
              </div>
            </div>
            {isOwner ? (
              <button
                type="button"
                className="item-viewer-edit-toggle"
                onClick={() => setEditing(true)}
                aria-label={t('editTags')}
              >
                <Layers size={16} strokeWidth={1.7} />
              </button>
            ) : item.forSale && item.priceAsking > 0 ? (
              <button
                type="button"
                className="btn btn-primary item-viewer-contact"
                onClick={() => {
                  if (!user || user.isAnonymous) { onSignIn?.(); return; }
                  // Existing conversation → just open it (no new draft).
                  if (existingThreadId) { navigate(`/messages/${existingThreadId}`); return; }
                  try {
                    // Don't create the room yet — carry a draft and let the
                    // first message persist it (see Thread / ensureThread).
                    const { id, draft } = MessageService.prepareThread({ sellerUid: item.userId, item });
                    navigate(`/messages/${id}`, { state: { draft } });
                  } catch (err) {
                    console.warn('open thread failed:', err.message);
                    alert(err.message);
                  }
                }}
              >
                {existingThreadId ? t('openChat') : t('contactSeller')}
              </button>
            ) : null}
          </>
        )}
      </footer>
      {isOwner && usedIn && (usedIn.gens.length > 0 || usedIn.outfits.length > 0 || usedIn.boards.length > 0) && (
        <div className="item-used-in">
          {usedIn.gens.length > 0 && (
            <div className="item-used-in-section">
              <span className="item-used-in-label">{t('usedInTryOns')}</span>
              <div className="item-used-in-row">
                {usedIn.gens.map(g => {
                  const cover = (g.variantUrls || [])[0];
                  return (
                    <Link key={g.id} to={`/tryon/${g.id}`} className="item-used-in-card">
                      {cover
                        ? <img src={cover} alt="" loading="lazy" />
                        : <div className="item-card-skeleton" />}
                    </Link>
                  );
                })}
              </div>
            </div>
          )}
          {usedIn.outfits.length > 0 && (
            <div className="item-used-in-section">
              <span className="item-used-in-label">{t('usedInOutfits')}</span>
              <div className="item-used-in-row">
                {usedIn.outfits.map(o => (
                  <Link key={o.id} to={`/o/${o.id}`} className="item-used-in-card">
                    {o.coverUrl
                      ? <img src={o.coverUrl} alt="" loading="lazy" />
                      : <div className="item-card-skeleton" />}
                  </Link>
                ))}
              </div>
            </div>
          )}
          {usedIn.boards.length > 0 && (
            <div className="item-used-in-section">
              <span className="item-used-in-label">{t('usedInBoards')}</span>
              <div className="item-used-in-row">
                {usedIn.boards.map(b => (
                  <Link key={b.id} to={`/boards/${b.id}`} className="item-used-in-card">
                    {b.coverUrl
                      ? <img src={b.coverUrl} alt="" loading="lazy" />
                      : <div className="item-card-skeleton" />}
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
      {reporting && (
        <ReportModal target={{ type: 'item', id: item.id }} user={user} onClose={() => setReporting(false)} />
      )}
      {listingOpen && saleDraft && (
        <div className="modal-backdrop" onClick={() => !listingSaving && setListingOpen(false)}>
          <div className="modal sale-modal" onClick={e => e.stopPropagation()}>
            <SaleBlock t={t} draft={saleDraft} setDraft={setSaleDraft} currency={ownerCurrency} forceOn />
            <div className="item-viewer-edit-actions">
              <button className="btn btn-secondary" onClick={() => setListingOpen(false)} disabled={listingSaving}>{t('cancel')}</button>
              <button className="btn btn-primary" onClick={saveListing} disabled={listingSaving}>{listingSaving ? t('saving') : t('save')}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function TagsBlock({ tags, editing, onChange, t }) {
  const set = (k, v) => onChange({ ...(tags || {}), [k]: v });
  const toggle = (k, v) => {
    const cur = Array.isArray(tags?.[k]) ? tags[k] : [];
    const next = cur.includes(v) ? cur.filter(x => x !== v) : [...cur, v];
    set(k, next);
  };
  return (
    <div className="tags-block">
      <Row label={t('tagCategory')}>
        {CATEGORIES.map(c => (
          <Chip key={c} active={tags?.category === c} editable={editing}
            onClick={() => editing && set('category', c)}>
            {t(`taxonomy.categories.${c}`)}
          </Chip>
        ))}
      </Row>
      {/* Subcategory — only the ones valid for the chosen category. Lets the
          user fix "Top" → "Shirt" so labels/search read specifically. */}
      {tags?.category && (SUBCATEGORIES[tags.category] || []).length > 0 && (
        <Row label={t('tagSubcategory')}>
          {SUBCATEGORIES[tags.category].map(s => (
            <Chip key={s} active={tags?.subcategory === s} editable={editing}
              onClick={() => editing && set('subcategory', tags?.subcategory === s ? null : s)}>
              {t(`taxonomy.subcategories.${s}`)}
            </Chip>
          ))}
        </Row>
      )}
      <Row label={t('tagColors')}>
        {COLORS.map(c => (
          <Chip key={c} active={(tags?.colors || []).includes(c)} editable={editing}
            onClick={() => editing && toggle('colors', c)}>
            {t(`taxonomy.colors.${c}`)}
          </Chip>
        ))}
      </Row>
      <Row label={t('tagSeasons')}>
        {SEASONS.map(s => (
          <Chip key={s} active={(tags?.seasons || []).includes(s)} editable={editing}
            onClick={() => editing && toggle('seasons', s)}>
            {t(`taxonomy.seasons.${s}`)}
          </Chip>
        ))}
      </Row>
      <Row label={t('tagStyles')}>
        {STYLES.map(s => (
          <Chip key={s} active={(tags?.styles || []).includes(s)} editable={editing}
            onClick={() => editing && toggle('styles', s)}>
            {t(`taxonomy.styles.${s}`)}
          </Chip>
        ))}
      </Row>
      <Row label={t('tagFit')}>
        {FITS.map(f => (
          <Chip key={f} active={tags?.fit === f} editable={editing}
            onClick={() => editing && set('fit', f)}>
            {t(`taxonomy.fits.${f}`)}
          </Chip>
        ))}
      </Row>
      <Row label={t('tagBrand')}>
        {editing ? (
          <BrandInput
            value={tags?.brand || ''}
            onChange={(v) => set('brand', v.slice(0, 60))}
            placeholder={t('tagBrandPlaceholder')}
          />
        ) : (
          <span className="tag-brand-display">
            {tags?.brand || <em className="muted">{t('tagBrandNone')}</em>}
          </span>
        )}
      </Row>
      {editing && (
        <Row label={t('tagShopUrl')}>
          <input
            type="url"
            inputMode="url"
            className="tag-brand-input"
            value={tags?.shopUrl || ''}
            onChange={e => set('shopUrl', e.target.value.slice(0, 500))}
            placeholder={t('tagShopUrlPlaceholder')}
            autoCapitalize="none"
            autoCorrect="off"
          />
        </Row>
      )}
    </div>
  );
}

function Row({ label, children }) {
  return (
    <div className="tag-row">
      <span className="tag-label">{label}</span>
      <div className="chips">{children}</div>
    </div>
  );
}

function Chip({ active, editable, onClick, children }) {
  return (
    <button
      type="button"
      className={`chip ${active ? 'active' : ''} ${editable ? '' : 'readonly'}`}
      onClick={onClick}
      disabled={!editable && !active}
    >
      {children}
    </button>
  );
}

const CONDITION_GRADES = ['S', 'A', 'B', 'C'];

function SaleBlock({ t, draft, setDraft, currency, forceOn = false }) {
  const onToggle = (e) => setDraft({ ...draft, forSale: e.target.checked });
  const onNum = (key) => (e) => {
    // Strip non-digits, keep as string in draft so empty stays empty.
    const v = e.target.value.replace(/[^0-9]/g, '');
    setDraft({ ...draft, [key]: v });
  };
  const sym = currencySymbol(currency);
  // forceOn (listing modal): listing is the modal's whole purpose, so the
  // fields are always shown and the toggle becomes a plain heading.
  const showFields = forceOn || draft.forSale;
  return (
    <div className="sale-block">
      {forceOn ? (
        <h3 className="sale-heading">{t('saleToggle')}</h3>
      ) : (
        <label className="sale-toggle">
          <input type="checkbox" checked={!!draft.forSale} onChange={onToggle} />
          <span>{t('saleToggle')}</span>
        </label>
      )}
      {showFields && (
        <div className="sale-fields">
          <div className="sale-price-row">
            <label className="sale-field">
              <span className="sale-field-label">{t('salePriceOriginal')}</span>
              <div className="sale-price-input">
                <span className="sale-currency">{sym}</span>
                <input
                  type="text"
                  inputMode="numeric"
                  value={draft.priceOriginal ?? ''}
                  onChange={onNum('priceOriginal')}
                  placeholder={t('salePricePlaceholder')}
                />
              </div>
            </label>
            <label className="sale-field">
              <span className="sale-field-label">{t('salePriceAsking')}</span>
              <div className="sale-price-input">
                <span className="sale-currency">{sym}</span>
                <input
                  type="text"
                  inputMode="numeric"
                  value={draft.priceAsking ?? ''}
                  onChange={onNum('priceAsking')}
                  placeholder={t('saleAskingPlaceholder')}
                />
              </div>
            </label>
          </div>
          <div className="sale-field">
            <span className="sale-field-label">{t('saleConditionGrade')}</span>
            <div className="sale-grades">
              {CONDITION_GRADES.map(g => (
                <button
                  key={g}
                  type="button"
                  className={`sale-grade${draft.conditionGrade === g ? ' active' : ''}`}
                  onClick={() => setDraft({ ...draft, conditionGrade: g })}
                >
                  {t(`saleGrade_${g}`)}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
