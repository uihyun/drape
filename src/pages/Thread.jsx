import { useEffect, useRef, useState } from 'react';
import { Link, useParams, useNavigate, useLocation } from 'react-router-dom';
import { ChevronLeft, Send, ImagePlus, X } from 'lucide-react';
import { MessageService } from '../services/message-service.js';
import { ProfileService } from '../services/profile-service.js';
import { CameraService } from '../services/camera.js';
import { PushService } from '../services/push-service.js';
import { Avatar } from '../components/Avatar.jsx';
import { formatPrice } from '../utils/currency.js';
import { useLocale } from '../hooks/useLocale.jsx';

// Single conversation view. Top: item summary card linking back to the
// listing. Middle: messages bubbles (mine right-aligned). Bottom: send
// input. No typing indicators / read receipts in v1.
export function Thread({ user }) {
  const { t, lang } = useLocale();
  const { threadId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  // Thread metadata carried from "Contact seller" before the room exists.
  const seed = location.state?.draft || null;
  const [thread, setThread] = useState(undefined);
  // Whether the thread doc actually exists in Firestore yet. In draft mode
  // (buyer opened but hasn't sent) it's false — we render from `seed` and
  // create the room on the first message.
  const [created, setCreated] = useState(undefined);
  const [messages, setMessages] = useState([]);
  const [other, setOther] = useState(null);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [lightbox, setLightbox] = useState(null);
  const scrollRef = useRef(null);

  useEffect(() => {
    if (!threadId) return;
    let cancelled = false;
    MessageService.getThread(threadId)
      .then(doc => {
        if (cancelled) return;
        if (doc) { setThread(doc); setCreated(true); }
        else if (seed) { setThread(seed); setCreated(false); }
        else { setThread(null); setCreated(false); }
      })
      .catch(() => {
        // Missing thread → read denies. Fall back to the draft if we have one.
        if (cancelled) return;
        if (seed) { setThread(seed); setCreated(false); }
        else { setThread(null); setCreated(false); }
      });
    return () => { cancelled = true; };
  }, [threadId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Only stream messages / touch read+presence flags once the room exists —
  // before that there's nothing to read and writing would create an empty room.
  useEffect(() => {
    if (!threadId || !created) { setMessages([]); return; }
    return MessageService.subscribeMessages(threadId, setMessages);
  }, [threadId, created]);

  // Opening the conversation = reading it. Clear my unread badge on
  // mount and also whenever new messages arrive while I have it open.
  // Also drop any delivered push notifications for this thread from the tray.
  useEffect(() => {
    if (!threadId || !created || !user || user.isAnonymous) return;
    MessageService.markThreadRead(threadId);
    PushService.clearThreadNotifications(threadId);
  }, [threadId, created, user?.uid, messages.length]);

  // Presence flag → sendMessage uses it to skip bumping unread for the
  // other party while we're both watching the room. Tab-hide also
  // counts as "left" so a backgrounded tab still gets badges.
  useEffect(() => {
    if (!threadId || !created || !user || user.isAnonymous) return;
    MessageService.setActive(threadId, true);
    const onVisibility = () => {
      MessageService.setActive(threadId, !document.hidden);
      if (!document.hidden) MessageService.markThreadRead(threadId);
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      MessageService.setActive(threadId, false);
    };
  }, [threadId, created, user?.uid]);

  useEffect(() => {
    if (!thread || !user) return;
    const otherUid = thread.participants.find(p => p !== user.uid);
    if (!otherUid) return;
    // Paint from cache synchronously (no flash to "Unknown" on re-entry),
    // then refresh in the background.
    const cached = ProfileService.getCached(otherUid);
    if (cached) setOther(cached);
    ProfileService.getByUid(otherUid).then(p => p && setOther(p)).catch(() => {});
  }, [thread, user?.uid]);

  // Stick to the bottom whenever messages change — chat UX expectation.
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages.length]);

  const send = async () => {
    const text = draft.trim();
    if (!text || sending) return;
    setSending(true);
    setDraft('');
    try {
      if (!created) {
        // First message persists the room (then the recipient gets it in
        // their inbox + a push). ensureThread is idempotent.
        await MessageService.ensureThread(threadId, seed);
        setCreated(true);
      }
      await MessageService.sendMessage(threadId, text);
    } catch (err) {
      console.warn('send failed:', err.message);
      setDraft(text); // restore on failure
    } finally {
      setSending(false);
    }
  };

  const onKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  // Photo message — service recompresses before upload, so a raw camera
  // file is fine here. We keep `sending` true across the upload so the
  // composer disables and the user can't fire a second send mid-upload.
  const sendImage = async (file) => {
    if (!file || sending) return;
    setSending(true);
    try {
      if (!created) {
        await MessageService.ensureThread(threadId, seed);
        setCreated(true);
      }
      await MessageService.sendImage(threadId, file);
    } catch (err) {
      console.warn('image send failed:', err.message);
    } finally {
      setSending(false);
    }
  };

  if (thread === undefined) return <div className="loading"><div className="spinner" /></div>;
  if (thread === null) {
    return (
      <div className="empty-state">
        <p>{t('threadNotFound')}</p>
        <Link to="/messages" className="btn btn-secondary">{t('inboxTitle')}</Link>
      </div>
    );
  }

  return (
    <div className="thread">
      <header className="thread-head">
        <button type="button" className="thread-back" onClick={() => navigate(-1)} aria-label={t('back')}>
          <ChevronLeft size={20} strokeWidth={1.6} />
        </button>
        {/* Tap avatar / name to inspect the other party's profile —
            critical for vetting buyers and reporting from PublicProfile's
            ⋯ menu if the conversation goes sideways. */}
        <Link
          to={other?.handle ? `/u/${other.handle}` : '#'}
          className="thread-head-author"
          onClick={(e) => { if (!other?.handle) e.preventDefault(); }}
        >
          <Avatar src={other?.photoURL} name={other?.displayName || other?.handle} size={32} />
          <div className="thread-head-meta">
            <span className="thread-head-name">
              {other?.displayName || (other?.handle ? `@${other.handle}` : t('unknownUser'))}
            </span>
            {thread.itemName && <span className="thread-head-item">{thread.itemName}</span>}
          </div>
        </Link>
      </header>

      <Link to={`/i/${thread.itemId}`} className="thread-listing-card">
        {thread.itemCover && <img src={thread.itemCover} alt="" />}
        <div className="thread-listing-meta">
          <span className="thread-listing-name">{thread.itemName || t('untitledItem')}</span>
          {thread.priceAsking > 0 && (
            <span className="thread-listing-price">
              {formatPrice(thread.priceAsking, thread.currency)}
            </span>
          )}
        </div>
      </Link>

      <div className="thread-messages" ref={scrollRef}>
        {messages.length === 0 ? (
          <div className="thread-empty"><p>{t('threadEmptyHint')}</p></div>
        ) : (
          renderMessageStream(messages, user?.uid, lang, t, setLightbox)
        )}
      </div>

      <footer className="thread-input">
        <button
          type="button"
          className="thread-attach"
          onClick={async () => { const f = await CameraService.pickFromLibrary(); if (f) sendImage(f); }}
          disabled={sending}
          aria-label={t('sendPhoto')}
        >
          <ImagePlus size={20} strokeWidth={1.6} />
        </button>
        <textarea
          rows={1}
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onKeyDown={onKey}
          placeholder={t('threadInputPlaceholder')}
          maxLength={1000}
        />
        <button type="button" className="thread-send" onClick={send} disabled={!draft.trim() || sending} aria-label={t('send')}>
          <Send size={18} strokeWidth={1.6} />
        </button>
      </footer>

      {lightbox && (
        <div className="thread-lightbox" onClick={() => setLightbox(null)} role="dialog" aria-modal="true">
          <button type="button" className="thread-lightbox-close" aria-label={t('close')}>
            <X size={24} strokeWidth={1.7} />
          </button>
          <img src={lightbox} alt="" onClick={(e) => e.stopPropagation()} />
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------
// Message stream rendering — Instagram/iMessage-style timestamp grouping.
// Most messages render bare. We inject:
//   1. A centered "day header" before the first message of each new day
//      ("Today" / "Yesterday" / locale date).
//   2. A small time label after the last message of a burst — defined as
//      consecutive messages from the same sender within BURST_GAP_MS.
//      So a rapid back-and-forth shows one stamp per direction, not per
//      message.
// ---------------------------------------------------------------------

const BURST_GAP_MS = 5 * 60 * 1000; // 5 minutes

function startOfDay(ts) {
  const d = new Date(ts);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

function dayHeader(ts, lang, t) {
  const today = startOfDay(Date.now());
  const that = startOfDay(ts);
  const diffDays = Math.round((today - that) / 86400000);
  if (diffDays === 0) return t('today');
  if (diffDays === 1) return t('yesterday');
  return new Date(ts).toLocaleDateString(lang || undefined, {
    year: that < new Date(today).setMonth(new Date(today).getMonth() - 11) ? 'numeric' : undefined,
    month: 'short',
    day: 'numeric',
    weekday: 'short',
  });
}

function timeLabel(ts, lang) {
  return new Date(ts).toLocaleTimeString(lang || undefined, {
    hour: 'numeric',
    minute: '2-digit',
  });
}

function renderMessageStream(messages, myUid, lang, t, onImageClick) {
  const out = [];
  for (let i = 0; i < messages.length; i++) {
    const m = messages[i];
    const prev = messages[i - 1];
    const next = messages[i + 1];
    const ms = m.createdAt?.toMillis?.() ?? 0;
    const prevMs = prev?.createdAt?.toMillis?.() ?? 0;
    const nextMs = next?.createdAt?.toMillis?.() ?? 0;

    // Day separator at the top of each new day.
    if (!prev || startOfDay(ms) !== startOfDay(prevMs)) {
      out.push(
        <div key={`day-${m.id}`} className="thread-day">
          <span>{dayHeader(ms, lang, t)}</span>
        </div>
      );
    }

    const mine = m.fromUid === myUid;
    out.push(
      <div key={m.id} className={`thread-bubble${mine ? ' mine' : ''}${m.type === 'image' ? ' thread-bubble-img' : ''}`}>
        {m.type === 'image' && m.imageUrl
          ? (
            <img
              src={m.imageUrl}
              alt=""
              className="thread-img"
              loading="lazy"
              style={m.width && m.height ? { aspectRatio: `${m.width} / ${m.height}` } : undefined}
              onClick={() => onImageClick?.(m.imageUrl)}
            />
          )
          : m.text}
      </div>
    );

    // End-of-burst → emit a small time label aligned to that bubble's
    // side. End-of-burst = no next OR next is from a different sender
    // OR next is more than BURST_GAP_MS later.
    const endsBurst = !next
      || next.fromUid !== m.fromUid
      || (nextMs - ms) > BURST_GAP_MS;
    if (endsBurst && ms > 0) {
      out.push(
        <div key={`t-${m.id}`} className={`thread-time${mine ? ' mine' : ''}`}>
          {timeLabel(ms, lang)}
        </div>
      );
    }
  }
  return out;
}

export default Thread;
