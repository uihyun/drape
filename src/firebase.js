import { initializeApp } from 'firebase/app';
import { getAnalytics, logEvent as _firebaseLogEvent, setUserId as _firebaseSetUserId } from 'firebase/analytics';
import { getAuth, initializeAuth, indexedDBLocalPersistence, signInAnonymously, getRedirectResult } from 'firebase/auth';
import { initializeFirestore, getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { getFunctions } from 'firebase/functions';
import { isNativeApp } from './services/platform-service.js';

// === Drape Firebase config ============================================
// Project: drape-9e532 (Firebase Console).
// authDomain stays on the Firebase-hosted handler until we set up a custom
// drape.app domain — swapping authDomain before the custom domain's OAuth
// handler is verified breaks Google/Apple sign-in.
const firebaseConfig = {
  apiKey: 'AIzaSyDZyBSX-MLEI-a-mNdLpMRJprlR_COLYw8',
  authDomain: 'drape-9e532.firebaseapp.com',
  projectId: 'drape-9e532',
  storageBucket: 'drape-9e532.firebasestorage.app',
  messagingSenderId: '284753548556',
  appId: '1:284753548556:web:723b8703fd8e6aa70d2529',
  measurementId: 'G-SYCBWB8WXB',
};

const app = initializeApp(firebaseConfig);

let _analytics = null;
try {
  if (!isNativeApp()) _analytics = getAnalytics(app);
} catch (err) {
  console.warn('Firebase analytics init failed:', err);
}
export const analytics = _analytics || { __noop: true };

export function logEvent(_unused, eventName, params) {
  if (!_analytics) return;
  try {
    _firebaseLogEvent(_analytics, eventName, params);
  } catch (err) {
    console.warn('logEvent failed:', eventName, err?.message);
  }
}

export function setUserId(_unused, uid) {
  if (!_analytics) return;
  try {
    _firebaseSetUserId(_analytics, uid);
  } catch (err) {
    console.warn('setUserId failed:', err?.message);
  }
}

// Native Capacitor WKWebView can't load the popup OAuth helper, so we skip
// popupRedirectResolver and use IndexedDB persistence. Apple Sign-In goes
// through the @capacitor-community plugin and never touches this path.
export const auth = isNativeApp()
  ? initializeAuth(app, { persistence: indexedDBLocalPersistence })
  : getAuth(app);

// Force long-polling on native — WebChannel transport struggles inside the
// WKWebView. Auto-detect on web.
export const db = isNativeApp()
  ? initializeFirestore(app, {
      experimentalForceLongPolling: true,
      useFetchStreams: false,
    })
  : getFirestore(app);

export const storage = getStorage(app);
export const functions = getFunctions(app);

const attachAuthState = () => {
  auth.onAuthStateChanged((user) => {
    if (!user) {
      signInAnonymously(auth).catch(err => console.warn('Anonymous auth failed:', err));
    }
  });
};
if (isNativeApp()) {
  attachAuthState();
} else {
  getRedirectResult(auth).catch(() => null).finally(attachAuthState);
}

export default app;
