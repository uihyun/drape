import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Check, Plus } from 'lucide-react';
import { ItemService } from '../services/item-service.js';
import { OutfitService } from '../services/outfit-service.js';
import { useLocale } from '../hooks/useLocale.jsx';

// Pick items from the closet, name the outfit, save. Empty closet now
// gets a real CTA so first-time users know what to do.
export function OutfitBuilder({ user, onSignIn }) {
  const { t } = useLocale();
  const navigate = useNavigate();
  const [items, setItems] = useState(null);
  const [selected, setSelected] = useState(new Set());
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user || user.isAnonymous) { setItems([]); return; }
    return ItemService.subscribeMyCloset(user.uid, list => {
      setItems(list.filter(i => i.status === 'ready' && !i.isArchived));
    });
  }, [user]);

  if (!user || user.isAnonymous) {
    return (
      <div className="page">
        <h1 className="page-h1">{t('newOutfit')}</h1>
        <div className="empty-state">
          <p>{t('outfitSignInBody')}</p>
          <button className="btn btn-primary" onClick={onSignIn}>{t('signIn')}</button>
        </div>
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
      const ids = Array.from(selected);
      const cover = items.find(i => i.id === ids[0])?.croppedUrl || items.find(i => i.id === ids[0])?.originalUrl || null;
      const { id } = await OutfitService.createOutfit({
        itemIds: ids,
        caption: name.trim(),
        coverUrl: cover,
      });
      navigate(`/o/${id}`);
    } catch (err) {
      console.warn('createOutfit failed', err.message);
    } finally { setSaving(false); }
  };

  return (
    <div className="page outfit-builder">
      <h1 className="page-h1">{t('newOutfit')}</h1>

      <input
        className="page-input"
        placeholder={t('outfitNamePlaceholder')}
        value={name}
        onChange={e => setName(e.target.value)}
        maxLength={60}
      />

      {items === null ? (
        <div className="loading"><div className="spinner" /></div>
      ) : items.length === 0 ? (
        <div className="empty-state empty-state-card">
          <p>{t('outfitBuilderEmpty')}</p>
          <Link to="/closet/add" className="btn btn-primary">
            <Plus size={16} strokeWidth={1.8} /> {t('addItem')}
          </Link>
        </div>
      ) : (
        <>
          <p className="builder-hint">{t('outfitPickHint', { n: selected.size })}</p>
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
                    {isSel && (
                      <span className="item-card-check">
                        <Check size={14} strokeWidth={2.4} />
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>

          <div className="builder-cta">
            <button
              type="button"
              className="btn btn-primary"
              onClick={save}
              disabled={saving || selected.size === 0}
            >
              {saving ? t('saving') : `${t('saveOutfit')}${selected.size > 0 ? ` · ${selected.size}` : ''}`}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
