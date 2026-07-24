// /get — the QR-code landing bridge. The landing page's QR encodes
// https://drape.nyc/get; a phone scanning it lands here and bounces straight
// to its own store. Desktop (or anything unrecognized) falls back to /landing.
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { analytics, logEvent } from '../firebase.js';

const APP_STORE = 'https://apps.apple.com/app/id6775511709';
const PLAY = 'https://play.google.com/store/apps/details?id=com.uihyun.drape';

export function Get() {
  const navigate = useNavigate();
  useEffect(() => {
    const ua = navigator.userAgent || '';
    const target = /iPhone|iPad|iPod/i.test(ua) ? 'app_store'
      : /Android/i.test(ua) ? 'play'
        : null;
    logEvent(analytics, 'get_redirect', { target: target || 'landing' });
    if (target === 'app_store') window.location.replace(APP_STORE);
    else if (target === 'play') window.location.replace(PLAY);
    else navigate('/landing', { replace: true });
  }, [navigate]);
  return <div className="loading"><div className="spinner" /></div>;
}

export default Get;
