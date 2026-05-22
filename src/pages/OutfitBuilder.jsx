import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ItemService } from '../services/item-service.js';
import { OutfitService } from '../services/outfit-service.js';
import { useLocale } from '../hooks/useLocale.jsx';

export function OutfitBuilder({ user, onSignIn }) {
  const { t } = useLocale();
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [selected, setSelected] = useState(new Set());
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user || user.isAnonymous) return;
    return ItemService.subscribeMyCloset(user.uid, list => {
      setItems(list.filter(i => i.status === 'ready' && !i.isArchived));
    });
  }, [user]);

  if (!user || user.isAnonymous) {
    return (
      <div className="empty-state">
        <button className="btn btn-primary" onClick={onSignIn}>{t('signInGoogle')}</button>
      </div>
    );
  }

  const toggle = (id) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const save = async () => {
    if (selected.size === 0) return;
    setSaving(true);
    try {
      const { id } = await OutfitService.createOutfit({
        itemIds: Array.from(selected),
        name: name.trim(),
      });
      navigate(`/o/${id}`);
    } catch (err) {
      console.warn('createOutfit failed', err.message);
    } finally { setSaving(false); }
  };

  return (
    <div className="outfit-builder">
      <h2 className="section-title">{t('newOutfit')}</h2>

      <input
        className="rename-input"
        placeholder={t('outfitNamePlaceholder')}
        value={name}
        onChange={e => setName(e.target.value)}
        maxLength={60}
      />

      <p className="muted">{t('outfitPickHint', { n: selected.size })}</p>

      <div className="closet-grid">
        {items.map(it => {
          const isSel = selected.has(it.id);
          return (
            <button
              key={it.id}
              type="button"
              className={`item-card builder-pickable ${isSel ? 'selected' : ''}`}
              onClick={() => toggle(it.id)}
            >
              <div className="item-card-image">
                {it.croppedUrl || it.originalUrl
                  ? <img src={it.croppedUrl || it.originalUrl} alt="" loading="lazy" />
                  : <div className="item-card-skeleton" />}
                {isSel && <span className="item-card-badge"><i className="material-icons">check</i></span>}
              </div>
            </button>
          );
        })}
      </div>

      <div className="controls controls-sticky">
        <button
          className="btn btn-primary"
          onClick={save}
          disabled={saving || selected.size === 0}
        >
          {saving ? t('saving') : t('saveOutfit')}
        </button>
      </div>
    </div>
  );
}
