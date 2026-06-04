import { useEffect, useState } from 'react';
import { isNativeApp } from '../services/platform-service.js';

// Cross-platform splash that runs in the WebView. Native iOS shows a static
// LaunchScreen with the same solid base background; this component fades
// in once Capacitor calls SplashScreen.hide().

export function JsSplash() {
  const [phase, setPhase] = useState('enter');

  useEffect(() => {
    // Hide the native splash so the JS one can take over the same canvas.
    // Native builds only — @vite-ignore keeps vite from trying to resolve
    // the module at build time when @capacitor/splash-screen isn't installed.
    if (isNativeApp()) {
      import(/* @vite-ignore */ '@capacitor/splash-screen')
        .then(({ SplashScreen }) => SplashScreen.hide({ fadeOutDuration: 200 }).catch(() => {}))
        .catch(() => {});
    }

    const exitTimer = setTimeout(() => setPhase('exit'), 2800);
    const doneTimer = setTimeout(() => setPhase('done'), 3200);
    return () => {
      clearTimeout(exitTimer);
      clearTimeout(doneTimer);
    };
  }, []);

  if (phase === 'done') return null;

  return (
    <div className={`js-splash ${phase === 'exit' ? 'js-splash-exit' : ''}`} aria-hidden="true">
      <div className="js-splash-mark">
        {/* The wordmark IS the Didot-italic 'drape' (rasterized so the font is
            guaranteed on every platform, not just where Didot is installed). */}
        <img className="js-splash-wordmark-img" src="/wordmark.png" alt="drape" />
        <svg className="js-splash-line" width="172" height="3" viewBox="0 0 172 3" aria-hidden="true">
          <line x1="1.5" y1="1.5" x2="170.5" y2="1.5" stroke="#2E4A3A" strokeWidth="3" strokeLinecap="round" />
        </svg>
        <p className="js-splash-tagline">CLOSET · AI</p>
      </div>
    </div>
  );
}
