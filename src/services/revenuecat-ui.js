// RevenueCat UI helpers — RevenueCat-hosted Paywall + Customer Center.
// Separate from revenuecat-service.js so the UI bundle is only loaded when
// actually needed (lazy import).
//
// presentPaywall   — show the Dashboard-configured paywall and resolve when
//                    purchase flow ends (PURCHASED/RESTORED → true, else false).
// presentCustomerCenter — Apple-style subscription mgmt sheet (renewal,
//                    cancel, manage). Nothing returned — UI is self-contained.

import { isNativeApp } from './platform-service.js';
import { Capacitor } from '@capacitor/core';

function isSupported() {
  if (!isNativeApp()) return false;
  const p = Capacitor.getPlatform();
  return p === 'ios' || p === 'android';
}

// Returns true on PURCHASED or RESTORED, false otherwise (cancel / not
// presented / error). Caller can use the boolean to e.g. show a thank-you
// toast or refresh entitlement state.
export async function presentPaywall() {
  if (!isSupported()) return false;
  try {
    const mod = await import('@revenuecat/purchases-capacitor-ui');
    const { RevenueCatUI, PAYWALL_RESULT } = mod;
    const { result } = await RevenueCatUI.presentPaywall();
    switch (result) {
      case PAYWALL_RESULT.PURCHASED:
      case PAYWALL_RESULT.RESTORED:
        return true;
      case PAYWALL_RESULT.NOT_PRESENTED:
      case PAYWALL_RESULT.ERROR:
      case PAYWALL_RESULT.CANCELLED:
      default:
        return false;
    }
  } catch (err) {
    console.warn('Paywall present failed:', err?.message || err);
    return false;
  }
}

// Apple-style subscription management — renewal date, cancel, restore.
// No return — the sheet handles its own lifecycle.
export async function presentCustomerCenter() {
  if (!isSupported()) return;
  try {
    const mod = await import('@revenuecat/purchases-capacitor-ui');
    const { RevenueCatUI } = mod;
    await RevenueCatUI.presentCustomerCenter();
  } catch (err) {
    console.warn('CustomerCenter present failed:', err?.message || err);
  }
}
