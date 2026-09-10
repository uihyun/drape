import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { analytics, logEvent } from '../firebase.js';
import { useLocale } from '../hooks/useLocale.jsx';
import { extractSharedUrl, fetchImportImage, setPendingImport } from '../services/share-import.js';

// Share landing (SPEC-1.6 §A): the OS share sheet opens /import?url=…&text=…
// (manifest share_target on web; native intents route here too in 2.0).
// We resolve the shared link to its main image server-side, stash the blob,
// and drop straight into the analyze flow the user already knows.
export function Import({ user, onSignIn }) {
  const { t } = useLocale();
  const navigate = useNavigate();
  const [search] = useSearchParams();
  const [state, setState] = useState('loading'); // loading | no_url | failed
  const ran = useRef(false);

  useEffect(() => {
    if (!user || user.isAnonymous) return;
    if (ran.current) return;
    ran.current = true;
    const url = extractSharedUrl({
      url: search.get('url'),
      text: search.get('text'),
      title: search.get('title'),
    });
    if (!url) { setState('no_url'); return; }
    logEvent(analytics, 'import_shared', { source: 'web', kind: 'url' });
    fetchImportImage(url)
      .then((entry) => {
        setPendingImport(entry);
        logEvent(analytics, 'import_image_ready', { source: 'web' });
        navigate('/analyze?shared=1', { replace: true });
      })
      .catch(() => setState('failed'));
  }, [user?.uid]);   // eslint-disable-line react-hooks/exhaustive-deps

  if (!user || user.isAnonymous) {
    return (
      <div className="page">
        <h1 className="page-h1">{t('importTitle')}</h1>
        <div className="empty-state empty-state-card">
          <p>{t('analyzeSignInBody')}</p>
          <button type="button" className="btn btn-primary" onClick={onSignIn}>{t('signIn')}</button>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <h1 className="page-h1">{t('importTitle')}</h1>
      {state === 'loading' && (
        <div className="empty-state"><Loader2 className="spin" size={22} /><p>{t('importLoading')}</p></div>
      )}
      {state !== 'loading' && (
        <div className="empty-state empty-state-card">
          <p>{t(state === 'no_url' ? 'importNoUrl' : 'importFailed')}</p>
          <button type="button" className="btn btn-primary" onClick={() => navigate('/analyze', { replace: true })}>
            {t('analyzeAPhoto')}
          </button>
        </div>
      )}
    </div>
  );
}

export default Import;
