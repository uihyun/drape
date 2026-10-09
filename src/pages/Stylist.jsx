import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bookmark, X, LayoutGrid, Loader2 } from 'lucide-react';
import { analytics, logEvent } from '../firebase.js';
import { useLocale } from '../hooks/useLocale.jsx';
import { ItemService } from '../services/item-service.js';
import { ProfileService } from '../services/profile-service.js';
import { MyStyleEditor } from '../components/MyStyleEditor.jsx';
import { StylistChat } from '../components/StylistChat.jsx';
import { BoardService } from '../services/board-service.js';
import { useFits } from '../hooks/useFits.js';
import {
  StylistService, STYLIST_PERSONAS, getChosenPersona, setChosenPersona,
} from '../services/stylist-service.js';

// SPEC-1.6 §D — the stylist surface. Personas are explicitly-AI characters
// (illustrated, never photoreal). Since 2026-10-08 the stylist is a chat
// (StylistChat): one thread per stylist per day, 0–2 outfits per reply. The
// try-on CTA is still where fits get spent. Saved looks come in pages.
const PAGE = 3;

export function Stylist({ user, onSignIn }) {
  const { t } = useLocale();
  const navigate = useNavigate();
  const [persona, setPersona] = useState(getChosenPersona());
  const [choosing, setChoosing] = useState(false);
  const [closet, setCloset] = useState(null); // id → item (thumbnails)
  const [profile, setProfile] = useState(null);
  const [styleOpen, setStyleOpen] = useState(false);
  const [saved, setSaved] = useState([]);        // looks kept from past recs
  const [shown, setShown] = useState(PAGE);      // "show more" window
  const fits = useFits(user);      // shown once free chat messages are spent
  const [boardBusy, setBoardBusy] = useState(null);   // saved-look id being turned into a board
  const [boardNote, setBoardNote] = useState(null);   // { id, text } — e.g. still processing

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

  // Looks the user kept from the chat live in their own savedLooks list —
  // a day's thread scrolls into the archive, a saved look stays here.
  useEffect(() => {
    if (!user || user.isAnonymous) { setSaved([]); return undefined; }
    // Read one page ahead of what's rendered so "show more" is instant.
    return StylistService.subscribeSavedLooks(user.uid, setSaved, { max: shown + PAGE });
  }, [user?.uid, shown]);   // eslint-disable-line react-hooks/exhaustive-deps

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

  const tryOnLook = (itemIds, source) => {
    logEvent(analytics, 'stylist_tryon', { persona, source });
    navigate(`/tryon?items=${itemIds.filter((id) => closet?.[id]).join(',')}&from=stylist`);
  };

  const thumbOf = (id) => closet?.[id]?.croppedUrl || closet?.[id]?.originalUrl || null;

  // A saved stylist look → a board (2026-10-08): its closet pieces on the same
  // clean grid as an outfit's board. Linked both ways via savedLook.boardId,
  // so the second tap opens it. Pieces still being processed are waited for.
  const lookToBoard = async (l) => {
    if (l.boardId) {
      const existing = await BoardService.getBoard(l.boardId).catch(() => null);
      if (existing) { navigate(`/boards/${existing.id}`); return; }
    }
    const ids = (l.itemIds || []).filter((id) => closet?.[id] && !closet[id].isArchived);
    if (ids.some((id) => closet[id].status !== 'ready')) { setBoardNote({ id: l.id, text: t('boardWaitExtract') }); return; }
    setBoardBusy(l.id);
    try {
      const { id } = await BoardService.createBoard({ name: l.title || '', stickers: BoardService.gridStickers(ids), coverUrl: BoardService.coverFor(ids.map((x) => closet[x])) });
      await StylistService.setLookBoard(user.uid, l.id, id);
      logEvent(analytics, 'stylist_look_board', { persona: l.persona });
      navigate(`/boards/${id}`);
    } catch (e) {
      console.warn('look board failed', e?.message);
    } finally { setBoardBusy(null); }
  };

  return (
    <div className="page stylist-page">
      <h1 className="page-h1">{t('stylistTitle')} <span className="muted" style={{ fontSize: '0.6em', fontWeight: 400 }}>{t('stylistAiNote')}</span></h1>

      {/* No stylist picked (or changing): full-bleed 2×2 quadrant chooser —
          the four characters ARE the screen. Otherwise a compact header
          with the chosen face; tapping it reopens the chooser. */}
      {(!persona || choosing) ? (
        <>
          <p className="stylist-choose-title">{t('stylistChoose')}</p>
          <div className="stylist-quad" data-tour="stylist-pick">
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
        /* The two-word tag is enough to pick between four faces; once you're
           inside with one of them it says nothing about how they'll style you.
           The bio is first person, so the card reads as the stylist talking. */
        <button type="button" className="stylist-chosen" data-tour="stylist-pick" onClick={() => setChoosing(true)}>
          <span className="stylist-chosen-top">
            <img src={personaMeta?.img} alt="" className="stylist-chosen-img" />
            <span className="stylist-chosen-meta">
              <strong>{personaMeta?.name}</strong>
              <em>{t(personaMeta?.tagKey)}</em>
            </span>
            <span className="stylist-chosen-change">{t('stylistChange')}</span>
          </span>
          <span className="stylist-chosen-bio">{t(personaMeta?.bioKey)}</span>
        </button>
      )}

      {/* Stated preferences live HERE, not in Settings — this is the only
          screen where they do anything. Opens by itself the first time
          (nothing saved yet) and collapses to a link once it's filled in. */}
      {persona && !choosing && (() => {
        const prefs = profile?.stylePrefs;
        const empty = !prefs || (!(prefs.likedStyles || []).length
          && !(prefs.avoidColors || []).length && !(prefs.note || '').trim()
          && !prefs.personalColor);
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
      {persona && !choosing && personaMeta && (
        <StylistChat key={persona} user={user} persona={personaMeta} closet={closet} saved={saved} fits={fits} weatherOn={profile?.weatherOn !== false} />
      )}

      {/* Saved looks — the stylist's picks the user kept. The comment is
          half the value, so it's stored and replayed with the look; try-on
          can be re-run later against a different reference photo. */}
      {(() => {
        // The persona picker above doubles as the filter: a stylist's page
        // shows that stylist's picks. Looks kept under another persona stay
        // put — a one-liner says so instead of letting them seem deleted.
        // On a stylist's page the archive narrows to that stylist. On the
        // chooser screen there is no stylist in context, so it shows
        // everything — that's also the only place to reach looks saved
        // under a persona you no longer use.
        const filtered = choosing || !persona;
        const mine = filtered ? saved : saved.filter((l) => l.persona === persona);
        const others = filtered ? 0 : saved.length - mine.length;
        if (!saved.length) return null;
        if (!mine.length) {
          return (
            <section className="stylist-saved">
              <p className="tmag-kicker">{t('stylistSavedTitle')}</p>
              <p className="stylist-guide">{t('stylistSavedOther', { n: others })}</p>
            </section>
          );
        }
        return (
        <section className="stylist-saved">
          <p className="tmag-kicker">{t('stylistSavedTitle')}</p>
          {mine.slice(0, shown).map((l) => {
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
                      {closet?.[id]?.kind === 'wishlist' && (
                        <span className="stylist-wish" aria-label={t('itemKindWishlist')} title={t('itemKindWishlist')}>
                          <Bookmark size={10} strokeWidth={2.4} fill="currentColor" />
                        </span>
                      )}
                    </div>
                  ))}
                </div>
                {l.why && <p className="stylist-why">{l.why}</p>}
                <div className="stylist-savedacts">
                  <button
                    type="button"
                    className="btn btn-secondary"
                    disabled={live.length < 2}
                    onClick={() => tryOnLook(l.itemIds, 'saved')}
                  >
                    {t(live.length < 2 ? 'stylistSavedGone' : 'stylistTryAgain')}
                  </button>
                  {live.length >= 2 && (
                    <button
                      type="button"
                      className="btn btn-secondary stylist-boardbtn"
                      onClick={() => lookToBoard(l)}
                      disabled={boardBusy === l.id}
                      aria-label={t(l.boardId ? 'boardOpen' : 'boardFromOutfit')}
                      title={t(l.boardId ? 'boardOpen' : 'boardFromOutfit')}
                    >
                      {boardBusy === l.id ? <Loader2 size={15} className="spin" /> : <LayoutGrid size={15} strokeWidth={1.8} />}
                      {t(l.boardId ? 'boardOpen' : 'boardFromOutfit')}
                    </button>
                  )}
                </div>
                {boardNote?.id === l.id && <p className="stylist-guide">{boardNote.text}</p>}
              </article>
            );
          })}
          {(mine.length > shown || saved.length >= shown + PAGE) && (
            <button type="button" className="btn btn-secondary stylist-more" onClick={() => setShown(shown + PAGE)}>
              {t('stylistSavedMore')}
            </button>
          )}
          {others > 0 && <p className="stylist-guide">{t('stylistSavedOther', { n: others })}</p>}
        </section>
        );
      })()}

    </div>
  );
}

export default Stylist;
