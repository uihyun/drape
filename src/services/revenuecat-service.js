// RevenueCat IAP integration for the iOS native build.
//
// Web continues to use Stripe direct (billing-service.js + Pricing page).
// iOS uses RevenueCat → IAP → server webhook syncs `users/{uid}.plan` to
// 'pro' (mirrors Stripe webhook role).
//
// Lifecycle:
//   1. App boot              → RevenueCatService.init()
//   2. Auth resolves (uid)   → RevenueCatService.login(uid)
//   3. Sign-out              → RevenueCatService.logout()
//   4. Pricing page (iOS)    → presentPaywall() — RevenueCat-hosted UI
//   5. Account page (iOS)    → presentCustomerCenter() — Apple-style mgmt
//
// Source of truth on iOS: customerInfo.entitlements.active['Drape Pro'].
// Server webhook (functions/revenuecat.js) mirrors this into Firestore so
// the rest of the app (CreditsService, Header, etc.) sees plan='pro'
// regardless of which platform paid.

import { Purchases, LOG_LEVEL } from '@revenuecat/purchases-capacitor';
import { Capacitor } from '@capacitor/core';
import { isNativeApp } from './platform-service.js';

export const ENTITLEMENT_ID = 'Drape Pro';

// Platform 별 API key — iOS 는 'appl_...', Android 는 'goog_...'. RC SDK 가
// 자동 감지 안 함 (잘못된 platform key 면 "API Key is not recognized" 에러).
// RC dashboard → Project settings → API keys 에서 각 platform 별 가져옴.
// `VITE_REVENUECAT_PUBLIC_KEY` 는 backward-compat 용 (iOS fallback).
const IOS_API_KEY = import.meta.env.VITE_REVENUECAT_PUBLIC_KEY_IOS
  || import.meta.env.VITE_REVENUECAT_PUBLIC_KEY
  || 'test_taHlCUlwUIMdXbMnkNkmMRxHDPG';
const ANDROID_API_KEY = import.meta.env.VITE_REVENUECAT_PUBLIC_KEY_ANDROID
  || 'test_taHlCUlwUIMdXbMnkNkmMRxHDPG';

function getApiKey() {
  const platform = Capacitor.getPlatform();
  if (platform === 'ios') return IOS_API_KEY;
  if (platform === 'android') return ANDROID_API_KEY;
  return null;
}

let initialized = false;
let initPromise = null;

function isSupportedPlatform() {
  if (!isNativeApp()) return false;
  const p = Capacitor.getPlatform();
  return p === 'ios' || p === 'android';
}

export const RevenueCatService = {
  // Idempotent — safe to call multiple times. Web is a no-op. Returns the
  // same promise on parallel calls so the SDK is configured exactly once.
  async init() {
    if (initialized) return;
    if (initPromise) return initPromise;
    if (!isSupportedPlatform()) return;

    initPromise = (async () => {
      try {
        if (import.meta.env.DEV) {
          await Purchases.setLogLevel({ level: LOG_LEVEL.DEBUG });
        } else {
          await Purchases.setLogLevel({ level: LOG_LEVEL.WARN });
        }
        const apiKey = getApiKey();
        if (!apiKey) {
          console.warn('RevenueCat init skipped — no API key for platform', Capacitor.getPlatform());
          return;
        }
        await Purchases.configure({ apiKey });
        initialized = true;
      } catch (err) {
        console.warn('RevenueCat init failed:', err?.message || err);
      }
    })();
    return initPromise;
  },

  // Link RevenueCat customer to Firebase UID — call after sign-in.
  // Re-calling with the same uid is a cheap no-op server-side.
  async login(firebaseUid) {
    if (!initialized || !firebaseUid) return null;
    try {
      const { customerInfo } = await Purchases.logIn({ appUserID: firebaseUid });
      return customerInfo;
    } catch (err) {
      console.warn('RevenueCat login failed:', err?.message || err);
      return null;
    }
  },

  // Reset to anonymous identity on sign-out.
  async logout() {
    if (!initialized) return;
    try {
      await Purchases.logOut();
    } catch (err) {
      // logOut throws if user is already anonymous — safe to ignore.
      if (!String(err?.message || '').includes('anonymous')) {
        console.warn('RevenueCat logout failed:', err?.message || err);
      }
    }
  },

  // Read current customer state. Returns full customerInfo or null.
  async getCustomerInfo() {
    if (!initialized) return null;
    try {
      const { customerInfo } = await Purchases.getCustomerInfo();
      return customerInfo;
    } catch (err) {
      console.warn('RevenueCat getCustomerInfo failed:', err?.message || err);
      return null;
    }
  },

  // Pure helper — does customerInfo grant the Pro entitlement?
  isProActive(customerInfo) {
    if (!customerInfo) return false;
    return typeof customerInfo.entitlements?.active?.[ENTITLEMENT_ID] !== 'undefined';
  },

  // Subscribe to customerInfo updates (purchase completes, renewal, expiry).
  // Returns unsub fn.
  addCustomerInfoListener(cb) {
    if (!initialized) return () => {};
    const handle = Purchases.addCustomerInfoUpdateListener(cb);
    return () => {
      try { handle?.remove?.(); } catch { /* ignore */ }
    };
  },

  // Restore purchases (re-install / new device). Updates customerInfo.
  async restorePurchases() {
    if (!initialized) return null;
    try {
      const { customerInfo } = await Purchases.restorePurchases();
      return customerInfo;
    } catch (err) {
      console.warn('RevenueCat restore failed:', err?.message || err);
      return null;
    }
  },
};
