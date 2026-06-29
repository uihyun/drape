import { initializeApp } from 'firebase/app';
import { getAnalytics, logEvent as _firebaseLogEvent, setUserId as _firebaseSetUserId, setUserProperties as _firebaseSetUserProperties } from 'firebase/analytics';
import { getAuth, initializeAuth, indexedDBLocalPersistence, getRedirectResult } from 'firebase/auth';
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

const NATIVE = isNativeApp();
let _analytics = null;
try {
  if (!NATIVE) _analytics = getAnalytics(app);
} catch (err) {
  console.warn('Firebase analytics init failed:', err);
}
export const analytics = _analytics || { __noop: true };

// Native uses the @capacitor-firebase/analytics plugin (the JS firebase/analytics
// SDK doesn't run in the WKWebView/native runtime); web uses the JS SDK. Both
// behind the same logEvent/setUserId/logScreen API so callers don't branch.
async function nativeAnalytics() {
  const { FirebaseAnalytics } = await import('@capacitor-firebase/analytics');
  return FirebaseAnalytics;
}

export function logEvent(_unused, eventName, params) {
  if (NATIVE) {
    nativeAnalytics().then(A => A.logEvent({ name: eventName, params: params || {} })).catch(() => {});
    return;
  }
  if (!_analytics) return;
  try { _firebaseLogEvent(_analytics, eventName, params); }
  catch (err) { console.warn('logEvent failed:', eventName, err?.message); }
}

export function setUserId(_unused, uid) {
  if (NATIVE) {
    nativeAnalytics().then(A => A.setUserId({ userId: uid || null })).catch(() => {});
    return;
  }
  if (!_analytics) return;
  try { _firebaseSetUserId(_analytics, uid); }
  catch (err) { console.warn('setUserId failed:', err?.message); }
}

// User properties — for segmenting reports/cohorts (e.g. home_pref to compare
// retention of feed-home vs profile-home users).
export function setUserProp(key, value) {
  if (NATIVE) {
    nativeAnalytics().then(A => A.setUserProperty({ key, value: value == null ? null : String(value) })).catch(() => {});
    return;
  }
  if (!_analytics) return;
  try { _firebaseSetUserProperties(_analytics, { [key]: value }); }
  catch (err) { console.warn('setUserProp failed:', err?.message); }
}

// Screen tracking — drives Firebase's Screens report + time-on-screen
// (engagement) metrics. Call on each route change.
export function logScreen(screenName) {
  if (NATIVE) {
    nativeAnalytics().then(A => A.setCurrentScreen({ screenName, screenClassOverride: screenName })).catch(() => {});
    return;
  }
  if (!_analytics) return;
  try { _firebaseLogEvent(_analytics, 'screen_view', { firebase_screen: screenName, firebase_screen_class: screenName }); }
  catch (err) { console.warn('logScreen failed:', err?.message); }
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

// Anonymous auth was previously used to let guests browse — but the
// Firebase project has Anonymous sign-in disabled now (every user
// signs in explicitly via Google/Apple from /welcome). Process the
// redirect result on web so popup→redirect fallbacks still resolve.
if (!isNativeApp()) {
  getRedirectResult(auth).catch(() => null);
}

export default app;
