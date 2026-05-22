import { useState } from 'react';
import { AuthService } from '../services/auth-service.js';
import { useLocale } from '../hooks/useLocale.jsx';

// 구독 관련 경고는 실제로 active subscription 이 있을 때만 표시.
// - hasWebSubscription: Stripe 구독 active (deleteAccount 가 자동 cancel)
// - hasAppleSubscription: Apple IAP 구독 active (앱이 못 끔 → 사용자 안내 필요)
// 둘 다 false 면 안내문 자체 안 보여서 free 사용자가 혼란스러워 하지 않음.
export function DeleteAccountModal({ onClose, onDeleted, hasWebSubscription = false, hasAppleSubscription = false }) {
  const { t } = useLocale();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleDelete = async () => {
    if (submitting) return;
    setSubmitting(true);
    setError('');
    try {
      await AuthService.deleteAccount();
      onDeleted?.();
    } catch (err) {
      console.warn('deleteAccount failed:', err);
      setError(t('deleteAccountError'));
      setSubmitting(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={submitting ? undefined : onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3>{t('deleteAccountTitle')}</h3>
        <p className="delete-account-desc">{t('deleteAccountWarn')}</p>
        <ul className="delete-account-list">
          <li>{t('deleteAccountItem_closet')}</li>
          <li>{t('deleteAccountItem_profile')}</li>
          <li>{t('deleteAccountItem_social')}</li>
          <li>{t('deleteAccountItem_credits')}</li>
        </ul>
        {(hasWebSubscription || hasAppleSubscription) && (
          <p className="delete-account-billing">
            {hasAppleSubscription && t('deleteAccountBilling_ios')}
            {hasAppleSubscription && hasWebSubscription && ' '}
            {hasWebSubscription && t('deleteAccountBilling_web')}
          </p>
        )}
        <p className="delete-account-final">{t('deleteAccountFinal')}</p>
        {error && <p className="report-error">{error}</p>}
        <div className="report-actions">
          <button
            type="button"
            className="btn btn-secondary"
            onClick={onClose}
            disabled={submitting}
          >
            {t('cancel')}
          </button>
          <button
            type="button"
            className="btn btn-danger"
            onClick={handleDelete}
            disabled={submitting}
          >
            {submitting ? t('deleteAccountSubmitting') : t('deleteAccountConfirm')}
          </button>
        </div>
      </div>
    </div>
  );
}
