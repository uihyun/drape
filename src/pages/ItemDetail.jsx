import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { doc, onSnapshot } from 'firebase/firestore';
import { X, Sparkles, MoreHorizontal, Pencil, RefreshCw, Trash2, Layers } from 'lucide-react';
import { db } from '../firebase.js';
import { ItemService } from '../services/item-service.js';
import { CATEGORIES, COLORS, SEASONS, STYLES, FITS } from '../services/taxonomy.js';
import { ShareButton } from '../components/ShareButton.jsx';
import { useLocale } from '../hooks/useLocale.jsx';

// Full-screen single-item viewer modeled on Image 24:
// - photo dominates (white bg, contain) — tap to toggle Before/After
// - X top-left, share / more / try-on side rail on the right
// - bottom bar: category + name, expandable into the tag editor
//
// The legacy stacked layout is preserved for screens > 768px where the
// editor lives below the hero.
export function ItemDetail({ user }) {
  const { t } = useLocale();
  const { itemId } = useParams();
  const navigate = useNavigate();
  const [item, setItem] = useState(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState({});
  const [saving, setSaving] = useState(false);
  const [showOriginal, setShowOriginal] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    if (!itemId) return;
    return onSnapshot(doc(db, 'items', itemId), snap => {
      const data = snap.exists() ? { id: snap.id, ...snap.data() } : null;
      setItem(data);
      if (data && !editing) setDraft({ name: data.name || '', tags: data.tags || {} });
    });
  }, [itemId, editing]);

  if (!item) return <div className="loading"><div className="spinner" /></div>;
  const isOwner = user && item.userId === user.uid;
  if (!isOwner) {
    return <div className="empty-state"><p>{t('notFound')}</p></div>;
  }

  const hasBoth = item.originalUrl && item.croppedUrl && item.originalUrl !== item.croppedUrl;
  const cover = showOriginal && item.originalUrl
    ? item.originalUrl
    : (item.croppedUrl || item.originalUrl);

  const close = () => {
    if (window.history.length > 1) navigate(-1);
    else navigate('/profile/closet');
  };

  const save = async () => {
    setSaving(true);
    try {
      await ItemService.updateItem(item.id, { name: draft.name, tags: draft.tags });
      setEditing(false);
    } finally { setSaving(false); }
  };

  const remove = async () => {
    if (!confirm(t('confirmDeleteItem'))) return;
    await ItemService.deleteItem(item.id);
    navigate('/profile/closet');
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
        <Link to={`/tryon?items=${item.id}`} className="item-rail-btn" aria-label={t('tryThisOn')}>
          <Sparkles size={20} strokeWidth={1.6} />
        </Link>
        <ShareButton
          className="item-rail-btn item-rail-share"
          title={item.name || t('untitledItem')}
          text={item.tags?.category ? t(`taxonomy.categories.${item.tags.category}`) : ''}
          url={`${window.location.origin}/i/${item.id}`}
          label=""
        />
        <button
          type="button"
          className="item-rail-btn"
          onClick={() => setMenuOpen(o => !o)}
          aria-label={t('more')}
        >
          <MoreHorizontal size={20} strokeWidth={1.6} />
        </button>
        {menuOpen && (
          <div className="item-rail-menu" onMouseLeave={() => setMenuOpen(false)}>
            <button type="button" onClick={() => { setMenuOpen(false); setEditing(true); }}>
              <Pencil size={14} strokeWidth={1.7} /> {t('editTags')}
            </button>
            <button type="button" onClick={() => { setMenuOpen(false); ItemService.reprocessItem(item.id); }}>
              <RefreshCw size={14} strokeWidth={1.7} /> {t('reprocess')}
            </button>
            <button type="button" className="danger" onClick={() => { setMenuOpen(false); remove(); }}>
              <Trash2 size={14} strokeWidth={1.7} /> {t('delete')}
            </button>
          </div>
        )}
      </aside>

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
                <span className="item-viewer-cat">{t(`taxonomy.categories.${item.tags.category}`)}</span>
              )}
              <h1 className="item-viewer-name">{item.name || t('untitledItem')}</h1>
            </div>
            <button
              type="button"
              className="item-viewer-edit-toggle"
              onClick={() => setEditing(true)}
              aria-label={t('editTags')}
            >
              <Layers size={16} strokeWidth={1.7} />
            </button>
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
