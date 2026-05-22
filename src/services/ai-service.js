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

// Default model tiers. Cloud Functions honour these but may downgrade if
// the user's plan caps cost, or upgrade for tough cases (low-light identity
// refs, complex layered outfit composites).
export const MODELS = {
  // Identity-preserving image generation (try-on, hair/lip/makeup, scene
  // background). "Nano Banana Pro" — gemini-3-pro-image-preview.
  imagePro:   'gemini-3-pro-image-preview',
  // Fast/cheap variant for previews + minor variations. "Nano Banana 2".
  imageFlash: 'gemini-3-flash-image-preview',
  // Vision tagging — extracts category/color/style from a clothing photo.
  visionPro:  'gemini-3-pro-preview',
  visionFlash:'gemini-3-flash-preview',
};

async function logError(error, context = {}) {
  try {
    const user = auth.currentUser;
    await addDoc(collection(db, 'errorLogs'), {
      message: error?.message || String(error),
      stack: error?.stack || null,
      context,
      userId: user?.uid || null,
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
