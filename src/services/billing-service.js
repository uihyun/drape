// Client-side billing service.
//
// All actual Stripe/IAP calls happen server-side. This module:
//   - Reads the user's subscription state from Firestore
//   - Asks the backend to create a Stripe Checkout session / Portal link
//   - Reads credit-pack purchase state once the webhook confirms it
//
// Backend endpoints it expects (all under Firebase Functions, same origin
// as `generateDesign` / `initializeUser`):
//
//   POST /createCheckoutSession
//     Body: { priceId: string, mode: 'subscription' | 'payment',
//             successUrl: string, cancelUrl: string }
//     Auth: Bearer <Firebase ID token>
//     Returns: { url: string }  ← redirect the browser here
//
//   POST /createBillingPortalSession
//     Body: { returnUrl: string }
//     Auth: Bearer <Firebase ID token>
//     Returns: { url: string }
//
// Both endpoints are stubs until Stripe secrets are provisioned — see
// functions/stripe-webhook.js and SETUP.md.

import { auth, db } from '../firebase.js';
import { doc, onSnapshot } from 'firebase/firestore';

import { FUNCTIONS_BASE } from './api-base.js';

async function authedFetch(path, body) {
  const user = auth.currentUser;
  if (!user || user.isAnonymous) {
    throw new Error('SIGN_IN_REQUIRED');
  }
  const token = await user.getIdToken();
  const res = await fetch(`${FUNCTIONS_BASE}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body || {}),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    const e = new Error(err.error || 'BILLING_REQUEST_FAILED');
    e.code = err.error;
    e.status = res.status;
    throw e;
  }
  return res.json();
}

export const BillingService = {
  /**
   * Start a Stripe Checkout session for a subscription plan or credit pack.
   * `mode` = 'subscription' for plans, 'payment' for one-off credit packs.
   * On success the browser is redirected to Stripe Checkout.
   */
  async startCheckout({ priceId, mode }) {
    if (!priceId) throw new Error('PRICE_NOT_CONFIGURED');
    const origin = window.location.origin;
    const { url } = await authedFetch('/createCheckoutSession', {
      priceId,
      mode,
      successUrl: `${origin}/account?checkout=success`,
      cancelUrl: `${origin}/pricing?checkout=cancelled`,
    });
    window.location.assign(url);
  },

  /**
   * Open the Stripe Billing Portal so the user can manage / cancel
   * their subscription and view invoices.
   */
  async openBillingPortal() {
    const origin = window.location.origin;
    const { url } = await authedFetch('/createBillingPortalSession', {
      returnUrl: `${origin}/account`,
    });
    window.location.assign(url);
  },

  /**
   * Subscribe to the current user's subscription state.
   * Populated by the Stripe webhook — see functions/stripe-webhook.js.
   * Shape (all fields optional until webhook writes them):
   *   { plan, status, currentPeriodEnd, cancelAtPeriodEnd,
   *     latestInvoiceUrl, stripeCustomerId }
   */
  subscribeToSubscription(uid, callback) {
    if (!uid) {
      callback(null);
      return () => {};
    }
    const ref = doc(db, 'users', uid);
    return onSnapshot(ref, (snap) => {
      const data = snap.data() || {};
      callback({
        plan: data.plan || 'free',
        status: data.subscriptionStatus || null,
        currentPeriodEnd: data.subscriptionRenewsAt || null,
        cancelAtPeriodEnd: Boolean(data.cancelAtPeriodEnd),
        stripeCustomerId: data.stripeCustomerId || null,
        // 결제 경로 구분용 — Stripe vs Apple IAP 분기 (계정 삭제 안내 등에 사용).
        // stripeSubscriptionId 있으면 Stripe, iosProductId 있으면 RC webhook 이
        // 들어온 적 있는 Apple IAP 결제. 플랫폼 무관 (데스크톱에서 iOS 구독
        // 보고 있는 경우도 잡힘).
        stripeSubscriptionId: data.stripeSubscriptionId || null,
        iosProductId: data.iosProductId || null,
      });
    }, (err) => {
      console.warn('subscription snapshot error:', err.message);
      callback(null);
    });
  },
};
