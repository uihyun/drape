import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase.js';
import { ItemService } from '../services/item-service.js';
import { CATEGORIES, COLORS, SEASONS, STYLES, FITS } from '../services/taxonomy.js';
import { useLocale } from '../hooks/useLocale.jsx';

export function ItemDetail({ user }) {
  const { t } = useLocale();
  const { itemId } = useParams();
  const navigate = useNavigate();
  const [item, setItem] = useState(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState({});
  const [saving, setSaving] = useState(false);

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

  const cover = item.croppedUrl || item.originalUrl;

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
    navigate('/closet');
  };

  return (
    <div className="item-detail">
      <div className="item-detail-image">
        {cover ? <img src={cover} alt={item.name || ''} /> : <div className="item-card-skeleton" />}
      </div>

      <div className="item-detail-body">
        {editing ? (
          <input
            className="rename-input"
            value={draft.name}
            onChange={e => setDraft({ ...draft, name: e.target.value })}
            placeholder={t('itemNamePlaceholder')}
            maxLength={80}
          />
        ) : (
          <h2>{item.name || t('untitledItem')}</h2>
        )}

        <TagsBlock t={t} tags={editing ? draft.tags : item.tags} editing={editing} onChange={tags => setDraft({ ...draft, tags })} />

        <div className="controls">
          {editing ? (
            <>
              <button className="btn btn-primary" onClick={save} disabled={saving}>{saving ? t('saving') : t('save')}</button>
              <button className="btn btn-secondary" onClick={() => setEditing(false)}>{t('cancel')}</button>
            </>
          ) : (
            <>
              <Link to={`/tryon?items=${item.id}`} className="btn btn-primary">
                <i className="material-icons">face_retouching_natural</i>
                {t('tryThisOn')}
              </Link>
              <button className="btn btn-secondary" onClick={() => setEditing(true)}>
                <i className="material-icons">edit</i>
                {t('editTags')}
              </button>
              <button className="btn btn-secondary" onClick={() => ItemService.reprocessItem(item.id)}>
                <i className="material-icons">refresh</i>
                {t('reprocess')}
              </button>
              <button className="btn btn-secondary danger-btn" onClick={remove}>
                <i className="material-icons">delete</i>
                {t('delete')}
              </button>
            </>
          )}
        </div>
      </div>
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
