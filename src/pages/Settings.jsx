import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { IdentityService } from '../services/identity-service.js';
import { CameraService } from '../services/camera.js';
import { useLocale, LANG_LABELS } from '../hooks/useLocale.jsx';

// One settings page rather than five voda-era pages. Identity ref management
// + sign-in/out + language + legal links live here. Plan / billing UI lands
// in a later phase once RevenueCat keys are provisioned.
export function Settings({ user, onSignIn, onSignOut }) {
  const { t, lang, setLang } = useLocale();
  const [refs, setRefs] = useState([]);
  const [adding, setAdding] = useState(false);
  const fileInput = useRef();

  useEffect(() => {
    if (!user || user.isAnonymous) return;
    IdentityService.getMyRefs().then(setRefs);
  }, [user]);

  const onAdd = async (file) => {
    if (!file) return;
    setAdding(true);
    try {
      const blob = await CameraService.compressImage(file);
      const next = await IdentityService.addRef(blob);
      setRefs(next);
    } catch (err) {
      alert(err.message);
    } finally { setAdding(false); }
  };

  const onRemove = async (idx) => {
    const next = await IdentityService.removeRef(idx);
    setRefs(next);
  };

  return (
    <div className="settings">
      <h2 className="section-title">{t('settings')}</h2>

      <section className="settings-section">
        <h3>{t('account')}</h3>
        {user && !user.isAnonymous ? (
          <>
            <p>{user.displayName || user.email}</p>
            <button className="btn btn-secondary" onClick={onSignOut}>
              <i className="material-icons">logout</i> {t('signOut')}
            </button>
          </>
        ) : (
          <button className="btn btn-primary" onClick={onSignIn}>
            <i className="material-icons">login</i> {t('signInGoogle')}
          </button>
        )}
      </section>

      {user && !user.isAnonymous && (
        <section className="settings-section">
          <h3>{t('identityRefsTitle')}</h3>
          <p className="muted">{t('identityRefsHint', { max: IdentityService.MAX_IDENTITY_REFS })}</p>
          <div className="identity-refs">
            {refs.map((r, i) => (
              <div key={i} className="identity-ref">
                <img src={r.url} alt="" />
                <button className="slot-remove" onClick={() => onRemove(i)} aria-label={t('remove')}>
                  <i className="material-icons">close</i>
                </button>
              </div>
            ))}
            {refs.length < IdentityService.MAX_IDENTITY_REFS && (
              <button
                className="identity-ref identity-ref-add"
                onClick={() => fileInput.current?.click()}
                disabled={adding}
              >
                <i className="material-icons">add</i>
                <span>{adding ? t('uploading') : t('addRef')}</span>
                <input
                  ref={fileInput}
                  type="file"
                  accept="image/jpeg,image/jpg,image/png,image/webp,image/heic,image/heif"
                  className="hidden"
                  onChange={e => onAdd(e.target.files?.[0])}
                />
              </button>
            )}
          </div>
        </section>
      )}

      <section className="settings-section">
        <h3>{t('language')}</h3>
        <select value={lang} onChange={e => setLang(e.target.value)} className="lang-select">
          {Object.entries(LANG_LABELS).map(([code, label]) => (
            <option key={code} value={code}>{label}</option>
          ))}
        </select>
      </section>

      <section className="settings-section">
        <h3>{t('legal')}</h3>
        <ul className="settings-links">
          <li><Link to="/privacy">{t('privacy')}</Link></li>
          <li><Link to="/terms">{t('terms')}</Link></li>
          <li><Link to="/support">{t('support')}</Link></li>
        </ul>
      </section>
    </div>
  );
}
