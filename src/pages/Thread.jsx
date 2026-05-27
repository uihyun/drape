import { useEffect, useRef, useState } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { ChevronLeft, Send } from 'lucide-react';
import { MessageService } from '../services/message-service.js';
import { ProfileService } from '../services/profile-service.js';
import { Avatar } from '../components/Avatar.jsx';
import { formatPrice } from '../utils/currency.js';
import { useLocale } from '../hooks/useLocale.jsx';

// Single conversation view. Top: item summary card linking back to the
// listing. Middle: messages bubbles (mine right-aligned). Bottom: send
// input. No typing indicators / read receipts in v1.
export function Thread({ user }) {
  const { t } = useLocale();
  const { threadId } = useParams();
  const navigate = useNavigate();
  const [thread, setThread] = useState(undefined);
  const [messages, setMessages] = useState([]);
  const [other, setOther] = useState(null);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const scrollRef = useRef(null);

  useEffect(() => {
    if (!threadId) return;
    MessageService.getThread(threadId)
      .then(t => setThread(t || null))
      .catch(() => setThread(null));
  }, [threadId]);

  useEffect(() => {
    if (!threadId) return;
    return MessageService.subscribeMessages(threadId, setMessages);
  }, [threadId]);

  useEffect(() => {
    if (!thread || !user) return;
    const otherUid = thread.participants.find(p => p !== user.uid);
    if (!otherUid) return;
    ProfileService.getByUid(otherUid).then(setOther).catch(() => setOther(null));
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
        <Avatar src={other?.photoURL} name={other?.displayName || other?.handle} size={32} />
        <div className="thread-head-meta">
          <span className="thread-head-name">
            {other?.displayName || (other?.handle ? `@${other.handle}` : t('unknownUser'))}
          </span>
          {thread.itemName && <span className="thread-head-item">{thread.itemName}</span>}
        </div>
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
          messages.map(m => (
            <div key={m.id} className={`thread-bubble${m.fromUid === user?.uid ? ' mine' : ''}`}>
              {m.text}
            </div>
          ))
        )}
      </div>

      <footer className="thread-input">
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
    </div>
  );
}

export default Thread;
