import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { X } from 'lucide-react';
import { ProfileService, HANDLE_RE } from '../services/profile-service.js';
import { useLocale } from '../hooks/useLocale.jsx';

// First-time handle claim modal. Appears on Profile when profile.handle
// is empty (new account, no username yet). Soft-dismissable — the user
// can skip and claim later in Settings, but the modal will reappear on
// every Profile visit until claimed because @handle is the primary
// identifier across the app (feed cards, /u/:handle links).
export function ClaimHandleModal({ open, onClose }) {
  const { t } = useLocale();
  const navigate = useNavigate();
  const [handle, setHandle] = useState('');
  const [err, setErr] = useState(null);
  const [busy, setBusy] = useState(false);

  if (!open) return null;

  const valid = HANDLE_RE.test(handle);

  const submit = async () => {
    if (!valid || busy) return;
    setBusy(true); setErr(null);
    try {
      await ProfileService.claimHandle(handle.trim().toLowerCase());
      onClose?.();
    } catch (e) {
      setErr(e.code === 'HANDLE_TAKEN' ? t('handleTaken') : (e.message || 'Failed'));
    } finally { setBusy(false); }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-box claim-handle-modal"
        onClick={e => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <button
          type="button"
          className="claim-handle-close"
          onClick={onClose}
          aria-label={t('close')}
        >
          <X size={18} strokeWidth={1.7} />
        </button>

        <h2 className="claim-handle-title">{t('claimHandlePrompt')}</h2>
        <p className="claim-handle-body">{t('handleHint')}</p>

        <div className="claim-handle-input-row">
          <span className="settings-input-prefix">@</span>
          <input
            className="settings-input"
            value={handle}
            onChange={e => setHandle(e.target.value.toLowerCase())}
            placeholder={t('handlePlaceholder')}
            maxLength={20}
            autoCapitalize="none"
            autoCorrect="off"
            autoFocus
            onKeyDown={e => { if (e.key === 'Enter') submit(); }}
          />
        </div>

        {err && <p className="settings-error" style={{ margin: '0.5rem 0' }}>{err}</p>}

        <div className="claim-handle-actions">
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => { onClose?.(); navigate('/settings'); }}
            disabled={busy}
          >
            {t('later')}
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={submit}
            disabled={!valid || busy}
          >
            {busy ? t('saving') : t('claim')}
          </button>
        </div>
      </div>
    </div>
  );
}

export default ClaimHandleModal;
