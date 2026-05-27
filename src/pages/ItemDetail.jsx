import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { doc, onSnapshot } from 'firebase/firestore';
import { X, Sparkles, MoreHorizontal, Pencil, RefreshCw, Trash2, Layers, Image as ImageIcon, Download } from 'lucide-react';
import { db } from '../firebase.js';
import { ItemService } from '../services/item-service.js';
import { CameraService } from '../services/camera.js';
import { CATEGORIES, COLORS, SEASONS, STYLES, FITS } from '../services/taxonomy.js';
import { ShareButton } from '../components/ShareButton.jsx';
import { MoreMenu } from '../components/MoreMenu.jsx';
import { MessageService } from '../services/message-service.js';
import { shareOrDownloadImage } from '../services/share-service.js';
import { elapsedLabel, daysSince } from '../utils/elapsed.js';
import { useLocale } from '../hooks/useLocale.jsx';

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
  const [item, setItem] = useState(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState({});
  const [saving, setSaving] = useState(false);
  const [showOriginal, setShowOriginal] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const changeInputRef = useRef(null);

  useEffect(() => {
    if (!itemId) return;
    return onSnapshot(doc(db, 'items', itemId), snap => {
      const data = snap.exists() ? { id: snap.id, ...snap.data() } : null;
      setItem(data);
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

  if (!item) return <div className="loading"><div className="spinner" /></div>;
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
    // Listing fields are gated: forSale only takes effect with a numeric
    // asking price + a condition grade. If either is missing we warn and
    // keep the toggle off — saves the user from a half-formed listing.
    const wantsSale = !!draft.forSale;
    const askingNum = Number(draft.priceAsking);
    const originalNum = draft.priceOriginal === '' || draft.priceOriginal == null
      ? null : Number(draft.priceOriginal);
    if (wantsSale && (!Number.isFinite(askingNum) || askingNum <= 0)) {
      alert(t('saleNeedsAsking'));
      return;
    }
    if (wantsSale && !draft.conditionGrade) {
      alert(t('saleNeedsGrade'));
      return;
    }
    setSaving(true);
    try {
      await ItemService.updateItem(item.id, {
        name: draft.name,
        tags: draft.tags,
        forSale: wantsSale,
        priceOriginal: originalNum,
        priceAsking: wantsSale ? askingNum : null,
        conditionGrade: wantsSale ? draft.conditionGrade : null,
      });
      setEditing(false);
    } finally { setSaving(false); }
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
    <div className="item-viewer">
      <button
        type="button"
        className="item-viewer-close"
        onClick={close}
        aria-label={t('close')}
      >
        <X size={20} strokeWidth={1.8} />
      </button>

      <div
        className="item-viewer-stage"
        onClick={() => hasBoth && setShowOriginal(s => !s)}
        role={hasBoth ? 'button' : undefined}
        aria-label={hasBoth ? (showOriginal ? t('showProcessed') : t('showOriginal')) : undefined}
      >
        {cover
          ? <img src={cover} alt={item.name || ''} draggable={false} />
          : <div className="item-card-skeleton" />}
        {hasBoth && (
          <span className="item-viewer-toggle">
            {showOriginal ? t('before') : t('after')}
          </span>
        )}
      </div>

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
          url={`${window.location.origin}/i/${item.id}`}
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
          <MoreMenu
            className="item-rail-more"
            target={{ type: 'item', id: item.id }}
            targetUid={item.userId}
            user={user}
            onSignIn={onSignIn}
          />
        )}
        {isOwner && menuOpen && (
          <div className="item-rail-menu" onMouseLeave={() => setMenuOpen(false)}>
            <button type="button" onClick={() => { setMenuOpen(false); setEditing(true); }}>
              <Pencil size={14} strokeWidth={1.7} /> {t('editTags')}
            </button>
            <button type="button" onClick={() => { setMenuOpen(false); changeInputRef.current?.click(); }}>
              <ImageIcon size={14} strokeWidth={1.7} /> {t('changeProduct')}
            </button>
            <button type="button" onClick={() => { setMenuOpen(false); onSave(); }}>
              <Download size={14} strokeWidth={1.7} /> {t('saveImage')}
            </button>
            <button type="button" onClick={() => { setMenuOpen(false); ItemService.reprocessItem(item.id); }}>
              <RefreshCw size={14} strokeWidth={1.7} /> {t('reprocess')}
            </button>
            <button type="button" className="danger" onClick={() => { setMenuOpen(false); remove(); }}>
              <Trash2 size={14} strokeWidth={1.7} /> {t('delete')}
            </button>
            <input
              ref={changeInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={e => onChangeProduct(e.target.files?.[0])}
            />
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
            <SaleBlock t={t} draft={draft} setDraft={setDraft} />
            <div className="item-viewer-edit-actions">
              <button className="btn btn-secondary" onClick={() => setEditing(false)} disabled={saving}>{t('cancel')}</button>
              <button className="btn btn-primary" onClick={save} disabled={saving}>{saving ? t('saving') : t('save')}</button>
            </div>
          </div>
        ) : (
          <>
            <div className="item-viewer-meta">
              {item.tags?.category && (
                <span className="item-viewer-cat">{t(`taxonomy.categories.${item.tags.category}`)}</span>
              )}
              <h1 className="item-viewer-name">
                {item.name || t('untitledItem')}
                {item.forSale && item.priceAsking > 0 && (
                  <span className="item-sale-tags">
                    <span className="item-sale-price">
                      {t('salePriceCurrency')}{item.priceAsking.toLocaleString()}
                    </span>
                    {item.conditionGrade && (
                      <span className="item-sale-grade">{item.conditionGrade}</span>
                    )}
                  </span>
                )}
              </h1>
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
                onClick={async () => {
                  if (!user || user.isAnonymous) { onSignIn?.(); return; }
                  try {
                    const id = await MessageService.openThread({ sellerUid: item.userId, item });
                    navigate(`/messages/${id}`);
                  } catch (err) {
                    console.warn('open thread failed:', err.message);
                    alert(err.message);
                  }
                }}
              >
                {t('contactSeller')}
              </button>
            ) : null}
          </>
        )}
      </footer>
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
          <input
            type="text"
            className="tag-brand-input"
            value={tags?.brand || ''}
            onChange={e => set('brand', e.target.value.slice(0, 60))}
            placeholder={t('tagBrandPlaceholder')}
            maxLength={60}
          />
        ) : (
          <span className="tag-brand-display">
            {tags?.brand || <em className="muted">{t('tagBrandNone')}</em>}
          </span>
        )}
      </Row>
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

function SaleBlock({ t, draft, setDraft }) {
  const onToggle = (e) => setDraft({ ...draft, forSale: e.target.checked });
  const onNum = (key) => (e) => {
    // Strip non-digits, keep as string in draft so empty stays empty.
    const v = e.target.value.replace(/[^0-9]/g, '');
    setDraft({ ...draft, [key]: v });
  };
  return (
    <div className="sale-block">
      <label className="sale-toggle">
        <input type="checkbox" checked={!!draft.forSale} onChange={onToggle} />
        <span>{t('saleToggle')}</span>
      </label>
      {draft.forSale && (
        <div className="sale-fields">
          <div className="sale-price-row">
            <label className="sale-field">
              <span className="sale-field-label">{t('salePriceOriginal')}</span>
              <div className="sale-price-input">
                <span className="sale-currency">{t('salePriceCurrency')}</span>
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
                <span className="sale-currency">{t('salePriceCurrency')}</span>
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
