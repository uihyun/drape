import { useLocale } from '../hooks/useLocale.jsx';

// Minimal alert dialog: a message + a single confirm button. Replaces inline
// red error text / native alert() so a failure reads as a deliberate, in-app
// modal the user dismisses on purpose.
export function AlertModal({ open, title, message, onClose, actionLabel, onAction }) {
  const { t } = useLocale();
  if (!open) return null;
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal alert-modal"
        onClick={(e) => e.stopPropagation()}
        role="alertdialog"
        aria-modal="true"
      >
        {title && <h3>{title}</h3>}
        <p className="alert-modal-msg">{message}</p>
        <div className="alert-modal-actions">
          {actionLabel && onAction && (
            <button type="button" className="btn btn-primary" onClick={onAction}>
              {actionLabel}
            </button>
          )}
          <button
            type="button"
            className={`btn ${actionLabel && onAction ? 'btn-secondary' : 'btn-primary'}`}
            onClick={onClose}
          >
            {actionLabel && onAction ? t('close') : t('ok')}
          </button>
        </div>
      </div>
    </div>
  );
}

export default AlertModal;
