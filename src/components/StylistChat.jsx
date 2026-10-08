import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowUp, Bookmark, ThumbsUp, ThumbsDown, ChevronLeft, ChevronDown } from 'lucide-react';
import { analytics, logEvent } from '../firebase.js';
import { useLocale } from '../hooks/useLocale.jsx';
import { StylistService, localDayKey } from '../services/stylist-service.js';
import { WeatherService } from '../services/weather-service.js';
import { useWeatherPlace, useDailyWeather } from '../hooks/useWeather.js';
import { useStyleChatQuota } from '../hooks/useFits.js';
import { WeatherBadge } from './WeatherIcon.jsx';
import { WeatherPlacePicker } from './WeatherPlacePicker.jsx';

// The stylist as a conversation (owner, 2026-10-08) — replaces the one-shot
// "Style me" button. One thread per stylist per day; earlier days are a
// read-only archive. The stylist answers in its own voice and attaches 0–2
// outfits from the closet, rendered here from item ids (the model never
// writes card content). Layout borrowed from posture's Darwin coach.
const CHIPS = ['stylistChipToday', 'stylistChipWork', 'stylistChipDate', 'stylistChipWeekend'];
const latelyMemo = new Map(); // `${uid}:${lang}` → text, per app session

export function StylistChat({ user, persona, closet, saved, fits, weatherOn = true }) {
  const { t, lang } = useLocale();
  const navigate = useNavigate();
  const uid = user.uid;
  const today = localDayKey();
  const [viewDay, setViewDay] = useState(today);      // archive opens a past day here
  const [messages, setMessages] = useState(null);
  const [pending, setPending] = useState(null);       // optimistic user text while waiting
  const [text, setText] = useState('');
  const [err, setErr] = useState('');
  const [rated, setRated] = useState({});             // recId → 'up' | 'down'
  const [archive, setArchive] = useState(null);       // null = closed
  const [lately, setLately] = useState(() => latelyMemo.get(`${uid}:${lang}`) || '');
  const [wxOpen, setWxOpen] = useState(false);
  const quota = useStyleChatQuota(user);
  const wx = useWeatherPlace(user, { autoLocate: true, enabled: weatherOn });
  const todayWx = useDailyWeather(wx.place, today, today)[today];
  const endRef = useRef(null);
  const isToday = viewDay === today;

  useEffect(() => {
    setMessages(null);
    return StylistService.subscribeThread(uid, persona.id, viewDay, setMessages);
  }, [uid, persona.id, viewDay]);

  useEffect(() => {
    const key = `${uid}:${lang}`;
    if (latelyMemo.has(key)) { setLately(latelyMemo.get(key)); return; }
    StylistService.lately()
      .then((l) => { latelyMemo.set(key, l); setLately(l); })
      .catch(() => {});
  }, [uid, lang]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages?.length, pending]);

  // Drop the optimistic bubble once the server's copy has arrived.
  useEffect(() => {
    if (pending && messages?.some((m) => m.role === 'user' && m.text === pending)) setPending(null);
  }, [messages, pending]);

  const send = async (raw) => {
    const msg = (raw ?? text).trim();
    if (!msg || pending) return;
    setErr('');
    setText('');
    setPending(msg);
    try {
      await StylistService.chat({ persona: persona.id, text: msg });
      logEvent(analytics, 'stylist_chat', { persona: persona.id });
    } catch (e) {
      setPending(null);
      setText(msg);
      const code = e?.code || '';
      setErr(t(code.includes('resource-exhausted') ? 'stylistNoFits' : 'stylistError'));
    }
  };

  const savedFor = (o) => saved.find((l) => (l.itemIds || []).join(',') === o.itemIds.join(','));
  const toggleSave = async (o, ask) => {
    const existing = savedFor(o);
    try {
      if (existing) await StylistService.unsaveLook(uid, existing.id);
      else {
        await StylistService.saveLook(uid, { persona: persona.id, title: o.title, why: o.why, itemIds: o.itemIds, ask: ask || '' });
        logEvent(analytics, 'stylist_look_saved', { persona: persona.id });
      }
    } catch (e) { console.warn('save look failed', e?.message); }
  };
  const rate = (recId, v) => {
    if (!recId) return;
    const next = rated[recId] === v ? null : v;
    setRated((m) => ({ ...m, [recId]: next }));
    StylistService.rateRec(recId, next).catch(() => {});
    if (next) logEvent(analytics, 'stylist_feedback', { value: next });
  };
  const tryOn = (itemIds) => {
    logEvent(analytics, 'stylist_tryon', { persona: persona.id, source: 'chat' });
    navigate(`/tryon?items=${itemIds.filter((id) => closet?.[id]).join(',')}&from=stylist`);
  };
  const thumbOf = (id) => closet?.[id]?.croppedUrl || closet?.[id]?.originalUrl || null;

  const openArchive = async () => {
    if (archive) { setArchive(null); return; }
    setArchive([]);
    try { setArchive(await StylistService.listArchive(uid, persona.id, { exclude: today })); }
    catch { setArchive([]); }
  };
  const dayLabel = (key) => {
    const [y, m, d] = key.split('-').map(Number);
    return new Date(y, m - 1, d).toLocaleDateString(lang, { month: 'long', day: 'numeric', weekday: 'short' });
  };

  const list = useMemo(() => {
    const base = messages || [];
    return pending ? [...base, { id: 'pending', role: 'user', text: pending }] : base;
  }, [messages, pending]);
  // The message before each stylist reply — saved looks keep the ask.
  const askBefore = (i) => (list[i - 1]?.role === 'user' ? list[i - 1].text : '');
  const unit = WeatherService.tempUnit(wx.place);
  const outOfFree = quota.loaded && quota.remaining === 0 && quota.extra === 0;

  return (
    <section className="schat">
      {isToday ? (
        <div className="schat-day">
          <div className="schat-dayhead">
            <span className="schat-daylabel">{t('stylistToday')}</span>
            {weatherOn && todayWx && (
              <span className="schat-daywx">
                <WeatherBadge day={todayWx} unit={unit} size={13} />
                {wx.place?.label && <span className="schat-dayplace">{wx.place.label}</span>}
              </span>
            )}
            {weatherOn && wx.place === null && !wx.locating && (
              <button type="button" className="schat-wxset" onClick={() => setWxOpen(!wxOpen)}>{t('wxSetCity')}</button>
            )}
          </div>
          {wxOpen && wx.place === null && <WeatherPlacePicker wx={wx} showWhy onDone={() => setWxOpen(false)} />}
          {lately && <p className="schat-lately">{lately}</p>}
        </div>
      ) : (
        <button type="button" className="schat-back" onClick={() => setViewDay(today)}>
          <ChevronLeft size={16} /> {t('stylistBackToday')}
          <span className="schat-backday">{dayLabel(viewDay)}</span>
        </button>
      )}

      <div className="schat-list">
        {messages && list.length === 0 && isToday && (
          <div className="schat-msg schat-msg--stylist">
            <img src={persona.img} alt="" className="schat-avatar" />
            <div className="schat-col">
              <span className="schat-name">{persona.name}</span>
              <div className="schat-bubble"><p>{t('stylistChatEmpty')}</p></div>
            </div>
          </div>
        )}
        {list.map((m, i) => (m.role === 'user' ? (
          <div key={m.id} className="schat-msg schat-msg--user">
            <div className="schat-bubble"><p>{m.text}</p></div>
          </div>
        ) : (
          // KakaoTalk-style: avatar + name at the TOP of the turn, then the
          // reply and each look as their own bubbles stacked under the name.
          <div key={m.id} className="schat-msg schat-msg--stylist">
            <img src={persona.img} alt="" className="schat-avatar" />
            <div className="schat-col">
              <span className="schat-name">{persona.name}</span>
              <div className="schat-bubble"><p>{m.text}</p></div>
              {(m.outfits || []).map((o, k) => {
                const isSaved = !!savedFor(o);
                return (
                  <div className="schat-bubble schat-look" key={k}>
                    <strong className="schat-looktitle">{o.title}</strong>
                    <div className="stylist-items">
                      {o.itemIds.map((id) => (
                        <div className="stylist-item" key={id} onClick={() => closet?.[id] && navigate(`/i/${id}`)}>
                          {thumbOf(id) ? <img src={thumbOf(id)} alt={closet?.[id]?.name || ''} loading="lazy" /> : <div className="stylist-item-ph" />}
                          {closet?.[id]?.kind === 'wishlist' && (
                            <span className="stylist-wish" aria-label={t('itemKindWishlist')}><Bookmark size={10} strokeWidth={2.4} fill="currentColor" /></span>
                          )}
                        </div>
                      ))}
                    </div>
                    {o.why && <p className="stylist-why">{o.why}</p>}
                    <div className="schat-lookacts">
                      <button type="button" className="btn btn-primary btn-sm" onClick={() => tryOn(o.itemIds)}>{t('stylistTryAll')}</button>
                      <button type="button" className={`btn btn-secondary btn-sm${isSaved ? ' is-saved' : ''}`} onClick={() => toggleSave(o, askBefore(i))}>
                        <Bookmark size={14} strokeWidth={1.8} fill={isSaved ? 'currentColor' : 'none'} />
                        {t(isSaved ? 'stylistSaved' : 'stylistSave')}
                      </button>
                    </div>
                  </div>
                );
              })}
              {m.recId && (
                <div className="schat-rate">
                  {['up', 'down'].map((v) => {
                    const Icon = v === 'up' ? ThumbsUp : ThumbsDown;
                    const on = rated[m.recId] === v;
                    return (
                      <button key={v} type="button" className={`schat-ratebtn${on ? ' on' : ''}`} aria-pressed={on} aria-label={v} onClick={() => rate(m.recId, v)}>
                        <Icon size={14} strokeWidth={on ? 2.2 : 1.7} />
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )))}
        {pending && (
          <div className="schat-msg schat-msg--stylist">
            <img src={persona.img} alt="" className="schat-avatar" />
            <div className="schat-col">
              <span className="schat-name">{persona.name}</span>
              <div className="schat-bubble schat-typing" aria-live="polite">
                <span className="schat-dots"><i /><i /><i /></span>
                <span className="schat-typinglabel">{t('stylistTyping', { name: persona.name })}</span>
              </div>
            </div>
          </div>
        )}
        <div ref={endRef} />
      </div>

      {isToday && (
        <>
          {err && <p className="schat-err">{err}</p>}
          {list.length === 0 && (
            <div className="schat-chips">
              {CHIPS.map((k) => (
                <button key={k} type="button" className="schat-chip" onClick={() => send(t(k))} disabled={!!pending}>{t(k)}</button>
              ))}
            </div>
          )}
          {quota.loaded && (quota.remaining <= 3 || outOfFree) && (
            <p className="schat-quota">
              {quota.remaining > 0
                ? t('stylistChatLeft', { left: quota.remaining })
                : t('stylistChatPaid', { fits: fits.total })}
            </p>
          )}
          <form className="schat-input" onSubmit={(e) => { e.preventDefault(); send(); }}>
            <textarea
              rows={1}
              value={text}
              maxLength={400}
              placeholder={t('stylistChatPlaceholder', { name: persona.name })}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); send(); } }}
              disabled={!!pending}
            />
            <button type="submit" className="schat-send" disabled={!text.trim() || !!pending} aria-label={t('stylistChatSend')}>
              <ArrowUp size={18} strokeWidth={2.2} />
            </button>
          </form>
        </>
      )}

      <div className="schat-archive">
        <button type="button" className="schat-archivebtn" onClick={openArchive} aria-expanded={!!archive}>
          {t('stylistArchive')}
          <ChevronDown size={14} style={{ transform: archive ? 'rotate(180deg)' : 'none' }} />
        </button>
        {archive && (archive.length === 0
          ? <p className="stylist-guide">{t('stylistArchiveEmpty')}</p>
          : (
            <ul className="schat-archivelist">
              {archive.map((d) => (
                <li key={d.id}>
                  <button type="button" onClick={() => { setViewDay(d.dayKey); setArchive(null); window.scrollTo({ top: 0 }); }}>
                    <span className="schat-archiveday">{dayLabel(d.dayKey)}</span>
                    <span className="schat-archivefirst">{d.firstMessage || ''}</span>
                  </button>
                </li>
              ))}
            </ul>
          ))}
      </div>
    </section>
  );
}

export default StylistChat;
