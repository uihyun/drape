import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { useLocale } from '../hooks/useLocale.jsx';
import { ProfileService } from '../services/profile-service.js';
import { STYLES, COLORS, COLOR_HEX, PERSONAL_COLORS } from '../services/taxonomy.js';

// Stated style preferences. Lives on the stylist page (owner, 2026-09-16):
// this setting exists FOR the stylist, so burying it in Settings hid it from
// the only screen where it means anything. Server validates against the
// closed taxonomy; these values outrank anything the stylist infers.
export function MyStyleEditor({ profile, onSaved }) {
  const { t } = useLocale();
  const server = profile?.stylePrefs || {};
  // null = untouched (mirrors the server); an array/string = pending edit.
  const [liked, setLiked] = useState(null);
  const [avoid, setAvoid] = useState(null);
  const [note, setNote] = useState(null);
  // undefined = untouched; null = explicitly cleared (nothing selected means unknown).
  const [personal, setPersonal] = useState(undefined);
  const [saving, setSaving] = useState(false);
  const [flash, setFlash] = useState(false);

  const likedV = liked ?? server.likedStyles ?? [];
  const avoidV = avoid ?? server.avoidColors ?? [];
  const noteV = note ?? server.note ?? '';
  const personalV = personal !== undefined ? personal : (server.personalColor ?? null);
  const dirty = liked != null || avoid != null || note != null || personal !== undefined;
  const toggle = (arr, v) => (arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);

  const save = async () => {
    setSaving(true);
    try {
      await ProfileService.updateStylePrefs({
        likedStyles: likedV, avoidColors: avoidV, note: noteV.trim(), personalColor: personalV,
      });
      setLiked(null); setAvoid(null); setNote(null); setPersonal(undefined);
      setFlash(true); setTimeout(() => setFlash(false), 1800);
      onSaved?.();
    } catch (e) {
      console.warn('stylePrefs save failed:', e?.message);
    } finally { setSaving(false); }
  };

  return (
    <div className="mystyle">
      <p className="mystyle-hint">{t('myStyleHint')}</p>

      <p className="mystyle-label">{t('myStyleLiked')}</p>
      <div className="mystyle-chips">
        {STYLES.map((s) => (
          <button
            key={s}
            type="button"
            className={`mystyle-chip${likedV.includes(s) ? ' on' : ''}`}
            onClick={() => setLiked(toggle(likedV, s))}
          >
            {t(`taxonomy.styles.${s}`)}
          </button>
        ))}
      </div>

      <p className="mystyle-label">{t('myStylePersonalColor')}</p>
      <p className="mystyle-hint">{t('myStylePersonalColorHint')}</p>
      <div className="mystyle-chips">
        {PERSONAL_COLORS.map((pc) => (
          <button
            key={pc}
            type="button"
            className={`mystyle-chip${personalV === pc ? ' on' : ''}`}
            aria-pressed={personalV === pc}
            onClick={() => setPersonal(personalV === pc ? null : pc)}
          >
            {t(`personalColor.${pc}`)}
          </button>
        ))}
      </div>

      <p className="mystyle-label">{t('myStyleAvoid')}</p>
      <div className="mystyle-chips">
        {COLORS.map((c) => (
          <button
            key={c}
            type="button"
            className={`mystyle-chip${avoidV.includes(c) ? ' on' : ''}`}
            onClick={() => setAvoid(toggle(avoidV, c))}
          >
            <i className="mystyle-dot" style={{ background: COLOR_HEX[c] || '#ccc' }} />
            {t(`taxonomy.colors.${c}`)}
          </button>
        ))}
      </div>

      <p className="mystyle-label">{t('myStyleNote')}</p>
      <textarea
        className="mystyle-note"
        rows={2}
        maxLength={500}
        value={noteV}
        placeholder={t('myStyleNotePlaceholder')}
        onChange={(e) => setNote(e.target.value)}
        disabled={saving}
      />

      <div className="mystyle-actions">
        <button type="button" className="btn btn-primary" onClick={save} disabled={!dirty || saving}>
          {saving && <Loader2 size={14} className="spin" />}
          {flash ? t('saved') : t('save')}
        </button>
      </div>
    </div>
  );
}

export default MyStyleEditor;
