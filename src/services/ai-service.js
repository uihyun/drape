// === AIService =========================================================
// Thin client wrapper around the drape Cloud Functions endpoints. Gemini
// access is server-side only — the API key never reaches the browser.
//
// The real work — processItem (background-remove + auto-tag), virtualTryOn,
// stylePreview — runs inside Cloud Functions. The browser triggers
// callables (see item-service.js + generation-service.js); results come
// back through Firestore listeners.

import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db, auth } from '../firebase.js';
import { isNativeApp } from './platform-service.js';

// Cache the app version once so error logs are attributable to a build
// (e.g. "1.2.2(11)" native vs "web"). App.getInfo() reads the actual binary,
// so no manual version sync is needed here — bumping the native build is enough.
let _appVersion = isNativeApp() ? 'native?' : 'web';
if (isNativeApp()) {
  import('@capacitor/app')
    .then(({ App }) => App.getInfo())
    .then((info) => { _appVersion = `${info.version}(${info.build})`; })
    .catch(() => { _appVersion = 'native?'; });
}

// Default model tiers. Cloud Functions honour these but may downgrade if
// the user's plan caps cost, or upgrade for tough cases (low-light identity
// refs, complex layered outfit composites).
export const MODELS = {
  // Identity-preserving image generation (try-on, hair/lip/makeup, scene
  // background). "Nano Banana Pro" — gemini-3-pro-image.
  imagePro:   'gemini-3-pro-image',
  // Vision — category/color/style extraction, OOTD/try-on analysis, moderation.
  visionFlash:'gemini-3.5-flash',
};

async function logError(error, context = {}) {
  try {
    const user = auth.currentUser;
    await addDoc(collection(db, 'errorLogs'), {
      message: error?.message || String(error),
      stack: error?.stack || null,
      context,
      userId: user?.uid || null,
      appVersion: _appVersion,
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : null,
      url: typeof window !== 'undefined' ? window.location.href : null,
      createdAt: serverTimestamp(),
    });
  } catch (logErr) {
    console.warn('logError write failed:', logErr?.message);
  }
}

export const AIService = {
  MODELS,
  logError,
};

export default AIService;
