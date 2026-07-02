// platform-service.js
//
// Single source of truth for "is this running inside the Capacitor native app
// or in a regular browser?". Use this to gate features that diverge between
// web and native — e.g. show Stripe buttons only on web, route purchases
// through RevenueCat on native, swap Web Share API for the native plugin,
// etc. (Sprint A — Phase 8-5.)
//
// Capacitor 8 exposes `Capacitor.isNativePlatform()` and `Capacitor.getPlatform()`
// at runtime. We import lazily-safely: in environments where the bundle ships
// without `@capacitor/core` (shouldn't happen, but worth being defensive),
// the helpers fall back to "this is the web" so existing flows keep working.

import { Capacitor } from '@capacitor/core';

export function isNativeApp() {
  try {
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
}

// Returns 'ios' | 'android' | 'web'. App Store IAP and other iOS-specific
// gates should compare against 'ios' rather than just `isNativeApp()`.
export function getPlatform() {
  try {
    return Capacitor.getPlatform();
  } catch {
    return 'web';
  }
}

export const isIOS = () => getPlatform() === 'ios';
export const isAndroid = () => getPlatform() === 'android';
export const isWeb = () => getPlatform() === 'web';

// Public-facing origin for share / invite / canonical URLs. We force the
// canonical hosted origin so a link shared from the native Capacitor
// webview (which runs on https://localhost) or any preview host still
// points at the real app. The native app ALWAYS uses the hosted origin —
// its own localhost is never a shareable address. Only a real browser on
// localhost / 127.0.0.1 / .local (local dev) falls through to
// window.location.origin so local share testing works.
// The Firebase app host. CONTENT-SHARE links must use this so a tapped link
// opens the native app — iOS associated-domains + the AASA (/s /o /i /u /boards)
// are registered for web.app, NOT for drape.nyc. Inside the native webview the
// real origin is https://localhost (unshareable), so we hardcode the host; only
// a real browser on localhost/.local (dev) falls through to window.location.
const APP_ORIGIN = 'https://drape-9e532.web.app';
// The public brand / landing domain — marketing only, auth disabled. INVITE
// links point here so new people hit the signup funnel; it is deliberately NOT
// an associated domain, so it opens the landing page in a browser (not the app).
const BRAND_ORIGIN = 'https://drape.nyc';

// Shareable deep-link base for CONTENT (outfits/items/boards/profiles) — the app
// host, so the link opens the app on tap.
export function publicOrigin() {
  if (isNativeApp()) return APP_ORIGIN;
  if (typeof window === 'undefined') return APP_ORIGIN;
  const h = window.location.hostname || '';
  if (h === 'localhost' || h === '127.0.0.1' || h.endsWith('.local')) {
    return window.location.origin;
  }
  return APP_ORIGIN;
}

// Base for INVITE links — the brand landing page (drape.nyc), not the app host.
export function brandOrigin() {
  return BRAND_ORIGIN;
}
