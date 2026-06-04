import { Link } from 'react-router-dom';
import { Mail, ShieldCheck, FileText, ChevronRight } from 'lucide-react';
import { useLocale } from '../hooks/useLocale.jsx';

const SUPPORT_EMAIL = 'hello@uhzlab.com';

// Support page — same card layout / type scale as Settings so the two read
// as one family instead of a bare email link on an empty white page.
export function Support() {
  const { t } = useLocale();
  const version = (typeof __APP_VERSION__ !== 'undefined' && __APP_VERSION__) || '1.0.0';

  const row = (icon, label, props) => (
    <span className="settings-row-label">
      {icon}
      {label}
    </span>
  );

  return (
    <div className="settings">
      <h1 className="settings-h1">{t('support')}</h1>

      <section className="settings-card">
        <h2 className="settings-h2">{t('supportContactTitle')}</h2>
        <p className="settings-hint">{t('supportReply')}</p>
        <a className="settings-row settings-row-action" href={`mailto:${SUPPORT_EMAIL}`}>
          {row(<Mail size={15} strokeWidth={1.8} style={{ marginRight: 7, verticalAlign: -2 }} />, SUPPORT_EMAIL)}
          <ChevronRight size={16} strokeWidth={1.5} className="muted" />
        </a>
      </section>

      <section className="settings-card">
        <h2 className="settings-h2">{t('supportLegalTitle')}</h2>
        <Link className="settings-row settings-row-action" to="/privacy">
          {row(<ShieldCheck size={15} strokeWidth={1.8} style={{ marginRight: 7, verticalAlign: -2 }} />, t('privacyPolicy'))}
          <ChevronRight size={16} strokeWidth={1.5} className="muted" />
        </Link>
        <Link className="settings-row settings-row-action" to="/terms">
          {row(<FileText size={15} strokeWidth={1.8} style={{ marginRight: 7, verticalAlign: -2 }} />, t('termsOfService'))}
          <ChevronRight size={16} strokeWidth={1.5} className="muted" />
        </Link>
      </section>

      <p className="support-version">drape v{version}</p>
    </div>
  );
}

export default Support;
