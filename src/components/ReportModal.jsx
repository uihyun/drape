import { useState } from 'react';
import { createPortal } from 'react-dom';
import { addDoc, collection, doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db, logEvent, analytics } from '../firebase.js';
import { useLocale } from '../hooks/useLocale.jsx';

export const REPORT_REASONS = ['spam', 'nsfw', 'copyright', 'other'];

// Generic reporting modal. Pass `target = { type: 'outfit' | 'item', id }`.
// Doc id is `${uid}_${type}_${id}` so a single user can only file one report
// per target (rule enforces). Counter aggregation lives in moderation.js.
export function ReportModal({ target, user, onClose }) {
  const { t } = useLocale();
  const [reason, setReason] = useState('spam');
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  if (!target?.type || !target?.id || !user || user.isAnonymous) return null;

  const submit = async () => {
    setSubmitting(true);
    try {
      const id = `${user.uid}_${target.type}_${target.id}`;
      await setDoc(doc(db, 'reports', id), {
        reporterId: user.uid,
        targetType: target.type,
        targetId: target.id,
        reason,
        note: (note || '').slice(0, 280),
        createdAt: serverTimestamp(),
      });
      logEvent(analytics, 'report_submitted', { targetType: target.type, reason });
      setSubmitted(true);
    } catch (err) {
      console.warn('report submit failed:', err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return createPortal(
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={e => e.stopPropagation()}>
        <h3>{t('reportTitle')}</h3>
        {submitted ? (
          <>
            <p style={{ color: 'var(--text-secondary)', marginTop: '0.5rem' }}>{t('reportThanks')}</p>
            <div className="controls" style={{ marginTop: '1rem' }}>
              <button className="btn btn-primary" onClick={onClose}>{t('close')}</button>
            </div>
          </>
        ) : (
          <>
            <p style={{ color: 'var(--text-secondary)', marginTop: '0.5rem' }}>{t('reportDesc')}</p>
            <div style={{ display: 'grid', gap: '0.5rem', marginTop: '1rem' }}>
              {REPORT_REASONS.map(r => (
                <label key={r} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <input type="radio" name="reason" value={r} checked={reason === r} onChange={() => setReason(r)} />
                  <span>{t(`reportReason_${r}`)}</span>
                </label>
              ))}
            </div>
            <textarea
              className="custom-style-textarea"
              placeholder={t('reportNotePlaceholder')}
              value={note}
              onChange={e => setNote(e.target.value)}
              rows={2}
              maxLength={280}
              style={{ marginTop: '0.75rem' }}
            />
            <div className="controls" style={{ marginTop: '1rem' }}>
              <button className="btn btn-primary" onClick={submit} disabled={submitting}>
                {submitting ? t('submitting') : t('submit')}
              </button>
              <button className="btn btn-secondary" onClick={onClose}>{t('cancel')}</button>
            </div>
          </>
        )}
      </div>
    </div>,
    document.body,
  );
}

export default ReportModal;
