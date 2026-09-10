import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sparkles, ThumbsUp, ThumbsDown, Loader2 } from 'lucide-react';
import { analytics, logEvent } from '../firebase.js';
import { useLocale } from '../hooks/useLocale.jsx';
import { ItemService } from '../services/item-service.js';
import { useStyleRecs, RECS_PER_DAY, useFits } from '../hooks/useFits.js';
import {
  StylistService, STYLIST_PERSONAS, getChosenPersona, setChosenPersona,
} from '../services/stylist-service.js';

// SPEC-1.6 §D — the stylist surface. Personas are explicitly-AI characters
// (initial-monogram avatars, no photoreal faces). Recommendations are free
// (server-capped/day); the try-on CTA is where fits get spent, unchanged.
export function Stylist({ user, onSignIn }) {
  const { t } = useLocale();
  const navigate = useNavigate();
  const [persona, setPersona] = useState(getChosenPersona());
  const [choosing, setChoosing] = useState(false);
  const [ask, setAsk] = useState('');
  const [busy, setBusy] = useState(false);
  const [rec, setRec] = useState(null);      // { recId, outfits, remaining }
  const [rated, setRated] = useState(null);  // 'up' | 'down' | null
  const [err, setErr] = useState('');
  const [closet, setCloset] = useState(null); // id → item (thumbnails)
  const recs = useStyleRecs(user); // live free-quota chip (server-enforced)
  const fits = useFits(user);      // shown once free recs are spent (1 rec = 1 fit)

  useEffect(() => {
    if (!user) return undefined;
    return ItemService.subscribeMyCloset(user.uid, (list) => {
      setCloset(Object.fromEntries(list.map((i) => [i.id, i])));
    });
  }, [user?.uid]);   // eslint-disable-line react-hooks/exhaustive-deps

  const personaMeta = useMemo(
    () => STYLIST_PERSONAS.find((p) => p.id === persona) || null,
    [persona],
  );

  if (!user || user.isAnonymous) {
    return (
      <div className="page">
        <h1 className="page-h1">{t('stylistTitle')}</h1>
        <div className="empty-state empty-state-card">
          <p>{t('stylistSignInBody')}</p>
          <button type="button" className="btn btn-primary" onClick={onSignIn}>{t('signIn')}</button>
        </div>
      </div>
    );
  }

  const pick = (id) => { setChosenPersona(id); setPersona(id); };

  const run = async () => {
    setBusy(true); setErr(''); setRec(null); setRated(null);
    try {
      const data = await StylistService.recommend({ persona, ask });
      setRec(data);
      logEvent(analytics, 'stylist_recommend', { persona });
    } catch (e) {
      const code = e?.code || '';
      if (code.includes('resource-exhausted')) setErr(t('stylistNoFits'));
      else if (code.includes('failed-precondition')) setErr(t('stylistClosetTooSmall'));
      else setErr(t('stylistError'));
    } finally {
      setBusy(false);
    }
  };

  const rate = (v) => {
    if (!rec) return;
    const next = rated === v ? null : v;
    setRated(next);
    StylistService.rateRec(rec.recId, next).catch(() => {});
    if (next) logEvent(analytics, 'stylist_feedback', { value: next });
  };

  const thumbOf = (id) => closet?.[id]?.croppedUrl || closet?.[id]?.originalUrl || null;

  return (
    <div className="page stylist-page">
      <h1 className="page-h1">{t('stylistTitle')} <span className="muted" style={{ fontSize: '0.6em', fontWeight: 400 }}>{t('stylistAiNote')}</span></h1>

      {/* No stylist picked (or changing): full-bleed 2×2 quadrant chooser —
          the four characters ARE the screen. Otherwise a compact header
          with the chosen face; tapping it reopens the chooser. */}
      {(!persona || choosing) ? (
        <>
          <p className="stylist-choose-title">{t('stylistChoose')}</p>
          <div className="stylist-quad">
            {STYLIST_PERSONAS.map((p) => (
              <button
                key={p.id}
                type="button"
                className="stylist-quad-cell"
                onClick={() => { pick(p.id); setChoosing(false); }}
              >
                <img src={p.img} alt={p.name} loading="lazy" />
                <span className="stylist-quad-label">
                  <strong>{p.name}</strong>
                  <em>{t(p.tagKey)}</em>
                </span>
              </button>
            ))}
          </div>
        </>
      ) : (
        <button type="button" className="stylist-chosen" onClick={() => setChoosing(true)}>
          <img src={personaMeta?.img} alt="" className="stylist-chosen-img" />
          <span className="stylist-chosen-meta">
            <strong>{personaMeta?.name}</strong>
            <em>{t(personaMeta?.tagKey)}</em>
          </span>
          <span className="stylist-chosen-change">{t('stylistChange')}</span>
        </button>
      )}

      {persona && !choosing && (
        <div className="stylist-askrow">
          <input
            value={ask}
            maxLength={120}
            placeholder={t('stylistAskPlaceholder')}
            onChange={(e) => setAsk(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !busy) run(); }}
          />
          <button type="button" className="btn btn-primary" onClick={run} disabled={busy}>
            {busy ? <Loader2 size={16} className="spin" /> : <Sparkles size={16} strokeWidth={1.8} />}
            {t('stylistRecommend')}
          </button>
        </div>
      )}
      {persona && !choosing && recs.loaded && (
        <p className="muted" style={{ fontSize: '0.8rem' }}>
          {recs.remaining > 0
            ? t('stylistRecsLeft', { left: recs.remaining, max: RECS_PER_DAY })
            : t('stylistPaidNote', { fits: fits.total })}
        </p>
      )}
      {err && <div className="empty-state"><p>{err}</p></div>}

      {rec?.outfits?.map((o, i) => (
        <section className="stylist-outfit" key={i}>
          <h3>{o.title}</h3>
          <div className="stylist-items">
            {o.itemIds.map((id) => (
              <div className="stylist-item" key={id} onClick={() => navigate(`/i/${id}`)}>
                {thumbOf(id)
                  ? <img src={thumbOf(id)} alt={closet?.[id]?.name || ''} loading="lazy" />
                  : <div className="stylist-item-ph" />}
                {closet?.[id]?.kind === 'wishlist' && <span className="stylist-wish">{t('stylistWishlistBadge')}</span>}
              </div>
            ))}
          </div>
          <p className="stylist-why">“{o.why}” <span className="muted">— {personaMeta?.name}</span></p>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => {
              logEvent(analytics, 'stylist_tryon', { persona });
              navigate(`/tryon?items=${o.itemIds.filter((id) => closet?.[id]).join(',')}`);
            }}
          >
            {t('stylistTryAll')}
          </button>
        </section>
      ))}

      {rec && (
        <div className="stylist-rate">
          <span>{t('stylistRateAsk')}</span>
          {['up', 'down'].map((v) => {
            const Icon = v === 'up' ? ThumbsUp : ThumbsDown;
            return (
              <button
                key={v}
                type="button"
                className="outfit-action-icon"
                aria-pressed={rated === v}
                style={rated === v ? { color: 'var(--accent, #141312)', background: 'var(--surface-elevated, #f1efe9)' } : undefined}
                onClick={() => rate(v)}
              >
                <Icon size={16} strokeWidth={1.7} />
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default Stylist;
