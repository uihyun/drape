import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLocale } from '../hooks/useLocale.jsx';
import { isIOS } from '../services/platform-service.js';
import { AuthService } from '../services/auth-service.js';

export function CreditModal({ open, onClose, onSignInRequest }) {
  const { t } = useLocale();
  const navigate = useNavigate();
  // App Store policy: hide pricing CTAs on iOS until IAP ships.
  const hidePayments = isIOS();
  // Guest 는 결제 메뉴 대신 로그인 CTA 가 우선. 익명 상태에서 Pro/Pack/Invite
  // 보여줘봐야 모두 결국 로그인 게이트로 막힘 — confusion 만 늘림.
  const current = AuthService.currentUser;
  const isGuest = !current || current.isAnonymous;

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === 'Escape') onClose?.(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const goto = (path) => {
    onClose?.();
    navigate(path);
  };

  const signIn = () => {
    onClose?.();
    onSignInRequest?.();
  };

  const options = isGuest
    ? [
        {
          icon: 'login',
          title: t('creditOptionSignIn'),
          desc: t('creditOptionSignInDesc'),
          onClick: signIn,
          highlight: true,
        },
      ]
    : [
        !hidePayments && {
          icon: 'workspace_premium',
          title: t('creditOptionPro'),
          desc: t('creditOptionProDesc'),
          onClick: () => goto('/pricing'),
        },
        !hidePayments && {
          icon: 'local_mall',
          title: t('creditOptionPack'),
          desc: t('creditOptionPackDesc'),
          onClick: () => goto('/pricing'),
        },
        {
          icon: 'group_add',
          title: t('creditOptionInvite'),
          desc: t('creditOptionInviteDesc'),
          onClick: () => goto('/invite'),
        },
      ].filter(Boolean);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card credit-modal" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close-btn" onClick={onClose} aria-label="Close">
          <i className="material-icons">close</i>
        </button>
        <h3 className="credit-modal-title">
          {isGuest ? t('creditModalGuestTitle') : t('creditModalTitle')}
        </h3>
        <p className="credit-modal-desc">
          {isGuest ? t('creditModalGuestDesc') : t('creditModalDesc')}
        </p>

        <ul className="credit-options">
          {options.map((opt) => {
            const Tag = opt.onClick ? 'button' : 'div';
            return (
              <li key={opt.title} className="credit-option-wrap">
                <Tag
                  type={opt.onClick ? 'button' : undefined}
                  className={`credit-option${opt.onClick ? ' credit-option-clickable' : ''}${opt.highlight ? ' credit-option-highlight' : ''}`}
                  onClick={opt.onClick}
                  disabled={!opt.onClick && undefined}
                >
                  <i className="material-icons credit-option-icon">{opt.icon}</i>
                  <div className="credit-option-body">
                    <div className="credit-option-title">
                      <span className="credit-option-title-text">{opt.title}</span>
                      {opt.comingSoon && (
                        <span className="credit-option-tag">{t('comingSoon')}</span>
                      )}
                    </div>
                    <div className="credit-option-desc">{opt.desc}</div>
                  </div>
                  {opt.onClick && (
                    <i className="material-icons credit-option-chevron">chevron_right</i>
                  )}
                </Tag>
              </li>
            );
          })}
        </ul>

        {!isGuest && (
          <p className="credit-daily-hint">
            <i className="material-icons">auto_awesome</i>
            {t('dailyBonusHint')}
          </p>
        )}
      </div>
    </div>
  );
}
