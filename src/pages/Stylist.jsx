import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sparkles, ThumbsUp, ThumbsDown, Loader2, Bookmark, X } from 'lucide-react';
import { analytics, logEvent } from '../firebase.js';
import { useLocale } from '../hooks/useLocale.jsx';
import { ItemService } from '../services/item-service.js';
import { stylistWarm } from '../services/uiCache.js';
import { ProfileService } from '../services/profile-service.js';
import { MyStyleEditor } from '../components/MyStyleEditor.jsx';
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
  const [ask, setAsk] = useState(warm?.ask || '');
  const [busy, setBusy] = useState(false);
  const warm = user ? stylistWarm.get(user.uid) : null;
  const [rec, setRec] = useState(warm?.rec || null);      // { recId, outfits, remaining }
  const [rated, setRated] = useState(warm?.rated || null); // 'up' | 'down' | null
  const [err, setErr] = useState('');
  const [closet, setCloset] = useState(null); // id → item (thumbnails)
  const recs = useStyleRecs(user); // live free-quota chip (server-enforced)
  const [profile, setProfile] = useState(null);
  const [styleOpen, setStyleOpen] = useState(false);
  const [saved, setSaved] = useState([]);        // looks kept from past recs
  const [savedKeys, setSavedKeys] = useState(warm?.savedKeys || {}); // rec-outfit index → saved doc id
  const fits = useFits(user);      // shown once free recs are spent (1 rec = 1 fit)

  useEffect(() => {
    if (!user) return undefined;
    return ItemService.subscribeMyCloset(user.uid, (list) => {
      setCloset(Object.fromEntries(list.map((i) => [i.id, i])));
    });
  }, [user?.uid]);   // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!user || user.isAnonymous) { setProfile(null); return undefined; }
    return ProfileService.subscribeByUid(user.uid, setProfile);
  }, [user?.uid]);   // eslint-disable-line react-hooks/exhaustive-deps

  // A recommendation is replaced by the next "Style me", so anything the
  // user wants to keep lives in their own savedLooks list.
  useEffect(() => {
    if (!user || user.isAnonymous) { setSaved([]); return undefined; }
    return StylistService.subscribeSavedLooks(user.uid, setSaved);
  }, [user?.uid]);   // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!user?.uid) return;
    if (rec) stylistWarm.set(user.uid, { rec, savedKeys, rated, ask });
  }, [user?.uid, rec, savedKeys, rated, ask]);

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
    setBusy(true); setErr(''); setRec(null); setRated(null); setSavedKeys({});
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

  const toggleSave = async (o, i) => {
    const existing = savedKeys[i];
    try {
      if (existing) {
        await StylistService.unsaveLook(user.uid, existing);
        setSavedKeys((m) => { const n = { ...m }; delete n[i]; return n; });
      } else {
        const id = await StylistService.saveLook(user.uid, {
          persona, title: o.title, why: o.why, itemIds: o.itemIds, ask: ask || '',
        });
        setSavedKeys((m) => ({ ...m, [i]: id }));
        logEvent(analytics, 'stylist_look_saved', { persona });
      }
    } catch (e) { console.warn('save look failed', e?.message); }
  };

  const tryOnLook = (itemIds, source) => {
    logEvent(analytics, 'stylist_tryon', { persona, source });
    navigate(`/tryon?items=${itemIds.filter((id) => closet?.[id]).join(',')}`);
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
      {/* Stated preferences live HERE, not in Settings — this is the only
          screen where they do anything. Opens by itself the first time
          (nothing saved yet) and collapses to a link once it's filled in. */}
      {persona && !choosing && (() => {
        const prefs = profile?.stylePrefs;
        const empty = !prefs || (!(prefs.likedStyles || []).length
          && !(prefs.avoidColors || []).length && !(prefs.note || '').trim());
        const open = styleOpen || empty;
        return (
          <section className="stylist-style">
            <button
              type="button"
              className="stylist-styletoggle"
              onClick={() => setStyleOpen(!open)}
              aria-expanded={open}
            >
              <span className="tmag-kicker">{t('myStyleTitle')}</span>
              <span className="stylist-styletoggle-act">{t(open ? 'close' : 'stylistGuideLink')}</span>
            </button>
            {open
              ? <MyStyleEditor profile={profile} onSaved={() => setStyleOpen(false)} />
              : <p className="stylist-guide">{t('stylistGuide')}</p>}
          </section>
        );
      })()}
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
          <p className="stylist-why">{o.why}</p>
          <div className="stylist-cardacts">
            <button type="button" className="btn btn-primary" onClick={() => tryOnLook(o.itemIds, 'rec')}>
              {t('stylistTryAll')}
            </button>
            <button
              type="button"
              className={`btn btn-secondary${savedKeys[i] ? ' is-saved' : ''}`}
              onClick={() => toggleSave(o, i)}
            >
              <Bookmark size={15} strokeWidth={1.8} fill={savedKeys[i] ? 'currentColor' : 'none'} />
              {t(savedKeys[i] ? 'stylistSaved' : 'stylistSave')}
            </button>
          </div>
        </section>
      ))}

      {/* Saved looks — the stylist's picks the user kept. The comment is
          half the value, so it's stored and replayed with the look; try-on
          can be re-run later against a different reference photo. */}
      {saved.length > 0 && (
        <section className="stylist-saved">
          <p className="tmag-kicker">{t('stylistSavedTitle')}</p>
          {saved.map((l) => {
            const p = STYLIST_PERSONAS.find((x) => x.id === l.persona) || STYLIST_PERSONAS[0];
            const live = (l.itemIds || []).filter((id) => closet?.[id]);
            return (
              <article className="stylist-savedcard" key={l.id}>
                <header>
                  <img src={p.img} alt="" />
                  <div>
                    <strong>{l.title}</strong>
                    <span>{p.name}{l.ask ? ` · ${l.ask}` : ''}</span>
                  </div>
                  <button
                    type="button"
                    className="stylist-savedrm"
                    aria-label={t('delete')}
                    onClick={() => StylistService.unsaveLook(user.uid, l.id).catch(() => {})}
                  >
                    <X size={14} strokeWidth={2} />
                  </button>
                </header>
                <div className="stylist-items">
                  {(l.itemIds || []).map((id) => (
                    <div className="stylist-item" key={id} onClick={() => closet?.[id] && navigate(`/i/${id}`)}>
                      {thumbOf(id)
                        ? <img src={thumbOf(id)} alt="" loading="lazy" />
                        : <div className="stylist-item-ph" />}
                    </div>
                  ))}
                </div>
                {l.why && <p className="stylist-why">{l.why}</p>}
                <button
                  type="button"
                  className="btn btn-secondary"
                  disabled={live.length < 2}
                  onClick={() => tryOnLook(l.itemIds, 'saved')}
                >
                  {t(live.length < 2 ? 'stylistSavedGone' : 'stylistTryAgain')}
                </button>
              </article>
            );
          })}
        </section>
      )}

      {rec && (
        <div className="stylist-rate">
          <span>{t('stylistRateAsk')}</span>
          {['up', 'down'].map((v) => {
            const Icon = v === 'up' ? ThumbsUp : ThumbsDown;
            return (
              <button
                key={v}
                type="button"
                className={`outfit-action-icon${rated === v ? ' thumb-on' : ''}`}
                aria-pressed={rated === v}
                onClick={() => rate(v)}
              >
                <Icon size={16} strokeWidth={rated === v ? 2.2 : 1.7} />
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default Stylist;
